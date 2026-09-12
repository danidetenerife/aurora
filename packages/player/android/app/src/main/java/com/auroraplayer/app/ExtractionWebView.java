package com.auroraplayer.app;

import android.content.Context;
import android.view.MotionEvent;
import android.view.View;
import android.webkit.WebView;

final class ExtractionWebView extends WebView {
    static final int VIEW_WIDTH = 300;
    static final int VIEW_HEIGHT = 200;

    ExtractionWebView(Context context) {
        super(context);
        setAlpha(0.01f);
        setFocusable(false);
        setFocusableInTouchMode(false);
        setDescendantFocusability(FOCUS_BLOCK_DESCENDANTS);
        setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
    }

    @Override
    public boolean dispatchTouchEvent(MotionEvent event) {
        return false;
    }
}
