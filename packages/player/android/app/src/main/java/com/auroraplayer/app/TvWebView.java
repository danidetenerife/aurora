package com.auroraplayer.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.os.Build;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebSettings;
import android.webkit.WebView;

final class TvWebView {
    private static final String TV_USER_AGENT = YtStreamExtractorPlugin.MOBILE_UA;

    static boolean isTelevision(Context context) {
        if (context != null) {
            try {
                android.content.SharedPreferences prefs = context.getSharedPreferences("aurora_prefs", Context.MODE_PRIVATE);
                if (prefs.getBoolean("force_tv_mode", false)) {
                    return true;
                }
            } catch (Throwable t) {}
            if (context instanceof Activity) {
                Intent intent = ((Activity) context).getIntent();
                if (intent != null && (intent.getBooleanExtra("tv", false) || intent.getBooleanExtra("tv_mode", false))) {
                    try {
                        context.getSharedPreferences("aurora_prefs", Context.MODE_PRIVATE)
                            .edit().putBoolean("force_tv_mode", true).apply();
                    } catch (Throwable t) {}
                    return true;
                }
            }
        }
        int mode = context.getResources().getConfiguration().uiMode & Configuration.UI_MODE_TYPE_MASK;
        return mode == Configuration.UI_MODE_TYPE_TELEVISION
            || mode == Configuration.UI_MODE_TYPE_CAR
            || context.getPackageName().equals("com.auroraplayer.app.tvpreview")
            || context.getPackageManager().hasSystemFeature(PackageManager.FEATURE_LEANBACK)
            || (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && context.getPackageManager().hasSystemFeature(PackageManager.FEATURE_AUTOMOTIVE));
    }

    static void configure(Activity activity, WebView webView) {
        if (webView == null) {
            return;
        }
        if (activity.getPackageName().equals("com.auroraplayer.app.tvpreview")) {
            activity.setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);
        }
        WebSettings settings = webView.getSettings();
        settings.setUserAgentString(TV_USER_AGENT);
        settings.setUseWideViewPort(false);
        settings.setLoadWithOverviewMode(false);
        settings.setLayoutAlgorithm(WebSettings.LayoutAlgorithm.NORMAL);
        settings.setTextZoom(100);
        settings.setSupportZoom(false);
        settings.setOffscreenPreRaster(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        webView.setBackgroundColor(0xFF0F0F12);
        try {
            webView.addJavascriptInterface(new Object() {
                @android.webkit.JavascriptInterface
                public boolean isTv() { return true; }
            }, "AndroidTV");
        } catch (Throwable t) {}
        try {
            webView.evaluateJavascript("window.__AURORA_TV_MODE__ = true; try { localStorage.setItem('aurora:tv_mode', 'true'); } catch(e){}", null);
        } catch (Throwable t) {}
        ViewGroup.LayoutParams layout = webView.getLayoutParams();
        if (layout != null) {
            layout.width = ViewGroup.LayoutParams.MATCH_PARENT;
            layout.height = ViewGroup.LayoutParams.MATCH_PARENT;
            webView.setLayoutParams(layout);
        }
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        webView.setDescendantFocusability(ViewGroup.FOCUS_BEFORE_DESCENDANTS);
        webView.requestFocus();
        activity.getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
    }
}
