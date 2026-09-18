package com.auroraplayer.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Binder;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.util.Log;
import android.support.v4.media.MediaDescriptionCompat;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import androidx.core.app.NotificationCompat;
import androidx.media.session.MediaButtonReceiver;
import android.media.MediaPlayer;
import android.net.Uri;

import java.util.ArrayList;
import java.util.List;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import android.content.Context;
import android.net.wifi.WifiManager;
import android.os.PowerManager;

public class AudioForegroundService extends Service {
    private static final String TAG = "AudioForegroundService";
    public static final String CHANNEL_ID = "aurora_media_playback_v5";
    public static final String ACTION_UPDATE_METADATA = "com.auroraplayer.UPDATE_METADATA";
    public static final String ACTION_UPDATE_PLAYBACK_STATE = "com.auroraplayer.UPDATE_PLAYBACK_STATE";
    public static final String ACTION_UPDATE_POSITION = "com.auroraplayer.UPDATE_POSITION";
    public static final String ACTION_DISLIKE = "com.auroraplayer.ACTION_DISLIKE";
    public static final String ACTION_FAVORITE_ADD = "com.auroraplayer.ACTION_FAVORITE_ADD";
    public static final String ACTION_FAVORITE_REMOVE = "com.auroraplayer.ACTION_FAVORITE_REMOVE";
    public static final String ACTION_REWIND_15 = "com.auroraplayer.ACTION_REWIND_15";
    public static final String ACTION_FORWARD_30 = "com.auroraplayer.ACTION_FORWARD_30";
    public static final String ACTION_PLAYBACK_SPEED = "com.auroraplayer.ACTION_PLAYBACK_SPEED";

    private static final int NOTIFICATION_ID = 1;

    private final IBinder binder = new LocalBinder();
    private MediaSessionCompat mediaSession;
    private PowerManager.WakeLock serviceWakeLock;
    private WifiManager.WifiLock serviceWifiLock;
    private String currentTitle = "Aurora";
    private String currentArtist = "Reproductor de música";
    private String currentAlbum = "";
    private String currentArtworkUrl = "";
    private Bitmap currentArtworkBitmap = null;
    private long currentDurationMs = 0;
    private boolean currentIsFavorite = false;
    private boolean currentIsPodcast = false;
    private float currentPlaybackSpeed = 1.0f;
    private final ExecutorService artworkExecutor = Executors.newSingleThreadExecutor();

    private boolean currentlyPlaying = false;
    private android.telephony.TelephonyManager telephonyManager;
    private android.telephony.PhoneStateListener phoneStateListener;
    private boolean phoneCallListenerRegistered = false;

    @SuppressWarnings("deprecation")
    private void registerPhoneCallListener() {
        if (phoneCallListenerRegistered) return;
        if (TvWebView.isTelevision(this)) return;
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M &&
            checkSelfPermission(android.Manifest.permission.READ_PHONE_STATE) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            Log.i(TAG, "READ_PHONE_STATE not granted yet, skipping phone call listener");
            return;
        }
        telephonyManager = (android.telephony.TelephonyManager) getSystemService(Context.TELEPHONY_SERVICE);
        if (telephonyManager == null) return;

        phoneStateListener = new android.telephony.PhoneStateListener() {
                @Override
                public void onCallStateChanged(int state, String phoneNumber) {
                    handleCallState(state);
                }
            };
        telephonyManager.listen(phoneStateListener,
            android.telephony.PhoneStateListener.LISTEN_CALL_STATE);
        phoneCallListenerRegistered = true;
        Log.i(TAG, "Phone call listener registered successfully");
    }

    private void handleCallState(int state) {
        switch (state) {
            case android.telephony.TelephonyManager.CALL_STATE_RINGING:
            case android.telephony.TelephonyManager.CALL_STATE_OFFHOOK:
                notifyJsMediaAction("callstart");
                setOptimisticPlaybackState(false);
                break;
            case android.telephony.TelephonyManager.CALL_STATE_IDLE:
                notifyJsMediaAction("callend");
                break;
        }
    }

    private static AudioForegroundService instance;

    public class LocalBinder extends Binder {
        AudioForegroundService getService() {
            return AudioForegroundService.this;
        }
    }

    public static AudioForegroundService getInstance() {
        return instance;
    }

    public MediaPlayer getMediaPlayer() {
        return null;
    }

    public synchronized void playStream(String url, long positionMs) {
        setOptimisticPlaybackState(true);
    }

    public synchronized void pauseStream() {
        setOptimisticPlaybackState(false);
    }

    public synchronized void resumeStream() {
        setOptimisticPlaybackState(true);
    }

    public synchronized void seekStream(long positionMs) {
        // Handled via JS
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        acquireLocks();
        createNotificationChannel();
        initMediaSession();

        AuroraAutoMediaBrowserService autoService = AuroraAutoMediaBrowserService.getInstance();
        if (autoService != null && mediaSession != null) {
            autoService.setSessionToken(mediaSession.getSessionToken());
        }
    }

    private void acquireLocks() {
        try {
            PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (powerManager != null && serviceWakeLock == null) {
                serviceWakeLock = powerManager.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "Aurora::ServiceAudioWakeLock"
                );
                serviceWakeLock.setReferenceCounted(false);
                serviceWakeLock.acquire();
            }

            WifiManager wifiManager = (WifiManager) getApplicationContext()
                .getSystemService(Context.WIFI_SERVICE);
            if (wifiManager != null && serviceWifiLock == null) {
                serviceWifiLock = wifiManager.createWifiLock(
                    WifiManager.WIFI_MODE_FULL_HIGH_PERF,
                    "Aurora::ServiceAudioWifiLock"
                );
                serviceWifiLock.setReferenceCounted(false);
                serviceWifiLock.acquire();
            }
        } catch (Throwable t) {}
    }

    private void initMediaSession() {
        mediaSession = AuroraMediaSessionHolder.getOrCreateSession(this);

        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                resumeStream();
                setOptimisticPlaybackState(true);
                notifyJsMediaAction("play");
            }

            @Override
            public void onPause() {
                pauseStream();
                setOptimisticPlaybackState(false);
                notifyJsMediaAction("pause");
            }

            @Override
            public void onSkipToNext() {
                notifyJsMediaAction("nexttrack");
            }

            @Override
            public void onSkipToPrevious() {
                notifyJsMediaAction("previoustrack");
            }

            @Override
            public void onStop() {
                pauseStream();
                setOptimisticPlaybackState(false);
                notifyJsMediaAction("stop");
            }

            @Override
            public void onCustomAction(String action, Bundle extras) {
                if (ACTION_FAVORITE_ADD.equals(action)) {
                    currentIsFavorite = true;
                    refreshPlaybackStateImmediately();
                    notifyJsMediaAction("favorite_add");
                } else if (ACTION_FAVORITE_REMOVE.equals(action)) {
                    currentIsFavorite = false;
                    refreshPlaybackStateImmediately();
                    notifyJsMediaAction("favorite_remove");
                } else if (ACTION_REWIND_15.equals(action)) {
                    handleRewind15();
                } else if (ACTION_FORWARD_30.equals(action)) {
                    handleForward30();
                } else if (ACTION_PLAYBACK_SPEED.equals(action)) {
                    cyclePlaybackSpeed();
                } else if (ACTION_DISLIKE.equals(action)) {
                    notifyJsMediaAction("dislike");
                }
            }

            @Override
            public void onFastForward() {
                handleForward30();
            }

            @Override
            public void onRewind() {
                handleRewind15();
            }

            @Override
            public void onSeekTo(long pos) {
                seekStream(pos);
                NativeMediaSessionPlugin.queueOrDispatchMediaAction(AudioForegroundService.this, "seekto", pos);
            }

            @Override
            public void onPlayFromMediaId(String mediaId, Bundle extras) {
                setBufferingStateWithMetadata(mediaId);

                if (mediaId != null) {
                    String action = mediaId.startsWith("playid:") || mediaId.startsWith("podcast:") || mediaId.startsWith("playlist:") || mediaId.startsWith("playlist_play:") || mediaId.startsWith("search_play:") ? mediaId : "playid:" + mediaId;
                    NativeMediaSessionPlugin.queueOrDispatchMediaAction(AudioForegroundService.this, action, -1);
                }
            }

            @Override
            public void onPlayFromSearch(String query, Bundle extras) {
                setBufferingStateWithMetadata("search:" + (query == null ? "" : query));
                NativeMediaSessionPlugin.queueOrDispatchMediaAction(AudioForegroundService.this, "search:" + (query == null ? "" : query), -1);
            }
        });

        mediaSession.setActive(true);

        try {
            registerPhoneCallListener();
        } catch (Throwable t) {
            Log.w(TAG, "Failed to register phone call listener", t);
        }

        PlaybackStateCompat initialState = new PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY |
                PlaybackStateCompat.ACTION_PAUSE |
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
                PlaybackStateCompat.ACTION_SEEK_TO |
                PlaybackStateCompat.ACTION_PLAY_PAUSE |
                PlaybackStateCompat.ACTION_PLAY_FROM_MEDIA_ID |
                PlaybackStateCompat.ACTION_PLAY_FROM_SEARCH |
                PlaybackStateCompat.ACTION_STOP
            )
            .setState(PlaybackStateCompat.STATE_PAUSED, 0, 1.0f)
            .addCustomAction(new PlaybackStateCompat.CustomAction.Builder(
                ACTION_DISLIKE, "No me gusta", R.drawable.ic_thumb_down
            ).build())
            .build();
        mediaSession.setPlaybackState(initialState);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification notification = buildNotification("Aurora", "", false);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Throwable firstError) {
            try {
                startForeground(NOTIFICATION_ID, notification);
            } catch (Throwable ignored) {}
        }

        if (intent != null) {
            String action = intent.getAction();
            Log.i(TAG, "onStartCommand action=" + action);

            if (!phoneCallListenerRegistered) {
                try { registerPhoneCallListener(); } catch (Throwable ignored) {}
            }

            if (ACTION_UPDATE_METADATA.equals(action)) {
                handleMetadataUpdate(intent);
                return START_STICKY;
            } else if (ACTION_UPDATE_PLAYBACK_STATE.equals(action)) {
                handlePlaybackStateUpdate(intent);
                return START_STICKY;
            } else if (ACTION_UPDATE_POSITION.equals(action)) {
                handlePositionUpdate(intent);
                return START_STICKY;
            } else if ("com.auroraplayer.ACTION_PREVIOUS".equals(action)) {
                notifyJsMediaAction("previoustrack");
                return START_STICKY;
            } else if ("com.auroraplayer.ACTION_PLAY_PAUSE".equals(action)) {
                PlaybackStateCompat state = mediaSession.getController().getPlaybackState();
                boolean isPlaying = state != null && state.getState() == PlaybackStateCompat.STATE_PLAYING;
                boolean targetPlaying = !isPlaying;
                setOptimisticPlaybackState(targetPlaying);
                notifyJsMediaAction(targetPlaying ? "play" : "pause");
                return START_STICKY;
            } else if ("com.auroraplayer.ACTION_NEXT".equals(action)) {
                notifyJsMediaAction("nexttrack");
                return START_STICKY;
            }

            MediaButtonReceiver.handleIntent(mediaSession, intent);
        }
        return START_STICKY;
    }

    private void handleMetadataUpdate(Intent intent) {
        String title = intent.getStringExtra("title");
        String artist = intent.getStringExtra("artist");
        String album = intent.getStringExtra("album");
        String artworkUrl = intent.getStringExtra("artworkUrl");
        long durationMs = intent.getLongExtra("durationMs", 0);

        boolean isFavorite = intent.getBooleanExtra("isFavorite", false);
        boolean isPodcast = intent.getBooleanExtra("isPodcast", false);
        currentIsFavorite = isFavorite;
        currentIsPodcast = isPodcast;

        String newTitle = (title != null && !title.trim().isEmpty()) ? title.trim() : currentTitle;
        String newArtist = (artist != null && !artist.trim().isEmpty()) ? artist.trim() : currentArtist;
        String rawAlbum = (album != null && !album.trim().isEmpty()) ? album.trim() : "";
        String newAlbum = rawAlbum.isEmpty() ? newArtist : rawAlbum;

        boolean metadataChanged = !newTitle.equals(currentTitle) || !newArtist.equals(currentArtist)
            || !newAlbum.equals(currentAlbum) || (durationMs > 0 && durationMs != currentDurationMs);

        if (!metadataChanged && (artworkUrl == null || artworkUrl.equals(currentArtworkUrl))) {
            return;
        }

        Log.i(TAG, "handleMetadataUpdate: title='" + newTitle + "' artist='" + newArtist
            + "' album='" + newAlbum + "' durationMs=" + durationMs);

        currentTitle = newTitle;
        currentArtist = newArtist;
        currentAlbum = newAlbum;
        if (durationMs > 0) {
            currentDurationMs = durationMs;
        }

        String mediaId = "track:" + (currentTitle + "_" + currentArtist).replaceAll("[^a-zA-Z0-9_]+", "_");

        MediaMetadataCompat.Builder metadataBuilder = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_MEDIA_ID, mediaId)
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_TITLE, currentTitle)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_SUBTITLE, currentArtist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, currentAlbum)
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_DESCRIPTION, currentAlbum);

        if (currentDurationMs > 0) {
            metadataBuilder.putLong(MediaMetadataCompat.METADATA_KEY_DURATION, currentDurationMs);
        }

        Uri artUri = (artworkUrl != null && !artworkUrl.isEmpty())
            ? ArtworkContentProvider.getRemoteUri(artworkUrl)
            : ArtworkContentProvider.getGeneratedUri(currentTitle, currentArtist, "AURORA");
        Bitmap artBitmap = (currentArtworkBitmap != null)
            ? currentArtworkBitmap
            : AutoArtworkGenerator.generateCover(currentTitle, currentArtist, "AURORA");

        metadataBuilder.putString(MediaMetadataCompat.METADATA_KEY_ALBUM_ART_URI, artUri.toString());
        metadataBuilder.putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON_URI, artUri.toString());
        metadataBuilder.putString(MediaMetadataCompat.METADATA_KEY_ART_URI, artUri.toString());

        if (artBitmap != null) {
            metadataBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, artBitmap);
            metadataBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, artBitmap);
            metadataBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON, artBitmap);
        }

        mediaSession.setMetadata(metadataBuilder.build());

        MediaDescriptionCompat queueDesc = new MediaDescriptionCompat.Builder()
            .setMediaId(mediaId)
            .setTitle(currentTitle)
            .setSubtitle(currentArtist)
            .setDescription(currentAlbum)
            .setIconUri(artUri)
            .setIconBitmap(artBitmap)
            .build();
        List<MediaSessionCompat.QueueItem> queueItems = new ArrayList<>();
        queueItems.add(new MediaSessionCompat.QueueItem(queueDesc, 0));
        mediaSession.setQueue(queueItems);
        mediaSession.setQueueTitle("Aurora - Ahora Suena");

        updateNotification(title, artist);

        if (artworkUrl != null && !artworkUrl.isEmpty() && !artworkUrl.equals(currentArtworkUrl)) {
            currentArtworkUrl = artworkUrl;
            final String finalTitle = title;
            final String finalArtist = artist;
            final String finalAlbum = album;

            artworkExecutor.execute(() -> {
                Bitmap bitmap = downloadBitmap(artworkUrl);
                if (bitmap != null && artworkUrl.equals(currentArtworkUrl)) {
                    currentArtworkBitmap = bitmap;

                    String safeArtUri = ArtworkContentProvider.getRemoteUri(artworkUrl).toString();
                    MediaMetadataCompat.Builder updatedMetadataBuilder = new MediaMetadataCompat.Builder()
                        .putString(MediaMetadataCompat.METADATA_KEY_MEDIA_ID, mediaId)
                        .putString(MediaMetadataCompat.METADATA_KEY_TITLE, finalTitle)
                        .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_TITLE, finalTitle)
                        .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, finalArtist)
                        .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_SUBTITLE, finalArtist)
                        .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, finalAlbum)
                        .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_DESCRIPTION, finalAlbum)
                        .putString(MediaMetadataCompat.METADATA_KEY_ALBUM_ART_URI, safeArtUri)
                        .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON_URI, safeArtUri)
                        .putString(MediaMetadataCompat.METADATA_KEY_ART_URI, safeArtUri)
                        .putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, bitmap)
                        .putBitmap(MediaMetadataCompat.METADATA_KEY_ART, bitmap)
                        .putBitmap(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON, bitmap);

                    if (currentDurationMs > 0) {
                        updatedMetadataBuilder.putLong(MediaMetadataCompat.METADATA_KEY_DURATION, currentDurationMs);
                    }

                    mediaSession.setMetadata(updatedMetadataBuilder.build());

                    MediaDescriptionCompat updatedQueueDesc = new MediaDescriptionCompat.Builder()
                        .setMediaId(mediaId)
                        .setTitle(finalTitle)
                        .setSubtitle(finalArtist)
                        .setDescription(finalAlbum)
                        .setIconUri(Uri.parse(safeArtUri))
                        .setIconBitmap(bitmap)
                        .build();
                    List<MediaSessionCompat.QueueItem> updatedQueueItems = new ArrayList<>();
                    updatedQueueItems.add(new MediaSessionCompat.QueueItem(updatedQueueDesc, 0));
                    mediaSession.setQueue(updatedQueueItems);

                    updateNotification(finalTitle, finalArtist);
                }
            });
        }
    }

    private static final long SUPPORTED_ACTIONS =
        PlaybackStateCompat.ACTION_PLAY |
        PlaybackStateCompat.ACTION_PAUSE |
        PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
        PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
        PlaybackStateCompat.ACTION_SEEK_TO |
        PlaybackStateCompat.ACTION_PLAY_PAUSE |
        PlaybackStateCompat.ACTION_PLAY_FROM_MEDIA_ID |
        PlaybackStateCompat.ACTION_PLAY_FROM_SEARCH |
        PlaybackStateCompat.ACTION_FAST_FORWARD |
        PlaybackStateCompat.ACTION_REWIND |
        PlaybackStateCompat.ACTION_STOP;

    private PlaybackStateCompat.Builder newPlaybackStateBuilder() {
        PlaybackStateCompat.Builder builder = new PlaybackStateCompat.Builder()
            .setActions(SUPPORTED_ACTIONS)
            .setActiveQueueItemId(0);

        if (currentIsFavorite) {
            builder.addCustomAction(new PlaybackStateCompat.CustomAction.Builder(
                ACTION_FAVORITE_REMOVE, "Quitar de favoritos", R.drawable.ic_heart_filled
            ).build());
        } else {
            builder.addCustomAction(new PlaybackStateCompat.CustomAction.Builder(
                ACTION_FAVORITE_ADD, "Me gusta", R.drawable.ic_heart_outline
            ).build());
        }

        if (currentIsPodcast) {
            builder.addCustomAction(new PlaybackStateCompat.CustomAction.Builder(
                ACTION_REWIND_15, "-15 seg", R.drawable.ic_replay_15
            ).build());
            builder.addCustomAction(new PlaybackStateCompat.CustomAction.Builder(
                ACTION_FORWARD_30, "+30 seg", R.drawable.ic_forward_30
            ).build());
            builder.addCustomAction(new PlaybackStateCompat.CustomAction.Builder(
                ACTION_PLAYBACK_SPEED, String.format(java.util.Locale.US, "%.2fx", currentPlaybackSpeed), R.drawable.ic_speed
            ).build());
        } else {
            builder.addCustomAction(new PlaybackStateCompat.CustomAction.Builder(
                ACTION_DISLIKE, "No me gusta", R.drawable.ic_thumb_down
            ).build());
        }

        return builder;
    }

    private void refreshPlaybackStateImmediately() {
        if (mediaSession == null) return;
        PlaybackStateCompat state = mediaSession.getController().getPlaybackState();
        int stateCode = state != null ? state.getState() : PlaybackStateCompat.STATE_PAUSED;
        long pos = state != null ? state.getPosition() : 0;
        float rate = state != null ? state.getPlaybackSpeed() : 0f;
        mediaSession.setPlaybackState(newPlaybackStateBuilder().setState(stateCode, pos, rate).build());
    }

    private void handleRewind15() {
        PlaybackStateCompat state = mediaSession != null ? mediaSession.getController().getPlaybackState() : null;
        long currentPos = state != null ? state.getPosition() : 0;
        long newPos = Math.max(0, currentPos - 15000);
        seekStream(newPos);
        NativeMediaSessionPlugin nms = NativeMediaSessionPlugin.getInstance();
        if (nms != null) nms.notifyMediaAction("seekto", newPos);
    }

    private void handleForward30() {
        PlaybackStateCompat state = mediaSession != null ? mediaSession.getController().getPlaybackState() : null;
        long currentPos = state != null ? state.getPosition() : 0;
        long newPos = currentPos + 30000;
        seekStream(newPos);
        NativeMediaSessionPlugin nms = NativeMediaSessionPlugin.getInstance();
        if (nms != null) nms.notifyMediaAction("seekto", newPos);
    }

    private void cyclePlaybackSpeed() {
        if (currentPlaybackSpeed == 1.0f) currentPlaybackSpeed = 1.25f;
        else if (currentPlaybackSpeed == 1.25f) currentPlaybackSpeed = 1.5f;
        else if (currentPlaybackSpeed == 1.5f) currentPlaybackSpeed = 2.0f;
        else currentPlaybackSpeed = 1.0f;
        refreshPlaybackStateImmediately();
        NativeMediaSessionPlugin nms = NativeMediaSessionPlugin.getInstance();
        if (nms != null) nms.notifyMediaAction("speed_" + currentPlaybackSpeed, -1);
    }

    private void handlePlaybackStateUpdate(Intent intent) {
        boolean isPlaying = intent.getBooleanExtra("isPlaying", false);
        long positionMs = intent.getLongExtra("positionMs", 0);

        boolean stateChanged = isPlaying != currentlyPlaying;
        if (stateChanged) {
            currentlyPlaying = isPlaying;
        }

        int state = isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;

        PlaybackStateCompat playbackState = newPlaybackStateBuilder()
            .setState(state, positionMs, isPlaying ? 1.0f : 0f)
            .build();

        mediaSession.setPlaybackState(playbackState);

        if (stateChanged) {
            MediaMetadataCompat metadata = mediaSession.getController().getMetadata();
            String title = "";
            String artist = "";
            if (metadata != null) {
                CharSequence titleCs = metadata.getText(MediaMetadataCompat.METADATA_KEY_TITLE);
                CharSequence artistCs = metadata.getText(MediaMetadataCompat.METADATA_KEY_ARTIST);
                if (titleCs != null) title = titleCs.toString();
                if (artistCs != null) artist = artistCs.toString();
            }
            updateNotification(title, artist);
        }
    }

    private void handlePositionUpdate(Intent intent) {
        long positionMs = intent.getLongExtra("positionMs", 0);

        int state = currentlyPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;

        PlaybackStateCompat playbackState = newPlaybackStateBuilder()
            .setState(state, positionMs, currentlyPlaying ? 1.0f : 0f)
            .build();

        mediaSession.setPlaybackState(playbackState);
    }

    public void setOptimisticPlaybackState(boolean isPlaying) {
        PlaybackStateCompat state = mediaSession != null && mediaSession.getController() != null
            ? mediaSession.getController().getPlaybackState()
            : null;
        long pos = state != null ? state.getPosition() : 0;

        PlaybackStateCompat playbackState = newPlaybackStateBuilder()
            .setState(isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED,
                      pos,
                      isPlaying ? 1.0f : 0f)
            .build();
        mediaSession.setPlaybackState(playbackState);
        updateNotification(null, null);
    }

    private void setBufferingStateWithMetadata(String mediaId) {
        if (mediaSession == null) return;

        String loadingTitle = "Cargando...";
        String loadingSubtitle = "Aurora Player";

        if (mediaId != null) {
            if (mediaId.startsWith("search_play:") || mediaId.startsWith("search:")) {
                loadingTitle = "Buscando...";
                String query = mediaId.contains(":") ? mediaId.substring(mediaId.indexOf(':') + 1) : mediaId;
                if (!query.isEmpty()) loadingSubtitle = query;
            } else if (mediaId.startsWith("podcast:")) {
                loadingTitle = "Cargando podcast...";
            } else if (mediaId.startsWith("playlist_play:") || mediaId.startsWith("playlist:")) {
                loadingTitle = "Cargando playlist...";
            }
        }

        Uri artUri = ArtworkContentProvider.getGeneratedUri(loadingTitle, loadingSubtitle, "AURORA");
        Bitmap instantArt = AutoArtworkGenerator.generateCover(loadingTitle, loadingSubtitle, "AURORA");

        MediaMetadataCompat.Builder bufferingMeta = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, loadingTitle)
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_TITLE, loadingTitle)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, loadingSubtitle)
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_SUBTITLE, loadingSubtitle)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM_ART_URI, artUri.toString())
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON_URI, artUri.toString());

        if (instantArt != null) {
            bufferingMeta.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, instantArt);
            bufferingMeta.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, instantArt);
            bufferingMeta.putBitmap(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON, instantArt);
        }

        mediaSession.setMetadata(bufferingMeta.build());

        PlaybackStateCompat bufferingState = newPlaybackStateBuilder()
            .setState(PlaybackStateCompat.STATE_BUFFERING, 0, 1.0f)
            .build();
        mediaSession.setPlaybackState(bufferingState);
    }

    private Notification buildNotification(String title, String artist, boolean isPlaying) {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent contentIntent = PendingIntent.getActivity(this, 0, notificationIntent, flags);

        Intent prevIntent = new Intent(this, AudioForegroundService.class);
        prevIntent.setAction("com.auroraplayer.ACTION_PREVIOUS");
        PendingIntent prevPending = PendingIntent.getService(this, 1, prevIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0));

        Intent playPauseIntent = new Intent(this, AudioForegroundService.class);
        playPauseIntent.setAction("com.auroraplayer.ACTION_PLAY_PAUSE");
        PendingIntent playPausePending = PendingIntent.getService(this, 2, playPauseIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0));

        Intent nextIntent = new Intent(this, AudioForegroundService.class);
        nextIntent.setAction("com.auroraplayer.ACTION_NEXT");
        PendingIntent nextPending = PendingIntent.getService(this, 3, nextIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0));

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title != null && !title.isEmpty() ? title : currentTitle)
            .setContentText(artist != null && !artist.isEmpty() ? artist : currentArtist)
            .setSubText(!currentAlbum.isEmpty() ? currentAlbum : "Aurora")
            .setSmallIcon(R.drawable.ic_stat_aurora)
            .setContentIntent(contentIntent)
            .setOngoing(isPlaying)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .addAction(android.R.drawable.ic_media_previous, "Previous", prevPending)
            .addAction(
                isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                isPlaying ? "Pause" : "Play",
                playPausePending
            )
            .addAction(android.R.drawable.ic_media_next, "Next", nextPending)
            .setStyle(new androidx.media.app.NotificationCompat.MediaStyle()
                .setMediaSession(mediaSession.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2)
            );

        if (currentArtworkBitmap != null) {
            builder.setLargeIcon(currentArtworkBitmap);
        }

        return builder.build();
    }

    private void updateNotification(String title, String artist) {
        MediaMetadataCompat metadata = mediaSession.getController().getMetadata();
        PlaybackStateCompat state = mediaSession.getController().getPlaybackState();
        boolean isPlaying = state != null && state.getState() == PlaybackStateCompat.STATE_PLAYING;

        if (title != null && !title.trim().isEmpty()) currentTitle = title.trim();
        if (artist != null && !artist.trim().isEmpty()) currentArtist = artist.trim();

        if (metadata != null) {
            CharSequence metaTitle = metadata.getText(MediaMetadataCompat.METADATA_KEY_TITLE);
            if (metaTitle != null && metaTitle.length() > 0) currentTitle = metaTitle.toString();
            CharSequence metaArtist = metadata.getText(MediaMetadataCompat.METADATA_KEY_ARTIST);
            if (metaArtist != null && metaArtist.length() > 0) currentArtist = metaArtist.toString();
        }

        Notification notification = buildNotification(
            currentTitle,
            currentArtist,
            isPlaying
        );

        Log.i(TAG, "updateNotification posting: currentTitle='" + currentTitle
            + "' currentArtist='" + currentArtist + "' isPlaying=" + isPlaying);

        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID, notification);
        } else {
            Log.e(TAG, "NotificationManager is null, cannot post notification update");
        }
    }

    private void notifyJsMediaAction(String action) {
        NativeMediaSessionPlugin.queueOrDispatchMediaAction(this, action, -1);
    }

    private Bitmap downloadBitmap(String urlStr) {
        try {
            URL url = new URL(urlStr);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);
            conn.setDoInput(true);
            conn.connect();

            if (conn.getResponseCode() == HttpURLConnection.HTTP_OK) {
                InputStream is = conn.getInputStream();
                Bitmap bitmap = BitmapFactory.decodeStream(is);
                is.close();
                conn.disconnect();
                if (bitmap != null && bitmap.getWidth() > 512) {
                    float scale = 512f / bitmap.getWidth();
                    int newH = (int) (bitmap.getHeight() * scale);
                    bitmap = Bitmap.createScaledBitmap(bitmap, 512, newH, true);
                }
                return bitmap;
            }
            conn.disconnect();
        } catch (Throwable t) {
            // ignore
        }
        return null;
    }

    public MediaSessionCompat getMediaSession() {
        return mediaSession;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Aurora Music Player",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Controles de música en la pantalla de bloqueo y barra de estado");
            channel.setShowBadge(true);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            channel.setSound(null, null);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onDestroy() {
        if (phoneCallListenerRegistered && telephonyManager != null) {
            try {
                telephonyManager.listen(phoneStateListener, android.telephony.PhoneStateListener.LISTEN_NONE);
            } catch (Throwable ignored) {}
        }
        if (mediaSession != null && AuroraAutoMediaBrowserService.getInstance() == null) {
            mediaSession.setActive(false);
            mediaSession.release();
        }
        artworkExecutor.shutdownNow();
        try {
            if (serviceWakeLock != null && serviceWakeLock.isHeld()) {
                serviceWakeLock.release();
            }
            if (serviceWifiLock != null && serviceWifiLock.isHeld()) {
                serviceWifiLock.release();
            }
        } catch (Throwable t) {}
        instance = null;
        stopForeground(true);
        super.onDestroy();
    }
}
