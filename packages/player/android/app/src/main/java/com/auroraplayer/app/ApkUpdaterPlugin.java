package com.auroraplayer.app;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdaterPlugin extends Plugin {
    private static final String TAG = "ApkUpdaterPlugin";
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void getAppVersion(PluginCall call) {
        try {
            Context context = getContext();
            PackageManager pm = context.getPackageManager();
            PackageInfo packageInfo = pm.getPackageInfo(context.getPackageName(), 0);

            JSObject ret = new JSObject();
            ret.put("version", packageInfo.versionName);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                ret.put("versionCode", packageInfo.getLongVersionCode());
            } else {
                //noinspection deprecation
                ret.put("versionCode", (long) packageInfo.versionCode);
            }
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error getting app version", e);
            call.reject("Failed to get app version: " + e.getMessage());
        }
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String downloadUrl = call.getString("url");
        if (downloadUrl == null || downloadUrl.isEmpty()) {
            call.reject("URL cannot be empty");
            return;
        }

        call.setKeepAlive(true);

        executor.execute(() -> {
            InputStream input = null;
            FileOutputStream output = null;
            HttpURLConnection connection = null;

            try {
                Context context = getContext();
                File cacheDir = context.getExternalCacheDir() != null ? context.getExternalCacheDir() : context.getCacheDir();
                File apkFile = new File(cacheDir, "aurora-update.apk");

                if (apkFile.exists()) {
                    apkFile.delete();
                }

                URL url = new URL(downloadUrl);
                connection = (HttpURLConnection) url.openConnection();
                connection.setInstanceFollowRedirects(true);
                connection.setRequestProperty("User-Agent", "Aurora-Music-Player-Android");
                connection.connect();

                // Handle HTTP redirects (GitHub releases redirect to AWS S3)
                int responseCode = connection.getResponseCode();
                if (responseCode == HttpURLConnection.HTTP_MOVED_PERM || responseCode == HttpURLConnection.HTTP_MOVED_TEMP || responseCode == 307 || responseCode == 308) {
                    String redirectUrl = connection.getHeaderField("Location");
                    connection.disconnect();
                    url = new URL(redirectUrl);
                    connection = (HttpURLConnection) url.openConnection();
                    connection.connect();
                }

                int fileLength = connection.getContentLength();
                input = connection.getInputStream();
                output = new FileOutputStream(apkFile);

                byte[] buffer = new byte[8192];
                long total = 0;
                int count;
                long lastProgressTime = 0;

                while ((count = input.read(buffer)) != -1) {
                    total += count;
                    output.write(buffer, 0, count);

                    long now = System.currentTimeMillis();
                    if (fileLength > 0 && now - lastProgressTime > 200) {
                        lastProgressTime = now;
                        int percent = (int) (total * 100 / fileLength);
                        JSObject progress = new JSObject();
                        progress.put("percent", percent);
                        progress.put("downloadedBytes", total);
                        progress.put("totalBytes", fileLength);
                        notifyListeners("downloadProgress", progress);
                    }
                }

                output.flush();

                JSObject finishProgress = new JSObject();
                finishProgress.put("percent", 100);
                finishProgress.put("downloadedBytes", total);
                finishProgress.put("totalBytes", total);
                notifyListeners("downloadProgress", finishProgress);

                // Check permission to install unknown apps (Android 8+)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    if (!context.getPackageManager().canRequestPackageInstalls()) {
                        Log.w(TAG, "canRequestPackageInstalls is false, opening permission settings");
                        try {
                            Intent settingsIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                            settingsIntent.setData(Uri.parse("package:" + context.getPackageName()));
                            settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            context.startActivity(settingsIntent);
                        } catch (Exception ex) {
                            Log.e(TAG, "Failed to launch unknown sources settings", ex);
                        }
                    }
                }

                // 1. Try silent root install if su exists
                boolean installedSilently = false;
                if (tryRootInstall(apkFile)) {
                    Log.i(TAG, "Silent root install succeeded");
                    installedSilently = true;
                    try {
                        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
                        if (launch != null) {
                            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                            context.startActivity(launch);
                        }
                    } catch (Exception ignored) {}
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    // 2. Android 12+ PackageInstaller with USER_ACTION_NOT_REQUIRED (Unattended install)
                    installedSilently = installViaPackageInstaller(context, apkFile);
                }

                // 3. Fallback to Intent.ACTION_VIEW if unattended install was not possible
                if (!installedSilently) {
                    fallbackIntentInstall(context, apkFile);
                }

                JSObject result = new JSObject();
                result.put("success", true);
                call.resolve(result);

            } catch (Exception e) {
                Log.e(TAG, "Error downloading or installing APK", e);
                call.reject("Download/Install failed: " + e.getMessage());
            } finally {
                try {
                    if (output != null) output.close();
                    if (input != null) input.close();
                    if (connection != null) connection.disconnect();
                } catch (Exception ignored) {}
            }
        });
    }

    private boolean tryRootInstall(File apkFile) {
        try {
            File su = new File("/system/bin/su");
            File suXbin = new File("/system/xbin/su");
            if (!su.exists() && !suXbin.exists()) {
                return false;
            }
            Process p = Runtime.getRuntime().exec(new String[]{
                "su", "-c", "pm install -r \"" + apkFile.getAbsolutePath() + "\""
            });
            return p.waitFor() == 0;
        } catch (Throwable t) {
            return false;
        }
    }

    private boolean installViaPackageInstaller(Context context, File apkFile) {
        try {
            PackageInstaller packageInstaller = context.getPackageManager().getPackageInstaller();
            PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(
                PackageInstaller.SessionParams.MODE_FULL_INSTALL
            );
            params.setAppPackageName(context.getPackageName());

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
            }

            int sessionId = packageInstaller.createSession(params);
            PackageInstaller.Session session = packageInstaller.openSession(sessionId);

            try (InputStream in = new FileInputStream(apkFile);
                 OutputStream out = session.openWrite("aurora_update.apk", 0, apkFile.length())) {
                byte[] buffer = new byte[65536];
                int count;
                while ((count = in.read(buffer)) != -1) {
                    out.write(buffer, 0, count);
                }
                session.fsync(out);
            }

            Intent statusIntent = new Intent(context, ApkInstallReceiver.class);
            statusIntent.setAction("com.auroraplayer.app.UPDATE_STATUS");

            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                flags |= PendingIntent.FLAG_MUTABLE;
            }
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context,
                sessionId,
                statusIntent,
                flags
            );

            session.commit(pendingIntent.getIntentSender());
            session.close();
            Log.i(TAG, "PackageInstaller session committed with USER_ACTION_NOT_REQUIRED");
            return true;
        } catch (Throwable t) {
            Log.e(TAG, "Unattended PackageInstaller session failed", t);
            return false;
        }
    }

    private void fallbackIntentInstall(Context context, File apkFile) {
        try {
            Uri apkUri = FileProvider.getUriForFile(
                context,
                context.getPackageName() + ".fileprovider",
                apkFile
            );

            Intent installIntent = new Intent(Intent.ACTION_VIEW);
            installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            context.startActivity(installIntent);
        } catch (Exception e) {
            Log.e(TAG, "Fallback Intent install failed", e);
        }
    }
}
