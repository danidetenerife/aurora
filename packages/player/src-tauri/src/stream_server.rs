use std::sync::Arc;

use axum::body::Body;
use axum::extract::{Path, State};
use axum::http::{header, HeaderMap, Response, StatusCode};
use axum::routing::get;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use reqwest::Client;
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tokio::sync::oneshot;
use tokio_util::sync::CancellationToken;

const PORT_START: u16 = 9100;
const PORT_END: u16 = 9109;

const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";

const FORWARD_HEADERS: &[header::HeaderName] = &[
    header::CONTENT_TYPE,
    header::CONTENT_LENGTH,
    header::CONTENT_RANGE,
    header::ACCEPT_RANGES,
];

pub struct StreamServerState {
    port: u16,
}

#[derive(Clone)]
struct ProxyState {
    client: Arc<Client>,
    port: u16,
}

fn decode_stream_url(encoded: &str) -> Result<String, String> {
    let bytes = URL_SAFE_NO_PAD
        .decode(encoded)
        .map_err(|err| format!("Invalid base64 URL: {err}"))?;

    let url = String::from_utf8(bytes).map_err(|err| format!("Invalid UTF-8 in URL: {err}"))?;

    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("Invalid URL scheme. Expected http(s)".to_string());
    }

    Ok(url)
}

fn encode_proxy_url(target_url: &str, port: u16) -> String {
    let encoded = URL_SAFE_NO_PAD.encode(target_url.as_bytes());
    format!("http://127.0.0.1:{port}/stream/{encoded}")
}

fn rewrite_tag_uris(line: &str, port: u16) -> String {
    let mut output = String::with_capacity(line.len());
    let mut remainder = line;
    while let Some(idx) = remainder.find("URI=\"") {
        let prefix_end = idx + 5;
        output.push_str(&remainder[..prefix_end]);
        let after_quote = &remainder[prefix_end..];
        if let Some(end_quote) = after_quote.find('"') {
            let uri_value = &after_quote[..end_quote];
            if uri_value.starts_with("http://") || uri_value.starts_with("https://") {
                output.push_str(&encode_proxy_url(uri_value, port));
            } else {
                output.push_str(uri_value);
            }
            output.push('"');
            remainder = &after_quote[end_quote + 1..];
        } else {
            output.push_str(after_quote);
            remainder = "";
            break;
        }
    }
    output.push_str(remainder);
    output
}

fn rewrite_hls_manifest(manifest: &str, port: u16) -> String {
    manifest
        .lines()
        .map(|line| {
            let trimmed = line.trim();
            if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
                encode_proxy_url(trimmed, port)
            } else if trimmed.starts_with('#') && trimmed.contains("URI=\"") {
                rewrite_tag_uris(trimmed, port)
            } else {
                line.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn cors_headers(headers: &mut HeaderMap) {
    headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*".parse().unwrap());
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_METHODS,
        "GET, OPTIONS, HEAD".parse().unwrap(),
    );
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_HEADERS,
        "Range".parse().unwrap(),
    );
    headers.insert(
        header::ACCESS_CONTROL_EXPOSE_HEADERS,
        "Content-Range, Content-Length, Accept-Ranges"
            .parse()
            .unwrap(),
    );
}

fn error_response(status: StatusCode, message: String) -> Response<Body> {
    let mut response = Response::builder()
        .status(status)
        .body(Body::from(message))
        .unwrap();
    cors_headers(response.headers_mut());
    response
}

fn build_upstream_request(
    client: &Client,
    url: &str,
    headers: &HeaderMap,
) -> reqwest::RequestBuilder {
    let mut request = client.get(url);
    if let Some(range_value) = headers.get(header::RANGE) {
        request = request.header(header::RANGE, range_value);
    }
    if !url.contains("googlevideo.com") {
        if let Some(user_agent) = headers.get(header::USER_AGENT) {
            request = request.header(header::USER_AGENT, user_agent);
        }
    }
    request
}

async fn proxy_stream(
    State(state): State<ProxyState>,
    Path(encoded_url): Path<String>,
    headers: HeaderMap,
) -> Response<Body> {
    let url = match decode_stream_url(&encoded_url) {
        Ok(url) => url,
        Err(message) => {
            log::error!("[StreamServer] {message}");
            return error_response(StatusCode::BAD_REQUEST, message);
        }
    };

    log::debug!(
        "[StreamServer] Proxying request, range: {:?}",
        headers.get(header::RANGE)
    );

    let mut upstream_response = match build_upstream_request(&state.client, &url, &headers)
        .send()
        .await
    {
        Ok(response) => response,
        Err(err) => {
            log::error!("[StreamServer] Request failed: {err:?}");
            return error_response(StatusCode::BAD_GATEWAY, format!("Failed to fetch: {err}"));
        }
    };

    if upstream_response.status() == StatusCode::FORBIDDEN && url.contains("googlevideo.com") {
        log::info!(
            "[StreamServer] 403 Forbidden from googlevideo.com (ad gate), retrying after 5.1s"
        );
        tokio::time::sleep(Duration::from_millis(5100)).await;
        if let Ok(retry_response) = build_upstream_request(&state.client, &url, &headers)
            .send()
            .await
        {
            upstream_response = retry_response;
        }
    }

    let upstream_status = upstream_response.status();
    if !upstream_status.is_success() && upstream_status != StatusCode::PARTIAL_CONTENT {
        log::error!("[StreamServer] Streaming service returned: {upstream_status}");
        return error_response(
            StatusCode::from_u16(upstream_status.as_u16()).unwrap_or(StatusCode::BAD_GATEWAY),
            format!("Streaming service returned error: {upstream_status}"),
        );
    }

    let upstream_headers = upstream_response.headers().clone();
    let content_type = upstream_headers
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_ascii_lowercase();
    let url_path = url.split('?').next().unwrap_or(&url);
    let is_hls_manifest = content_type.contains("mpegurl") || url_path.ends_with(".m3u8");

    if is_hls_manifest {
        let bytes = match upstream_response.bytes().await {
            Ok(data) => data,
            Err(err) => {
                log::error!("[StreamServer] Failed to read HLS manifest: {err:?}");
                return error_response(
                    StatusCode::BAD_GATEWAY,
                    format!("Failed to read HLS manifest: {err}"),
                );
            }
        };
        let manifest_text = String::from_utf8_lossy(&bytes);
        let rewritten = rewrite_hls_manifest(&manifest_text, state.port);

        let mut response = Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "application/vnd.apple.mpegurl")
            .body(Body::from(rewritten))
            .unwrap();
        cors_headers(response.headers_mut());
        return response;
    }

    let body = Body::from_stream(upstream_response.bytes_stream());

    let mut response = Response::builder()
        .status(upstream_status.as_u16())
        .body(body)
        .unwrap();

    for name in FORWARD_HEADERS {
        if let Some(value) = upstream_headers.get(name) {
            response.headers_mut().insert(name, value.clone());
        }
    }

    cors_headers(response.headers_mut());
    response
}

async fn options_handler() -> Response<Body> {
    let mut response = Response::builder()
        .status(StatusCode::NO_CONTENT)
        .body(Body::empty())
        .unwrap();
    cors_headers(response.headers_mut());
    response
}

async fn start_server(client: Arc<Client>, ready: oneshot::Sender<Result<u16, String>>) {
    let cancellation_token = CancellationToken::new();

    let tcp_listener =
        match crate::net::bind_first_available_port("127.0.0.1", PORT_START, PORT_END).await {
            Ok(listener) => listener,
            Err(message) => {
                log::error!("Failed to bind stream server: {message}");
                let _ = ready.send(Err(message));
                return;
            }
        };

    let bound_port = tcp_listener.local_addr().unwrap().port();
    let router = axum::Router::new()
        .route(
            "/stream/{encoded_url}",
            get(proxy_stream).options(options_handler),
        )
        .with_state(ProxyState {
            client,
            port: bound_port,
        });

    log::info!("Stream proxy listening on http://127.0.0.1:{bound_port}");
    let _ = ready.send(Ok(bound_port));

    let _ = axum::serve(tcp_listener, router)
        .with_graceful_shutdown(async move {
            cancellation_token.cancelled().await;
        })
        .await;

    log::info!("Stream server stopped");
}

pub fn init_stream_server(app_handle: AppHandle) {
    let client = Arc::new(
        Client::builder()
            .user_agent(USER_AGENT)
            .read_timeout(Duration::from_secs(300))
            .connect_timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client for stream server"),
    );

    let (ready_tx, ready_rx) = oneshot::channel();
    tauri::async_runtime::spawn(start_server(client, ready_tx));

    let handle = app_handle.clone();
    tauri::async_runtime::spawn(async move {
        match ready_rx.await {
            Ok(Ok(port)) => {
                log::info!("Stream server ready on port {port}");
                handle.manage(StreamServerState { port });
            }
            Ok(Err(message)) => {
                log::error!("Stream server failed to start: {message}");
            }
            Err(_) => {
                log::error!("Stream server task exited before reporting ready");
            }
        }
    });
}

#[tauri::command]
#[specta::specta]
pub fn stream_server_port(state: tauri::State<'_, StreamServerState>) -> u16 {
    state.port
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rewrites_standalone_segment_urls_and_tag_uris() {
        let sample = "#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID=\"234\",URI=\"https://manifest.googlevideo.com/api/manifest/hls_playlist/id/1/file/index.m3u8\"\n#EXTINF:5.0,\nhttps://rr1---sn-abc.googlevideo.com/videoplayback/seg.ts";
        let rewritten = rewrite_hls_manifest(sample, 9100);
        let lines: Vec<&str> = rewritten.lines().collect();

        assert_eq!(lines[0], "#EXTM3U");
        assert!(lines[1].contains("URI=\"http://127.0.0.1:9100/stream/"));
        assert_eq!(lines[2], "#EXTINF:5.0,");
        assert!(lines[3].starts_with("http://127.0.0.1:9100/stream/"));

        let encoded_seg = lines[3].trim_start_matches("http://127.0.0.1:9100/stream/");
        assert_eq!(
            decode_stream_url(encoded_seg).unwrap(),
            "https://rr1---sn-abc.googlevideo.com/videoplayback/seg.ts"
        );
    }
}
