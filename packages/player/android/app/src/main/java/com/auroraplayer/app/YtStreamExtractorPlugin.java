package com.auroraplayer.app;

import android.annotation.SuppressLint;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Resolves a playable YouTube audio stream URL directly on the device
 * without any external server or proxy.
 *
 * It uses a hidden off-screen WebView executing YouTube's real player JS,
 * which transparently handles signature deciphering and PoToken / BotGuard
 * as a genuine mobile browser.
 *
 * Implements a 2-stage fallback:
 * Stage 1: Loads https://www.youtube.com/embed/<videoId>?autoplay=1...
 * Stage 2: If embed triggers no audio within timeout (e.g. age-restricted
 *          or embed-blocked tracks), falls back to https://m.youtube.com/watch?v=<videoId>
 */
@CapacitorPlugin(name = "YtStreamExtractor")
public class YtStreamExtractorPlugin extends Plugin {
    private static final String TAG = "YtStreamExtractor";
    private static final long STAGE1_TIMEOUT_MS = 8000;
    private static final long STAGE2_TIMEOUT_MS = 7000;
    private final java.util.Map<WebView, Runnable> activeExtractions = new java.util.HashMap<>();

    public static final String MOBILE_UA =
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/128.0.0.0 Mobile Safari/537.36";

    @PluginMethod
    public void extractAudioUrl(PluginCall call) {
        String videoId = call.getString("videoId");
        if (videoId == null || videoId.trim().isEmpty()) {
            call.reject("videoId is required");
            return;
        }

        getActivity().runOnUiThread(() -> startExtraction(call, videoId.trim()));
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void startExtraction(PluginCall call, String videoId) {
        WebView hidden;
        try {
            hidden = new ExtractionWebView(getContext());
        } catch (Throwable t) {
            call.reject("Could not create extraction WebView: " + t.getMessage());
            return;
        }

        AtomicBoolean settled = new AtomicBoolean(false);
        Handler mainHandler = new Handler(Looper.getMainLooper());

        Runnable cleanupRunnable = () -> {
            mainHandler.removeCallbacksAndMessages(null);
            activeExtractions.remove(hidden);
            cleanup(hidden);
        };
        activeExtractions.put(hidden, () -> {
            if (settled.compareAndSet(false, true)) {
                cleanupRunnable.run();
                call.reject("Audio extraction cancelled because the activity was destroyed");
            }
        });

        java.util.Map<String, String> headers = new java.util.HashMap<>();
        headers.put("Accept-Language", "es-ES,es;q=0.9");

        Runnable stage2TimeoutRunnable = () -> {
            if (settled.compareAndSet(false, true)) {
                cleanupRunnable.run();
                Log.w(TAG, "Stage 2 (m.youtube.com) timed out for videoId: " + videoId);
                call.reject("Timed out resolving audio stream for " + videoId);
            }
        };

        Runnable stage1TimeoutRunnable = () -> {
            if (!settled.get()) {
                Log.i(TAG, "Stage 1 (embed) timed out for " + videoId + ", trying Stage 2 (m.youtube.com)");
                try {
                    hidden.stopLoading();
                    String watchUrl = "https://m.youtube.com/watch?v=" + videoId + "&hl=es&gl=ES";
                    hidden.loadUrl(watchUrl, headers);
                    mainHandler.postDelayed(stage2TimeoutRunnable, STAGE2_TIMEOUT_MS);
                } catch (Throwable t) {
                    if (settled.compareAndSet(false, true)) {
                        cleanupRunnable.run();
                        call.reject("Stage 2 load failed: " + t.getMessage());
                    }
                }
            }
        };

        mainHandler.postDelayed(stage1TimeoutRunnable, STAGE1_TIMEOUT_MS);

        WebSettings settings = hidden.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUserAgentString(MOBILE_UA);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        hidden.setWebChromeClient(new WebChromeClient());

        hidden.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (settled.get()) return;
                try {
                    view.evaluateJavascript(
                        "(function() {" +
                        "  var v = document.querySelector('video');" +
                        "  if (v) { v.muted = true; v.play().catch(function(){}); }" +
                        "  var b = document.querySelector('.ytp-large-play-button') || document.querySelector('button[aria-label=\"Play\"]');" +
                        "  if (b) { b.click(); }" +
                        "})();",
                        null
                    );
                } catch (Throwable ignored) {}
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                try {
                    String url = request.getUrl().toString();
                    String lowerUrl = url.toLowerCase();

                    boolean isGoogleVideo = lowerUrl.contains("googlevideo.com");
                    boolean isHls = isGoogleVideo && (lowerUrl.contains("hls_playlist") || lowerUrl.contains("/playlist/index.m3u8"));
                    boolean isVideoItag = lowerUrl.contains("itag/133") || lowerUrl.contains("itag/134") ||
                                          lowerUrl.contains("itag/135") || lowerUrl.contains("itag/136") ||
                                          lowerUrl.contains("itag/137") || lowerUrl.contains("itag/242") ||
                                          lowerUrl.contains("itag/243") || lowerUrl.contains("itag/244") ||
                                          lowerUrl.contains("itag/247") || lowerUrl.contains("itag/248") ||
                                          lowerUrl.contains("itag/278") || lowerUrl.contains("itag/18") ||
                                          lowerUrl.contains("itag/22");
                    boolean isHlsAudio = isHls && !isVideoItag && !lowerUrl.contains("file/seg.ts");

                    boolean isDashAudio = isGoogleVideo && lowerUrl.contains("videoplayback") &&
                                          (lowerUrl.contains("mime=audio") || lowerUrl.contains("mime%3daudio") ||
                                           lowerUrl.contains("audio%2f") || lowerUrl.contains("audio/")) &&
                                          !lowerUrl.contains("mime=video") && !lowerUrl.contains("mime%3dvideo");

                    boolean isDubbed = (lowerUrl.contains("dubbed-auto") || lowerUrl.contains("dubbed")) &&
                                       !lowerUrl.contains("lang=es") &&
                                       !lowerUrl.contains("acont=original");

                    boolean isValidAudio = (isHlsAudio || isDashAudio) && !isDubbed;

                    if (!settled.get() && isValidAudio) {
                        if (settled.compareAndSet(false, true)) {
                            Log.i(TAG, "Successfully intercepted audio stream URL for " + videoId + ": " + url);
                            mainHandler.removeCallbacks(stage1TimeoutRunnable);
                            mainHandler.removeCallbacks(stage2TimeoutRunnable);

                            JSObject result = new JSObject();
                            result.put("streamUrl", url);

                            mainHandler.post(() -> {
                                cleanupRunnable.run();
                                call.resolve(result);
                            });
                        }
                    }
                } catch (Throwable t) {
                    Log.w(TAG, "Error in shouldInterceptRequest", t);
                }
                return super.shouldInterceptRequest(view, request);
            }
        });

        try {
            ViewGroup root = getActivity().findViewById(android.R.id.content);
            if (root != null) {
                ViewGroup.LayoutParams params = new ViewGroup.LayoutParams(
                    ExtractionWebView.VIEW_WIDTH, ExtractionWebView.VIEW_HEIGHT);
                root.addView(hidden, params);
            }
            MainActivity.ensureActiveWebView();

            String embedUrl = "https://www.youtube.com/embed/" + videoId
                + "?autoplay=1&mute=1&controls=0&playsinline=1&hl=es&gl=ES&enablejsapi=1";
            hidden.loadUrl(embedUrl, headers);
        } catch (RuntimeException error) {
            if (settled.compareAndSet(false, true)) {
                cleanupRunnable.run();
                call.reject("Could not start audio extraction: " + error.getMessage());
            }
        }
    }

    @Override
    protected void handleOnDestroy() {
        for (Runnable cancel : new java.util.ArrayList<>(activeExtractions.values())) {
            cancel.run();
        }
        super.handleOnDestroy();
    }

    private void cleanup(WebView webView) {
        if (webView == null) return;
        try {
            ViewGroup parent = (ViewGroup) webView.getParent();
            if (parent != null) {
                parent.removeView(webView);
            }
            webView.stopLoading();
            webView.setWebViewClient(null);
            webView.setWebChromeClient(null);
            webView.loadUrl("about:blank");
            webView.clearHistory();
            webView.removeAllViews();
            webView.destroy();
            MainActivity.ensureActiveWebView();
        } catch (Throwable t) {
            Log.w(TAG, "Cleanup failed", t);
        }
    }
}
