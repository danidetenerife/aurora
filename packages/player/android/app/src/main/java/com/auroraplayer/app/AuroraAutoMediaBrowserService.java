package com.auroraplayer.app;

import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.support.v4.media.MediaBrowserCompat;
import android.support.v4.media.MediaDescriptionCompat;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Log;

import androidx.media.MediaBrowserServiceCompat;

import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * AuroraAutoMediaBrowserService
 *
 * Dedicated, isolated MediaBrowserService for Android Auto.
 * Provides media browsing and transport controls for the car display
 * without modifying or interfering with the existing mobile AudioForegroundService.
 */
public class AuroraAutoMediaBrowserService extends MediaBrowserServiceCompat {
    private static final String TAG = "AuroraAutoService";

    private static final String ROOT_ID = "__AURORA_AUTO_ROOT__";
    private static final String CATEGORY_NOW_PLAYING = "cat_now_playing";
    private static final String CATEGORY_FAVORITES = "cat_favorites";
    private static final String CATEGORY_PLAYLISTS = "cat_playlists";
    private static final String CATEGORY_QUEUE = "cat_queue";
    private static final String CATEGORY_PODCASTS = "cat_podcasts";
    private static final String ACTION_DISLIKE = "com.auroraplayer.ACTION_DISLIKE";

    private MediaSessionCompat fallbackSession;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.i(TAG, "AuroraAutoMediaBrowserService created");

        initSession();
        ensureAudioServiceRunning();
    }

    private void initSession() {
        AudioForegroundService afs = AudioForegroundService.getInstance();
        if (afs != null && afs.getMediaSession() != null) {
            Log.i(TAG, "Connecting directly to active AudioForegroundService MediaSession");
            setSessionToken(afs.getMediaSession().getSessionToken());
            return;
        }

        Log.i(TAG, "Initializing isolated fallback MediaSession for Android Auto");
        fallbackSession = new MediaSessionCompat(this, "AuroraAutoMediaSession");
        fallbackSession.setFlags(
            MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS |
            MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
        );

        Intent activityIntent = new Intent(this, MainActivity.class);
        int pFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent sessionActivity = PendingIntent.getActivity(this, 0, activityIntent, pFlags);
        fallbackSession.setSessionActivity(sessionActivity);

        fallbackSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                Log.i(TAG, "Auto Callback: onPlay");
                forwardActionToAudioService("com.auroraplayer.ACTION_PLAY_PAUSE", true);
            }

            @Override
            public void onPause() {
                Log.i(TAG, "Auto Callback: onPause");
                forwardActionToAudioService("com.auroraplayer.ACTION_PLAY_PAUSE", false);
            }

            @Override
            public void onSkipToNext() {
                Log.i(TAG, "Auto Callback: onSkipToNext");
                forwardActionToAudioService("com.auroraplayer.ACTION_NEXT", null);
            }

            @Override
            public void onSkipToPrevious() {
                Log.i(TAG, "Auto Callback: onSkipToPrevious");
                forwardActionToAudioService("com.auroraplayer.ACTION_PREVIOUS", null);
            }

            @Override
            public void onStop() {
                Log.i(TAG, "Auto Callback: onStop");
                forwardActionToAudioService("com.auroraplayer.ACTION_PLAY_PAUSE", false);
            }

            @Override
            public void onCustomAction(String action, Bundle extras) {
                if (ACTION_DISLIKE.equals(action)) {
                    NativeMediaSessionPlugin nms = NativeMediaSessionPlugin.getInstance();
                    if (nms != null) nms.notifyMediaAction("dislike", -1);
                }
            }

            @Override
            public void onPlayFromMediaId(String mediaId, Bundle extras) {
                Log.i(TAG, "Auto Callback: onPlayFromMediaId=" + mediaId);
                NativeMediaSessionPlugin nms = NativeMediaSessionPlugin.getInstance();
                if (nms != null) nms.notifyMediaAction(mediaId != null && mediaId.startsWith("podcast:") ? mediaId : "playid:" + mediaId, -1);
                forwardActionToAudioService("com.auroraplayer.ACTION_PLAY_PAUSE", true);
            }

            @Override
            public void onPlayFromSearch(String query, Bundle extras) {
                Log.i(TAG, "Auto Callback: onPlayFromSearch query=" + query);
                NativeMediaSessionPlugin nms = NativeMediaSessionPlugin.getInstance();
                if (nms != null) nms.notifyMediaAction("search:" + (query == null ? "" : query), -1);
            }
        });

        PlaybackStateCompat initialState = new PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY |
                PlaybackStateCompat.ACTION_PAUSE |
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
                PlaybackStateCompat.ACTION_PLAY_PAUSE |
                PlaybackStateCompat.ACTION_STOP
            )
            .setState(PlaybackStateCompat.STATE_PAUSED, 0, 1.0f)
            .addCustomAction(new PlaybackStateCompat.CustomAction.Builder(
                ACTION_DISLIKE, "No me gusta", R.drawable.ic_thumb_down
            ).build())
            .build();

        fallbackSession.setPlaybackState(initialState);
        fallbackSession.setActive(true);
        setSessionToken(fallbackSession.getSessionToken());
    }

    private void ensureAudioServiceRunning() {
        if (AudioForegroundService.getInstance() == null) {
            try {
                Intent serviceIntent = new Intent(this, AudioForegroundService.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(serviceIntent);
                } else {
                    startService(serviceIntent);
                }
            } catch (Throwable t) {
                Log.w(TAG, "Notice: AudioForegroundService start deferred", t);
            }
        }
    }

    private void forwardActionToAudioService(String action, Boolean targetPlay) {
        AudioForegroundService afs = AudioForegroundService.getInstance();
        if (afs != null) {
            if ("com.auroraplayer.ACTION_PLAY_PAUSE".equals(action)) {
                if (targetPlay != null) {
                    if (targetPlay) {
                        afs.resumeStream();
                    } else {
                        afs.pauseStream();
                    }
                }
            }
        }

        NativeMediaSessionPlugin nms = NativeMediaSessionPlugin.getInstance();
        if (nms != null) {
            if ("com.auroraplayer.ACTION_NEXT".equals(action)) {
                nms.notifyMediaAction("nexttrack", -1);
            } else if ("com.auroraplayer.ACTION_PREVIOUS".equals(action)) {
                nms.notifyMediaAction("previoustrack", -1);
            } else if ("com.auroraplayer.ACTION_PLAY_PAUSE".equals(action)) {
                nms.notifyMediaAction(targetPlay == null || targetPlay ? "play" : "pause", -1);
            }
        }

        try {
            Intent intent = new Intent(this, AudioForegroundService.class);
            intent.setAction(action);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent);
            } else {
                startService(intent);
            }
        } catch (Throwable t) {
            Log.w(TAG, "Failed to send action intent to AudioForegroundService: " + action, t);
        }
    }

    @Override
    public BrowserRoot onGetRoot(String clientPackageName, int clientUid, Bundle rootHints) {
        Log.i(TAG, "onGetRoot called by package: " + clientPackageName);

        AudioForegroundService afs = AudioForegroundService.getInstance();
        if (afs != null && afs.getMediaSession() != null) {
            try {
                setSessionToken(afs.getMediaSession().getSessionToken());
            } catch (Throwable ignored) {}
        }

        return new BrowserRoot(ROOT_ID, null);
    }

    @Override
    public void onLoadChildren(final String parentMediaId, final Result<List<MediaBrowserCompat.MediaItem>> result) {
        Log.i(TAG, "onLoadChildren parent=" + parentMediaId);
        List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();

        if (ROOT_ID.equals(parentMediaId)) {
            String currentTitle = "Reproducir música";
            String currentSubtitle = "Aurora";

            AudioForegroundService afs = AudioForegroundService.getInstance();
            if (afs != null && afs.getMediaSession() != null) {
                MediaMetadataCompat meta = afs.getMediaSession().getController().getMetadata();
                if (meta != null) {
                    CharSequence t = meta.getText(MediaMetadataCompat.METADATA_KEY_TITLE);
                    CharSequence a = meta.getText(MediaMetadataCompat.METADATA_KEY_ARTIST);
                    if (t != null && t.length() > 0) currentTitle = t.toString();
                    if (a != null && a.length() > 0) currentSubtitle = a.toString();
                }
            }

            MediaDescriptionCompat nowPlayingDesc = new MediaDescriptionCompat.Builder()
                .setMediaId(CATEGORY_NOW_PLAYING)
                .setTitle(currentTitle)
                .setSubtitle(currentSubtitle)
                .build();
            items.add(new MediaBrowserCompat.MediaItem(nowPlayingDesc, MediaBrowserCompat.MediaItem.FLAG_PLAYABLE));

            MediaDescriptionCompat favDesc = new MediaDescriptionCompat.Builder()
                .setMediaId(CATEGORY_FAVORITES)
                .setTitle("Favoritos")
                .setSubtitle("Canciones favoritas")
                .build();
            items.add(new MediaBrowserCompat.MediaItem(favDesc, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE));

            MediaDescriptionCompat playlistDesc = new MediaDescriptionCompat.Builder()
                .setMediaId(CATEGORY_PLAYLISTS)
                .setTitle("Listas de reproducción")
                .setSubtitle("Tus playlists")
                .build();
            items.add(new MediaBrowserCompat.MediaItem(playlistDesc, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE));

            MediaDescriptionCompat podcastsDesc = new MediaDescriptionCompat.Builder()
                .setMediaId(CATEGORY_PODCASTS)
                .setTitle("Podcasts")
                .setSubtitle("Podcasts favoritos y disponibles")
                .build();
            items.add(new MediaBrowserCompat.MediaItem(podcastsDesc, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE));

            MediaDescriptionCompat queueDesc = new MediaDescriptionCompat.Builder()
                .setMediaId(CATEGORY_QUEUE)
                .setTitle("Cola actual")
                .setSubtitle("Pistas en cola")
                .build();
            items.add(new MediaBrowserCompat.MediaItem(queueDesc, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE));
        } else if (CATEGORY_PODCASTS.equals(parentMediaId)) {
            addPodcast(items, "todopoderosos", "Todopoderosos", "Espacio Fundación Telefónica");
            addPodcast(items, "nude-project", "The Nude Project", "Nude Project");
            addPodcast(items, "historia-national", "Historia National Geographic", "National Geographic");
            addPodcast(items, "daily", "The Daily", "The New York Times");
            addPodcast(items, "serial", "Serial", "Serial Productions");
        } else if (CATEGORY_QUEUE.equals(parentMediaId) || CATEGORY_FAVORITES.equals(parentMediaId) || CATEGORY_PLAYLISTS.equals(parentMediaId)) {
            String json = getSharedPreferences("aurora_auto", MODE_PRIVATE).getString("catalog", "[]");
            try {
                JSONArray catalog = new JSONArray(json);
                for (int index = 0; index < catalog.length(); index++) {
                    JSONObject item = catalog.getJSONObject(index);
                    MediaDescriptionCompat description = new MediaDescriptionCompat.Builder()
                        .setMediaId(item.optString("id"))
                        .setTitle(item.optString("title", "Canción"))
                        .setSubtitle(item.optString("artist", ""))
                        .build();
                    items.add(new MediaBrowserCompat.MediaItem(description, MediaBrowserCompat.MediaItem.FLAG_PLAYABLE));
                }
            } catch (Exception error) {
                Log.w(TAG, "Invalid cached Auto catalog", error);
            }
        }

        result.sendResult(items);
    }

    private void addPodcast(List<MediaBrowserCompat.MediaItem> items, String id, String title, String publisher) {
        MediaDescriptionCompat description = new MediaDescriptionCompat.Builder()
            .setMediaId("podcast:" + id)
            .setTitle(title)
            .setSubtitle(publisher)
            .build();
        items.add(new MediaBrowserCompat.MediaItem(description, MediaBrowserCompat.MediaItem.FLAG_PLAYABLE));
    }

    @Override
    public void onSearch(String query, Bundle extras, Result<List<MediaBrowserCompat.MediaItem>> result) {
        List<MediaBrowserCompat.MediaItem> matches = new ArrayList<>();
        String normalized = query == null ? "" : query.toLowerCase();
        String json = getSharedPreferences("aurora_auto", MODE_PRIVATE).getString("catalog", "[]");
        try {
            JSONArray catalog = new JSONArray(json);
            for (int index = 0; index < catalog.length(); index++) {
                JSONObject item = catalog.getJSONObject(index);
                String title = item.optString("title", "");
                String artist = item.optString("artist", "");
                if (title.toLowerCase().contains(normalized) || artist.toLowerCase().contains(normalized)) {
                    MediaDescriptionCompat description = new MediaDescriptionCompat.Builder()
                        .setMediaId(item.optString("id"))
                        .setTitle(title).setSubtitle(artist).build();
                    matches.add(new MediaBrowserCompat.MediaItem(description, MediaBrowserCompat.MediaItem.FLAG_PLAYABLE));
                }
            }
        } catch (Exception error) { Log.w(TAG, "Invalid Auto search catalog", error); }
        result.sendResult(matches);
    }

    @Override
    public void onDestroy() {
        if (fallbackSession != null) {
            fallbackSession.setActive(false);
            fallbackSession.release();
            fallbackSession = null;
        }
        super.onDestroy();
    }
}
