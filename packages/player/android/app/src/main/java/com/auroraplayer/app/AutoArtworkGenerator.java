package com.auroraplayer.app;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;

public final class AutoArtworkGenerator {
    private static final int CANVAS_SIZE = 512;
    private static final int SCRIM_START_Y = 240;

    private static final int[][] GRADIENTS = new int[][] {
        { Color.parseColor("#0F172A"), Color.parseColor("#0EA5E9") },
        { Color.parseColor("#280A0F"), Color.parseColor("#E11D48") },
        { Color.parseColor("#78350F"), Color.parseColor("#F59E0B") },
        { Color.parseColor("#4C1D95"), Color.parseColor("#EC4899") },
        { Color.parseColor("#134E4A"), Color.parseColor("#6366F1") },
        { Color.parseColor("#9F1239"), Color.parseColor("#FB923C") },
        { Color.parseColor("#1E1B4B"), Color.parseColor("#D946EF") },
        { Color.parseColor("#0A0A0F"), Color.parseColor("#10B981") },
        { Color.parseColor("#881337"), Color.parseColor("#EAB308") },
        { Color.parseColor("#1E3A8A"), Color.parseColor("#06B6D4") },
        { Color.parseColor("#312E81"), Color.parseColor("#8B5CF6") },
        { Color.parseColor("#18181B"), Color.parseColor("#F43F5E") }
    };

    private AutoArtworkGenerator() {}

    public static Bitmap generateCover(String title, String subtitle, String badge) {
        Bitmap bitmap = Bitmap.createBitmap(CANVAS_SIZE, CANVAS_SIZE, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);

        int hash = Math.abs(title != null ? title.hashCode() : 0);
        int[] palette = GRADIENTS[hash % GRADIENTS.length];

        Paint bgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        bgPaint.setShader(new LinearGradient(
            0, 0, CANVAS_SIZE, CANVAS_SIZE,
            palette[0], palette[1],
            Shader.TileMode.CLAMP
        ));
        canvas.drawRect(0, 0, CANVAS_SIZE, CANVAS_SIZE, bgPaint);

        drawDecorativeMotif(canvas, hash);

        drawBottomScrim(canvas);

        drawHeader(canvas, badge != null ? badge : "AURORA");

        drawTitleAndSubtitle(canvas, title, subtitle);

        drawBorder(canvas);

        return bitmap;
    }

    private static void drawDecorativeMotif(Canvas canvas, int hash) {
        Paint motifPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        motifPaint.setColor(Color.WHITE);
        motifPaint.setStyle(Paint.Style.STROKE);

        int pattern = hash % 3;
        if (pattern == 0) {
            motifPaint.setAlpha(20);
            motifPaint.setStrokeWidth(3f);
            for (int radius = 70; radius <= 310; radius += 40) {
                canvas.drawCircle(256, 256, radius, motifPaint);
            }
        } else if (pattern == 1) {
            motifPaint.setAlpha(18);
            motifPaint.setStrokeWidth(16f);
            for (int offset = -100; offset <= 600; offset += 80) {
                canvas.drawLine(offset, -50, offset + 250, CANVAS_SIZE + 50, motifPaint);
            }
        } else {
            motifPaint.setAlpha(22);
            motifPaint.setStrokeWidth(4f);
            for (int step = 0; step < 5; step++) {
                int size = 50 + step * 45;
                Path path = new Path();
                path.moveTo(256, 220 - size);
                path.lineTo(256 + size, 220);
                path.lineTo(256, 220 + size);
                path.lineTo(256 - size, 220);
                path.close();
                canvas.drawPath(path, motifPaint);
            }
        }
    }

    private static void drawBottomScrim(Canvas canvas) {
        Paint scrimPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        scrimPaint.setShader(new LinearGradient(
            0, SCRIM_START_Y, 0, CANVAS_SIZE,
            Color.TRANSPARENT, Color.argb(220, 10, 10, 15),
            Shader.TileMode.CLAMP
        ));
        canvas.drawRect(0, SCRIM_START_Y, CANVAS_SIZE, CANVAS_SIZE, scrimPaint);
    }

    private static void drawHeader(Canvas canvas, String badge) {
        Paint brandPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        brandPaint.setColor(Color.argb(200, 255, 255, 255));
        brandPaint.setTextSize(16f);
        brandPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        canvas.drawText("AURORA AUTO", 40, 50, brandPaint);

        Paint badgeBg = new Paint(Paint.ANTI_ALIAS_FLAG);
        badgeBg.setColor(Color.argb(45, 255, 255, 255));
        badgeBg.setStyle(Paint.Style.FILL);

        Paint badgeBorder = new Paint(Paint.ANTI_ALIAS_FLAG);
        badgeBorder.setColor(Color.argb(120, 255, 255, 255));
        badgeBorder.setStyle(Paint.Style.STROKE);
        badgeBorder.setStrokeWidth(1.5f);

        Paint badgeText = new Paint(Paint.ANTI_ALIAS_FLAG);
        badgeText.setColor(Color.WHITE);
        badgeText.setTextSize(18f);
        badgeText.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));

        Rect bounds = new Rect();
        badgeText.getTextBounds(badge, 0, badge.length(), bounds);
        int badgeWidth = bounds.width() + 24;
        int badgeHeight = bounds.height() + 14;
        int badgeX = CANVAS_SIZE - 40 - badgeWidth;
        int badgeY = 32;

        RectF rect = new RectF(badgeX, badgeY, badgeX + badgeWidth, badgeY + badgeHeight);
        canvas.drawRoundRect(rect, 8f, 8f, badgeBg);
        canvas.drawRoundRect(rect, 8f, 8f, badgeBorder);
        canvas.drawText(badge, badgeX + 12, badgeY + bounds.height() + 5, badgeText);
    }

    private static void drawTitleAndSubtitle(Canvas canvas, String title, String subtitle) {
        Paint titlePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        titlePaint.setColor(Color.WHITE);
        titlePaint.setTextSize(38f);
        titlePaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));

        Paint shadowPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        shadowPaint.setColor(Color.argb(180, 0, 0, 0));
        shadowPaint.setTextSize(38f);
        shadowPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));

        Paint subPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        subPaint.setColor(Color.argb(220, 210, 220, 235));
        subPaint.setTextSize(20f);
        subPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.NORMAL));

        String safeTitle = title != null ? title : "";
        String safeSub = subtitle != null ? subtitle : "";

        String[] words = safeTitle.split(" ");
        StringBuilder firstLine = new StringBuilder();
        StringBuilder secondLine = new StringBuilder();

        for (String word : words) {
            String test = (firstLine.length() == 0 ? word : firstLine + " " + word);
            if (titlePaint.measureText(test) < 430 && secondLine.length() == 0) {
                firstLine = new StringBuilder(test);
            } else {
                if (secondLine.length() > 0) secondLine.append(" ");
                secondLine.append(word);
            }
        }

        int startY = (secondLine.length() > 0) ? 400 : 430;

        canvas.drawText(firstLine.toString(), 42, startY + 2, shadowPaint);
        canvas.drawText(firstLine.toString(), 40, startY, titlePaint);

        if (secondLine.length() > 0) {
            canvas.drawText(secondLine.toString(), 42, startY + 44 + 2, shadowPaint);
            canvas.drawText(secondLine.toString(), 40, startY + 44, titlePaint);
            canvas.drawText(safeSub, 40, startY + 44 + 32, subPaint);
        } else {
            canvas.drawText(safeSub, 40, startY + 34, subPaint);
        }
    }

    private static void drawBorder(Canvas canvas) {
        Paint borderPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        borderPaint.setColor(Color.argb(40, 255, 255, 255));
        borderPaint.setStyle(Paint.Style.STROKE);
        borderPaint.setStrokeWidth(2f);
        canvas.drawRect(0, 0, CANVAS_SIZE - 1, CANVAS_SIZE - 1, borderPaint);
    }
}
