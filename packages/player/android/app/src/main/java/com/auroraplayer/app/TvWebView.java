package com.auroraplayer.app;

import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebSettings;
import android.webkit.WebView;

final class TvWebView {
    private static final String TV_USER_AGENT = YtStreamExtractorPlugin.MOBILE_UA + " Aurora GoogleTV";

    static boolean isTelevision(Context context) {
        int mode = context.getResources().getConfiguration().uiMode & Configuration.UI_MODE_TYPE_MASK;
        return mode == Configuration.UI_MODE_TYPE_TELEVISION
            || context.getPackageName().equals("com.auroraplayer.app.tvpreview")
            || context.getPackageManager().hasSystemFeature(PackageManager.FEATURE_LEANBACK);
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
