package com.auroraplayer.app;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.support.v4.media.session.MediaSessionCompat;

public final class AuroraMediaSessionHolder {
    private static volatile MediaSessionCompat mediaSession;

    private AuroraMediaSessionHolder() {}

    public static MediaSessionCompat getOrCreateSession(Context context) {
        if (mediaSession == null) {
            synchronized (AuroraMediaSessionHolder.class) {
                if (mediaSession == null) {
                    Context appContext = context.getApplicationContext();
                    MediaSessionCompat session = new MediaSessionCompat(appContext, "AuroraPlaybackSession");
                    session.setFlags(
                        MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS |
                        MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
                    );

                    Intent activityIntent = new Intent(appContext, MainActivity.class);
                    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        flags |= PendingIntent.FLAG_IMMUTABLE;
                    }
                    PendingIntent sessionActivity = PendingIntent.getActivity(appContext, 0, activityIntent, flags);
                    session.setSessionActivity(sessionActivity);
                    session.setActive(true);

                    mediaSession = session;
                }
            }
        }
        return mediaSession;
    }

    public static MediaSessionCompat getSession() {
        return mediaSession;
    }
}
