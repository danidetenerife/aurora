package com.auroraplayer.app;

import android.content.Context;
import android.os.SystemClock;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.FrameLayout;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.Test;
import org.junit.runner.RunWith;

import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;

@RunWith(AndroidJUnit4.class)
public class ExtractionWebViewTest {
    private static final int TAP_POSITION = 50;

    @Test
    public void extractionDoesNotBlockUnderlyingControlsOrStealFocus() {
        AtomicInteger clicks = new AtomicInteger();
        ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class);
        scenario.onActivity(activity -> {
            Context context = activity;
            FrameLayout root = new FrameLayout(context);
            Button control = new Button(context);
            control.setFocusableInTouchMode(false);
            control.setOnClickListener(view -> clicks.incrementAndGet());
            root.addView(control, new FrameLayout.LayoutParams(
                ExtractionWebView.VIEW_WIDTH, ExtractionWebView.VIEW_HEIGHT));
            ExtractionWebView extraction = new ExtractionWebView(context);
            root.addView(extraction, new FrameLayout.LayoutParams(
                ExtractionWebView.VIEW_WIDTH, ExtractionWebView.VIEW_HEIGHT));
            ViewGroup content = activity.findViewById(android.R.id.content);
            content.addView(root);
            root.measure(
                View.MeasureSpec.makeMeasureSpec(ExtractionWebView.VIEW_WIDTH, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(ExtractionWebView.VIEW_HEIGHT, View.MeasureSpec.EXACTLY));
            root.layout(0, 0, ExtractionWebView.VIEW_WIDTH, ExtractionWebView.VIEW_HEIGHT);

            long eventTime = SystemClock.uptimeMillis();
            MotionEvent down = MotionEvent.obtain(eventTime, eventTime,
                MotionEvent.ACTION_DOWN, TAP_POSITION, TAP_POSITION, 0);
            MotionEvent up = MotionEvent.obtain(eventTime, eventTime,
                MotionEvent.ACTION_UP, TAP_POSITION, TAP_POSITION, 0);
            root.dispatchTouchEvent(down);
            root.dispatchTouchEvent(up);

            assertFalse(extraction.requestFocus());
            assertEquals(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS,
                extraction.getImportantForAccessibility());
            down.recycle();
            up.recycle();
            root.removeView(extraction);
            extraction.destroy();
        });
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        assertEquals(1, clicks.get());
        scenario.close();
    }
}
