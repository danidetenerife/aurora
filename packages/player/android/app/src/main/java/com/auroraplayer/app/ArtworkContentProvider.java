package com.auroraplayer.app;

import android.content.ContentProvider;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.res.Resources;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import android.util.LruCache;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class ArtworkContentProvider extends ContentProvider {
    public static final String AUTHORITY = "com.auroraplayer.app.artwork";
    public static final Uri CONTENT_URI = Uri.parse("content://" + AUTHORITY);

    private static final int CACHE_SIZE = 12 * 1024 * 1024;
    private static final LruCache<String, byte[]> MEMORY_CACHE = new LruCache<String, byte[]>(CACHE_SIZE) {
        @Override
        protected int sizeOf(String key, byte[] value) {
            return value.length;
        }
    };

    private final ExecutorService networkExecutor = Executors.newFixedThreadPool(4);

    public static Uri getPresetUri(String name) {
        return new Uri.Builder()
                .scheme(ContentResolver.SCHEME_ANDROID_RESOURCE)
                .authority("com.auroraplayer.app")
                .appendPath("drawable")
                .appendPath(name)
                .build();
    }

    public static Uri getGeneratedUri(String title, String subtitle, String badge) {
        Uri.Builder builder = CONTENT_URI.buildUpon().appendPath("generated");
        if (title != null) builder.appendQueryParameter("title", title);
        if (subtitle != null) builder.appendQueryParameter("subtitle", subtitle);
        if (badge != null) builder.appendQueryParameter("badge", badge);
        return builder.build();
    }

    public static Uri getRemoteUri(String remoteUrl) {
        if (remoteUrl == null || remoteUrl.trim().isEmpty()) {
            return getPresetUri("cover_driving");
        }
        return CONTENT_URI.buildUpon()
                .appendPath("remote")
                .appendQueryParameter("url", remoteUrl)
                .build();
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Nullable
    @Override
    public String getType(@NonNull Uri uri) {
        return "image/png";
    }

    @Nullable
    @Override
    public ParcelFileDescriptor openFile(@NonNull Uri uri, @NonNull String mode) throws FileNotFoundException {
        String path = uri.getPath();
        if (path == null) {
            throw new FileNotFoundException("Null URI path");
        }

        try {
            return openPipeHelper(uri, "image/png", null, null, (output, currentUri, mimeType, opts, args) -> {
                try {
                    byte[] bytes = resolveArtworkBytes(currentUri);
                    if (bytes != null && bytes.length > 0) {
                        try (FileOutputStream out = new FileOutputStream(output.getFileDescriptor())) {
                            out.write(bytes);
                            out.flush();
                        }
                    }
                } catch (Exception ignored) {
                }
            });
        } catch (Exception e) {
            throw new FileNotFoundException("Failed opening pipe: " + e.getMessage());
        }
    }

    private byte[] resolveArtworkBytes(Uri uri) {
        String uriString = uri.toString();
        byte[] cached = MEMORY_CACHE.get(uriString);
        if (cached != null) {
            return cached;
        }

        String path = uri.getPath();
        if (path == null) return null;

        byte[] result = null;
        if (path.startsWith("/preset/")) {
            String name = uri.getLastPathSegment();
            result = loadPresetBytes(name);
        } else if (path.startsWith("/generated")) {
            String title = uri.getQueryParameter("title");
            String subtitle = uri.getQueryParameter("subtitle");
            String badge = uri.getQueryParameter("badge");
            Bitmap bitmap = AutoArtworkGenerator.generateCover(title, subtitle, badge);
            result = bitmapToBytes(bitmap);
        } else if (path.startsWith("/remote")) {
            String remoteUrl = uri.getQueryParameter("url");
            result = loadRemoteBytes(remoteUrl);
            if (result == null) {
                String title = uri.getQueryParameter("title");
                if (title == null) title = "Aurora";
                Bitmap bitmap = AutoArtworkGenerator.generateCover(title, "", "TRACK");
                result = bitmapToBytes(bitmap);
            }
        }

        if (result != null) {
            MEMORY_CACHE.put(uriString, result);
        }
        return result;
    }

    private byte[] loadPresetBytes(String name) {
        if (name == null || getContext() == null) return null;
        Context context = getContext();
        Resources resources = context.getResources();
        int resId = resources.getIdentifier(name, "drawable", context.getPackageName());
        if (resId == 0) return null;

        try (InputStream in = resources.openRawResource(resId);
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
            return out.toByteArray();
        } catch (Exception ignored) {
            return null;
        }
    }

    private byte[] loadRemoteBytes(String remoteUrl) {
        if (remoteUrl == null || remoteUrl.trim().isEmpty() || getContext() == null) return null;

        File cacheFile = getDiskCacheFile(remoteUrl);
        if (cacheFile.exists() && cacheFile.length() > 0) {
            try (FileInputStream in = new FileInputStream(cacheFile);
                 ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192];
                int read;
                while ((read = in.read(buffer)) != -1) {
                    out.write(buffer, 0, read);
                }
                return out.toByteArray();
            } catch (Exception ignored) {
            }
        }

        try {
            URL url = new URL(remoteUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(4000);
            conn.setReadTimeout(4000);
            conn.setDoInput(true);
            conn.connect();

            if (conn.getResponseCode() == HttpURLConnection.HTTP_OK) {
                try (InputStream in = conn.getInputStream();
                     ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                    byte[] buffer = new byte[8192];
                    int read;
                    while ((read = in.read(buffer)) != -1) {
                        out.write(buffer, 0, read);
                    }
                    byte[] bytes = out.toByteArray();

                    try (FileOutputStream fos = new FileOutputStream(cacheFile)) {
                        fos.write(bytes);
                    } catch (Exception ignored) {}

                    return bytes;
                }
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private File getDiskCacheFile(String url) {
        File dir = new File(getContext().getCacheDir(), "artwork_cache");
        if (!dir.exists()) {
            dir.mkdirs();
        }
        return new File(dir, sha256(url) + ".art");
    }

    private String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes("UTF-8"));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            return String.valueOf(input.hashCode());
        }
    }

    private byte[] bitmapToBytes(Bitmap bitmap) {
        if (bitmap == null) return null;
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, out);
        return out.toByteArray();
    }

    @Nullable
    @Override
    public Cursor query(@NonNull Uri uri, @Nullable String[] projection, @Nullable String selection, @Nullable String[] selectionArgs, @Nullable String sortOrder) {
        return null;
    }

    @Nullable
    @Override
    public Uri insert(@NonNull Uri uri, @Nullable ContentValues values) {
        return null;
    }

    @Override
    public int delete(@NonNull Uri uri, @Nullable String selection, @Nullable String[] selectionArgs) {
        return 0;
    }

    @Override
    public int update(@NonNull Uri uri, @Nullable ContentValues values, @Nullable String selection, @Nullable String[] selectionArgs) {
        return 0;
    }
}
