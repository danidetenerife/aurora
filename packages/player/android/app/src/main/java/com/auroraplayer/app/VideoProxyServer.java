package com.auroraplayer.app;

import android.util.Log;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URL;
import java.util.Base64;

public class VideoProxyServer {
    private static final String TAG = "VideoProxyServer";
    private static VideoProxyServer instance;
    private ServerSocket serverSocket;
    private int port;
    private volatile boolean running;

    public static synchronized VideoProxyServer getInstance() {
        if (instance == null) {
            instance = new VideoProxyServer();
        }
        return instance;
    }

    public int getPort() {
        return port;
    }

    public void start() throws IOException {
        if (running) return;

        serverSocket = new ServerSocket(0, 10, java.net.InetAddress.getByName("127.0.0.1"));
        port = serverSocket.getLocalPort();
        running = true;

        Thread serverThread = new Thread(() -> {
            while (running) {
                try {
                    Socket client = serverSocket.accept();
                    new Thread(() -> handleClient(client)).start();
                } catch (IOException e) {
                    if (running) Log.e(TAG, "Accept error: " + e.getMessage());
                }
            }
        }, "VideoProxyServer");
        serverThread.setDaemon(true);
        serverThread.start();

        Log.i(TAG, "Video proxy started on port " + port);
    }

    private void handleClient(Socket client) {
        try {
            InputStream clientIn = client.getInputStream();
            StringBuilder requestLine = new StringBuilder();
            int c;
            while ((c = clientIn.read()) != -1) {
                requestLine.append((char) c);
                if (requestLine.toString().endsWith("\r\n\r\n")) break;
            }

            String request = requestLine.toString();
            String[] lines = request.split("\r\n");
            if (lines.length == 0) { client.close(); return; }

            String[] parts = lines[0].split(" ");
            if (parts.length < 2) { client.close(); return; }

            String method = parts[0];
            String path = parts[1];

            String rangeHeader = null;
            for (String line : lines) {
                if (line.toLowerCase().startsWith("range:")) {
                    rangeHeader = line.substring(6).trim();
                }
            }

            if (method.equals("OPTIONS")) {
                String corsResponse = "HTTP/1.1 204 No Content\r\n" +
                    "Access-Control-Allow-Origin: *\r\n" +
                    "Access-Control-Allow-Methods: GET, OPTIONS\r\n" +
                    "Access-Control-Allow-Headers: Range\r\n" +
                    "Access-Control-Max-Age: 86400\r\n\r\n";
                client.getOutputStream().write(corsResponse.getBytes());
                client.close();
                return;
            }

            if (!path.startsWith("/video/")) {
                String notFound = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n";
                client.getOutputStream().write(notFound.getBytes());
                client.close();
                return;
            }

            String encoded = path.substring("/video/".length());
            int mod = encoded.length() % 4;
            if (mod > 0) encoded += "====".substring(mod);
            String targetUrl = new String(Base64.getUrlDecoder().decode(encoded), "UTF-8");

            Log.d(TAG, "Proxying: " + targetUrl.substring(0, Math.min(targetUrl.length(), 500)));

            HttpURLConnection conn = (HttpURLConnection) new URL(targetUrl).openConnection();
            conn.setRequestProperty("User-Agent", YtStreamExtractorPlugin.MOBILE_UA);
            conn.setRequestProperty("Referer", "https://m.youtube.com/");
            conn.setRequestProperty("Origin", "https://m.youtube.com");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(30000);

            if (rangeHeader != null) {
                conn.setRequestProperty("Range", rangeHeader);
            }

            conn.connect();
            int responseCode = conn.getResponseCode();
            String contentType = conn.getContentType();
            if (contentType == null) contentType = "video/mp4";
            long contentLength = conn.getContentLengthLong();

            Log.d(TAG, "Proxy response: " + responseCode + " type=" + contentType + " length=" + contentLength);

            StringBuilder response = new StringBuilder();
            response.append("HTTP/1.1 ").append(responseCode).append(" ")
                    .append(conn.getResponseMessage()).append("\r\n");
            response.append("Content-Type: ").append(contentType).append("\r\n");
            response.append("Access-Control-Allow-Origin: *\r\n");
            response.append("Access-Control-Expose-Headers: Content-Range, Content-Length, Accept-Ranges\r\n");

            if (contentLength >= 0) {
                response.append("Content-Length: ").append(contentLength).append("\r\n");
            }

            String contentRange = conn.getHeaderField("Content-Range");
            if (contentRange != null) {
                response.append("Content-Range: ").append(contentRange).append("\r\n");
            }
            String acceptRanges = conn.getHeaderField("Accept-Ranges");
            if (acceptRanges != null) {
                response.append("Accept-Ranges: ").append(acceptRanges).append("\r\n");
            }

            response.append("\r\n");

            OutputStream clientOut = client.getOutputStream();
            clientOut.write(response.toString().getBytes());

            InputStream serverIn = conn.getInputStream();
            byte[] buffer = new byte[65536];
            int bytesRead;
            while ((bytesRead = serverIn.read(buffer)) != -1) {
                clientOut.write(buffer, 0, bytesRead);
            }
            clientOut.flush();
            serverIn.close();
            conn.disconnect();
            client.close();
        } catch (Exception e) {
            Log.e(TAG, "Proxy error: " + e.getMessage());
            try { client.close(); } catch (IOException ignored) {}
        }
    }
}
