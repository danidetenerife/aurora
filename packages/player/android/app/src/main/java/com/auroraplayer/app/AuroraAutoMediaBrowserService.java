package com.auroraplayer.app;

import android.app.PendingIntent;
import android.content.ContentResolver;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.support.v4.media.MediaBrowserCompat;
import android.support.v4.media.MediaDescriptionCompat;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Log;

import androidx.media.MediaBrowserServiceCompat;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.json.JSONArray;
import org.json.JSONObject;

public class AuroraAutoMediaBrowserService extends MediaBrowserServiceCompat {
    private static final String TAG = "AuroraAutoService";

    public static final String CONTENT_STYLE_SUPPORTED = "android.media.browse.CONTENT_STYLE_SUPPORTED";
    public static final String CONTENT_STYLE_BROWSABLE_HINT = "android.media.browse.CONTENT_STYLE_BROWSABLE_HINT";
    public static final String CONTENT_STYLE_PLAYABLE_HINT = "android.media.browse.CONTENT_STYLE_PLAYABLE_HINT";
    public static final int CONTENT_STYLE_LIST_ITEM_HINT_VALUE = 1;
    public static final int CONTENT_STYLE_GRID_ITEM_HINT_VALUE = 2;

    private static final String ROOT_ID = "__AURORA_AUTO_ROOT__";
    private static final String CATEGORY_NOW_PLAYING = "cat_now_playing";
    private static final String CATEGORY_EXPLORE = "cat_explore";
    private static final String CATEGORY_FAVORITES = "cat_favorites";
    private static final String CATEGORY_PLAYLISTS = "cat_playlists";
    private static final String CATEGORY_PODCASTS = "cat_podcasts";
    private static final String CATEGORY_DISCOVER = "cat_discover";
    private static final String CATEGORY_QUEUE = "cat_queue";
    private static final String ACTION_DISLIKE = "com.auroraplayer.ACTION_DISLIKE";

    private static final int MAX_BITMAP_CACHE_SIZE = 30;
    private static final int BITMAP_TARGET_SIZE = 256;
    private static final int HTTP_CONNECT_TIMEOUT_MS = 4000;
    private static final int HTTP_READ_TIMEOUT_MS = 4000;

    private MediaSessionCompat fallbackSession;
    private final ExecutorService bitmapExecutor = Executors.newFixedThreadPool(3);
    private final Map<String, Bitmap> bitmapCache = new HashMap<>();

    @Override
    public void onCreate() {
        super.onCreate();
        initSession();
        ensureAudioServiceRunning();
    }

    private void initSession() {
        AudioForegroundService afs = AudioForegroundService.getInstance();
        if (afs != null && afs.getMediaSession() != null) {
            setSessionToken(afs.getMediaSession().getSessionToken());
            return;
        }

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
                forwardActionToAudioService("com.auroraplayer.ACTION_PLAY_PAUSE", true);
            }

            @Override
            public void onPause() {
                forwardActionToAudioService("com.auroraplayer.ACTION_PLAY_PAUSE", false);
            }

            @Override
            public void onSkipToNext() {
                forwardActionToAudioService("com.auroraplayer.ACTION_NEXT", null);
            }

            @Override
            public void onSkipToPrevious() {
                forwardActionToAudioService("com.auroraplayer.ACTION_PREVIOUS", null);
            }

            @Override
            public void onStop() {
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
                setBufferingState(mediaId);

                NativeMediaSessionPlugin nms = NativeMediaSessionPlugin.getInstance();
                if (nms != null && mediaId != null) {
                    String action = mediaId.startsWith("playid:") || mediaId.startsWith("podcast:") || mediaId.startsWith("playlist:") || mediaId.startsWith("search_play:") || mediaId.startsWith("playlist_play:")
                        ? mediaId
                        : "playid:" + mediaId;
                    nms.notifyMediaAction(action, -1);
                }
            }

            @Override
            public void onPlayFromSearch(String query, Bundle extras) {
                setBufferingState("search:" + (query == null ? "" : query));

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
                PlaybackStateCompat.ACTION_PLAY_FROM_MEDIA_ID |
                PlaybackStateCompat.ACTION_PLAY_FROM_SEARCH |
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

    private void setBufferingState(String mediaId) {
        MediaSessionCompat session = getActiveSession();
        if (session == null) return;

        String loadingTitle = "Cargando...";
        String loadingSubtitle = "Aurora Player";

        if (mediaId != null) {
            if (mediaId.startsWith("search_play:")) {
                loadingTitle = "Buscando...";
                loadingSubtitle = mediaId.substring("search_play:".length());
            } else if (mediaId.startsWith("podcast:")) {
                loadingTitle = "Cargando podcast...";
            } else if (mediaId.startsWith("playlist_play:") || mediaId.startsWith("playlist:")) {
                loadingTitle = "Cargando playlist...";
            }
        }

        MediaMetadataCompat bufferingMeta = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, loadingTitle)
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_TITLE, loadingTitle)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, loadingSubtitle)
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_SUBTITLE, loadingSubtitle)
            .build();
        session.setMetadata(bufferingMeta);

        PlaybackStateCompat bufferingState = new PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY |
                PlaybackStateCompat.ACTION_PAUSE |
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
                PlaybackStateCompat.ACTION_PLAY_PAUSE |
                PlaybackStateCompat.ACTION_PLAY_FROM_MEDIA_ID |
                PlaybackStateCompat.ACTION_PLAY_FROM_SEARCH |
                PlaybackStateCompat.ACTION_STOP
            )
            .setState(PlaybackStateCompat.STATE_BUFFERING, 0, 1.0f)
            .addCustomAction(new PlaybackStateCompat.CustomAction.Builder(
                ACTION_DISLIKE, "No me gusta", R.drawable.ic_thumb_down
            ).build())
            .build();
        session.setPlaybackState(bufferingState);
    }

    private MediaSessionCompat getActiveSession() {
        AudioForegroundService afs = AudioForegroundService.getInstance();
        if (afs != null && afs.getMediaSession() != null) {
            return afs.getMediaSession();
        }
        return fallbackSession;
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
            } catch (Throwable error) {
                Log.w(TAG, "AudioForegroundService start notice", error);
            }
        }
    }

    private void forwardActionToAudioService(String action, Boolean targetPlay) {
        AudioForegroundService afs = AudioForegroundService.getInstance();
        if (afs != null) {
            if ("com.auroraplayer.ACTION_PLAY_PAUSE".equals(action) && targetPlay != null) {
                if (targetPlay) {
                    afs.resumeStream();
                } else {
                    afs.pauseStream();
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
        } catch (Throwable error) {
            Log.w(TAG, "Failed action intent", error);
        }
    }

    private Uri getDrawableUri(int resourceId) {
        return Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + getPackageName() + "/" + resourceId);
    }

    private MediaBrowserCompat.MediaItem createMediaItem(String mediaId, String title, String subtitle, Uri iconUri, boolean browsable, boolean isGrid) {
        Bundle extras = new Bundle();
        int hint = isGrid ? CONTENT_STYLE_GRID_ITEM_HINT_VALUE : CONTENT_STYLE_LIST_ITEM_HINT_VALUE;
        extras.putInt(CONTENT_STYLE_BROWSABLE_HINT, hint);
        extras.putInt(CONTENT_STYLE_PLAYABLE_HINT, hint);

        MediaDescriptionCompat.Builder builder = new MediaDescriptionCompat.Builder()
            .setMediaId(mediaId)
            .setTitle(title)
            .setSubtitle(subtitle)
            .setExtras(extras);

        if (iconUri != null) {
            builder.setIconUri(iconUri);
        }

        return new MediaBrowserCompat.MediaItem(
            builder.build(),
            browsable ? MediaBrowserCompat.MediaItem.FLAG_BROWSABLE : MediaBrowserCompat.MediaItem.FLAG_PLAYABLE
        );
    }

    private MediaBrowserCompat.MediaItem createMediaItemWithBitmap(String mediaId, String title, String subtitle, Bitmap iconBitmap, boolean browsable, boolean isGrid) {
        Bundle extras = new Bundle();
        int hint = isGrid ? CONTENT_STYLE_GRID_ITEM_HINT_VALUE : CONTENT_STYLE_LIST_ITEM_HINT_VALUE;
        extras.putInt(CONTENT_STYLE_BROWSABLE_HINT, hint);
        extras.putInt(CONTENT_STYLE_PLAYABLE_HINT, hint);

        MediaDescriptionCompat.Builder builder = new MediaDescriptionCompat.Builder()
            .setMediaId(mediaId)
            .setTitle(title)
            .setSubtitle(subtitle)
            .setExtras(extras);

        if (iconBitmap != null) {
            builder.setIconBitmap(iconBitmap);
        }

        return new MediaBrowserCompat.MediaItem(
            builder.build(),
            browsable ? MediaBrowserCompat.MediaItem.FLAG_BROWSABLE : MediaBrowserCompat.MediaItem.FLAG_PLAYABLE
        );
    }

    @Override
    public BrowserRoot onGetRoot(String clientPackageName, int clientUid, Bundle rootHints) {
        AudioForegroundService afs = AudioForegroundService.getInstance();
        if (afs != null && afs.getMediaSession() != null) {
            try {
                setSessionToken(afs.getMediaSession().getSessionToken());
            } catch (Throwable ignored) {}
        }

        Bundle rootExtras = new Bundle();
        rootExtras.putBoolean(CONTENT_STYLE_SUPPORTED, true);
        rootExtras.putInt(CONTENT_STYLE_BROWSABLE_HINT, CONTENT_STYLE_GRID_ITEM_HINT_VALUE);
        rootExtras.putInt(CONTENT_STYLE_PLAYABLE_HINT, CONTENT_STYLE_GRID_ITEM_HINT_VALUE);

        return new BrowserRoot(ROOT_ID, rootExtras);
    }

    @Override
    public void onLoadChildren(final String parentMediaId, final Result<List<MediaBrowserCompat.MediaItem>> result) {
        if (CATEGORY_PODCASTS.equals(parentMediaId)) {
            result.detach();
            loadPodcastsAsync(result);
            return;
        }

        if (parentMediaId != null && parentMediaId.startsWith("podcast_genre:")) {
            result.detach();
            loadPodcastGenreAsync(parentMediaId.substring("podcast_genre:".length()), result);
            return;
        }

        List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();

        if (ROOT_ID.equals(parentMediaId)) {
            String currentTitle = "Reproduciendo";
            String currentSubtitle = "Aurora Player";
            Uri currentArtwork = null;

            AudioForegroundService afs = AudioForegroundService.getInstance();
            if (afs != null && afs.getMediaSession() != null) {
                MediaMetadataCompat meta = afs.getMediaSession().getController().getMetadata();
                if (meta != null) {
                    CharSequence titleCs = meta.getText(MediaMetadataCompat.METADATA_KEY_TITLE);
                    CharSequence artistCs = meta.getText(MediaMetadataCompat.METADATA_KEY_ARTIST);
                    String artUri = meta.getString(MediaMetadataCompat.METADATA_KEY_ALBUM_ART_URI);
                    if (titleCs != null && titleCs.length() > 0) currentTitle = titleCs.toString();
                    if (artistCs != null && artistCs.length() > 0) currentSubtitle = artistCs.toString();
                    if (artUri != null && artUri.length() > 0) currentArtwork = Uri.parse(artUri);
                }
            }
            if (currentArtwork == null) {
                currentArtwork = getDrawableUri(R.drawable.ic_auto_queue);
            }

            items.add(createMediaItem(CATEGORY_NOW_PLAYING, currentTitle, currentSubtitle, currentArtwork, false, true));
            items.add(createMediaItem(CATEGORY_EXPLORE, "Explorar & Búsqueda", "Música para conducir y géneros", getDrawableUri(R.drawable.ic_auto_search), true, true));
            items.add(createMediaItem(CATEGORY_FAVORITES, "Favoritos", "Tus canciones y álbumes guardados", getDrawableUri(R.drawable.ic_auto_favorites), true, true));
            items.add(createMediaItem(CATEGORY_PLAYLISTS, "Listas de reproducción", "Tus playlists y éxitos populares", getDrawableUri(R.drawable.ic_auto_playlists), true, true));
            items.add(createMediaItem(CATEGORY_PODCASTS, "Podcasts", "Busca y escucha cualquier podcast", getDrawableUri(R.drawable.ic_auto_podcasts), true, true));
            items.add(createMediaItem(CATEGORY_DISCOVER, "Top Éxitos", "Tendencias mundiales y novedades", getDrawableUri(R.drawable.ic_auto_discover), true, true));
            items.add(createMediaItem(CATEGORY_QUEUE, "Cola actual", "Pistas en la lista de reproducción", getDrawableUri(R.drawable.ic_auto_queue), true, false));
        } else if (CATEGORY_EXPLORE.equals(parentMediaId)) {
            items.add(createMediaItem("search_play:Música para Conducir", "Música para Conducir", "Carretera y viaje", getDrawableUri(R.drawable.ic_auto_discover), false, true));
            items.add(createMediaItem("search_play:Top España 2026", "Top España", "Lo más sonado hoy", getDrawableUri(R.drawable.ic_auto_discover), false, true));
            items.add(createMediaItem("search_play:Rock Clásico", "Rock Clásicos", "Guitarras y leyendas", getDrawableUri(R.drawable.ic_auto_discover), false, true));
            items.add(createMediaItem("search_play:Reggaeton Éxitos", "Reggaetón & Urbano", "Ritmo y fiesta", getDrawableUri(R.drawable.ic_auto_discover), false, true));
            items.add(createMediaItem("search_play:Chill Lo-Fi Beats", "Chill & Lo-Fi", "Conducción relajada", getDrawableUri(R.drawable.ic_auto_discover), false, true));
            items.add(createMediaItem("search_play:Pop Internacional", "Pop Internacional", "Grandes éxitos mundiales", getDrawableUri(R.drawable.ic_auto_discover), false, true));
            items.add(createMediaItem("search_play:Éxitos de los 80 y 90", "Nostalgia 80s y 90s", "Grandes recuerdos", getDrawableUri(R.drawable.ic_auto_discover), false, true));
            items.add(createMediaItem("search_play:Electrónica Dance", "Electrónica & Dance", "Energía en ruta", getDrawableUri(R.drawable.ic_auto_discover), false, true));
        } else if (CATEGORY_PLAYLISTS.equals(parentMediaId)) {
            populatePlaylistsCategory(items);
        } else if (parentMediaId.startsWith("playlist:")) {
            populatePlaylistTracks(parentMediaId.substring("playlist:".length()), items);
        } else if (CATEGORY_FAVORITES.equals(parentMediaId)) {
            populateFavoritesCategory(items);
        } else if (CATEGORY_DISCOVER.equals(parentMediaId)) {
            populateDiscoverCategory(items);
        } else if (CATEGORY_QUEUE.equals(parentMediaId)) {
            populateQueueCategory(items);
        }

        result.sendResult(items);
    }

    private void loadPodcastsAsync(final Result<List<MediaBrowserCompat.MediaItem>> result) {
        bitmapExecutor.execute(() -> {
            List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();

            items.add(createMediaItem("podcast_genre:comedia española podcast", "🎭 Comedia", "Humor y entretenimiento", getDrawableUri(R.drawable.ic_auto_podcasts), true, true));
            items.add(createMediaItem("podcast_genre:true crime español", "🔍 True Crime", "Crímenes y misterios", getDrawableUri(R.drawable.ic_auto_podcasts), true, true));
            items.add(createMediaItem("podcast_genre:tecnología podcast español", "💻 Tecnología", "Gadgets, apps e innovación", getDrawableUri(R.drawable.ic_auto_podcasts), true, true));
            items.add(createMediaItem("podcast_genre:historia podcast español", "📜 Historia", "Relatos del pasado", getDrawableUri(R.drawable.ic_auto_podcasts), true, true));
            items.add(createMediaItem("podcast_genre:noticias actualidad podcast español", "📰 Noticias", "Actualidad y análisis", getDrawableUri(R.drawable.ic_auto_podcasts), true, true));
            items.add(createMediaItem("podcast_genre:deportes fútbol podcast", "⚽ Deportes", "Fútbol, NBA y más", getDrawableUri(R.drawable.ic_auto_podcasts), true, true));
            items.add(createMediaItem("podcast_genre:ciencia divulgación podcast", "🔬 Ciencia", "Divulgación científica", getDrawableUri(R.drawable.ic_auto_podcasts), true, true));
            items.add(createMediaItem("podcast_genre:entrevistas famosos podcast", "🎙️ Entrevistas", "Conversaciones con invitados", getDrawableUri(R.drawable.ic_auto_podcasts), true, true));

            addPodcastWithBitmap(items, "todopoderosos", "Todopoderosos", "Arturo González-Campos, Rodrigo Cortés, Javier Cansado, Juan Gómez-Jurado", "https://static-ivoox.epimg.net/canales/3/2/5/1/11325_big.jpg");
            addPodcastWithBitmap(items, "the-wild-project", "The Wild Project", "Jordi Wild", "https://i.scdn.co/image/ab6765630000ba8a798f480fe98dfce4b1bc41fc");
            addPodcastWithBitmap(items, "nude-project", "The Nude Project", "Nude Project Podcast", "https://i.scdn.co/image/ab6765630000ba8a912bbbbce394c8e7e1efca24");
            addPodcastWithBitmap(items, "historia-national", "Historia National Geographic", "National Geographic España", "https://static-ivoox.epimg.net/canales/1/3/2/1/11231_big.jpg");
            addPodcastWithBitmap(items, "la-ruina", "La Ruina", "Ignasi Taltavull y Tomàs Fuentes", "https://i.scdn.co/image/ab6765630000ba8aa410d10b784a0d81fc69c6cf");
            addPodcastWithBitmap(items, "nadie-sabe-nada", "Nadie Sabe Nada", "Andreu Buenafuente y Berto Romero", "https://i.scdn.co/image/ab6765630000ba8a83fa716757545ee2b1fa8519");
            addPodcastWithBitmap(items, "daily", "The Daily", "The New York Times", "https://i.scdn.co/image/ab6765630000ba8a6b47c050fb36cc7cbe41bb59");
            addPodcastWithBitmap(items, "serial", "Serial", "Serial Productions & The New York Times", "https://i.scdn.co/image/ab6765630000ba8a72ce10339d67d7168df65448");

            result.sendResult(items);
        });
    }

    private void loadPodcastGenreAsync(final String genreQuery, final Result<List<MediaBrowserCompat.MediaItem>> result) {
        bitmapExecutor.execute(() -> {
            List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();
            try {
                String encodedQuery = java.net.URLEncoder.encode(genreQuery, "UTF-8");
                URL apiUrl = new URL("https://itunes.apple.com/search?term=" + encodedQuery + "&entity=podcast&limit=15&country=ES");
                HttpURLConnection conn = (HttpURLConnection) apiUrl.openConnection();
                conn.setConnectTimeout(HTTP_CONNECT_TIMEOUT_MS);
                conn.setReadTimeout(HTTP_READ_TIMEOUT_MS);
                conn.setRequestProperty("User-Agent", "AuroraPlayer/1.0");
                conn.connect();

                if (conn.getResponseCode() == HttpURLConnection.HTTP_OK) {
                    InputStream inputStream = conn.getInputStream();
                    java.io.ByteArrayOutputStream outputStream = new java.io.ByteArrayOutputStream();
                    byte[] buffer = new byte[4096];
                    int bytesRead;
                    while ((bytesRead = inputStream.read(buffer)) != -1) {
                        outputStream.write(buffer, 0, bytesRead);
                    }
                    inputStream.close();
                    conn.disconnect();

                    JSONObject responseJson = new JSONObject(outputStream.toString("UTF-8"));
                    JSONArray results = responseJson.optJSONArray("results");
                    if (results != null) {
                        for (int index = 0; index < results.length(); index++) {
                            JSONObject podcast = results.optJSONObject(index);
                            if (podcast == null) continue;
                            String podcastName = podcast.optString("collectionName", "");
                            String artistName = podcast.optString("artistName", "");
                            String artworkUrl = podcast.optString("artworkUrl600", podcast.optString("artworkUrl100", ""));

                            if (podcastName.isEmpty()) continue;

                            String podcastSlug = podcastName.toLowerCase().replaceAll("[^a-z0-9]+", "-");
                            Bitmap artwork = null;
                            if (!artworkUrl.isEmpty()) {
                                artwork = bitmapCache.get(artworkUrl);
                                if (artwork == null) {
                                    artwork = downloadBitmap(artworkUrl);
                                    if (artwork != null) {
                                        if (bitmapCache.size() >= MAX_BITMAP_CACHE_SIZE) {
                                            String firstKey = bitmapCache.keySet().iterator().next();
                                            bitmapCache.remove(firstKey);
                                        }
                                        bitmapCache.put(artworkUrl, artwork);
                                    }
                                }
                            }

                            if (artwork != null) {
                                items.add(createMediaItemWithBitmap("podcast:" + podcastSlug, podcastName, artistName, artwork, false, true));
                            } else {
                                items.add(createMediaItem("podcast:" + podcastSlug, podcastName, artistName, getDrawableUri(R.drawable.ic_auto_podcasts), false, true));
                            }
                        }
                    }
                } else {
                    conn.disconnect();
                }
            } catch (Throwable error) {
                Log.w(TAG, "Podcast genre search failed: " + genreQuery, error);
            }

            if (items.isEmpty()) {
                items.add(createMediaItem("podcast:" + genreQuery, "Buscar: " + genreQuery, "Reproducir último episodio", getDrawableUri(R.drawable.ic_auto_podcasts), false, true));
            }

            result.sendResult(items);
        });
    }

    private void addPodcastWithBitmap(List<MediaBrowserCompat.MediaItem> items, String id, String title, String publisher, String artworkUrl) {
        Bitmap cachedBitmap = bitmapCache.get(artworkUrl);
        if (cachedBitmap == null && artworkUrl != null) {
            cachedBitmap = downloadBitmap(artworkUrl);
            if (cachedBitmap != null) {
                if (bitmapCache.size() >= MAX_BITMAP_CACHE_SIZE) {
                    String firstKey = bitmapCache.keySet().iterator().next();
                    bitmapCache.remove(firstKey);
                }
                bitmapCache.put(artworkUrl, cachedBitmap);
            }
        }

        if (cachedBitmap != null) {
            items.add(createMediaItemWithBitmap("podcast:" + id, title, publisher, cachedBitmap, false, true));
        } else {
            items.add(createMediaItem("podcast:" + id, title, publisher, getDrawableUri(R.drawable.ic_auto_podcasts), false, true));
        }
    }

    private Bitmap downloadBitmap(String urlStr) {
        try {
            URL url = new URL(urlStr);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(HTTP_CONNECT_TIMEOUT_MS);
            conn.setReadTimeout(HTTP_READ_TIMEOUT_MS);
            conn.setDoInput(true);
            conn.setInstanceFollowRedirects(true);
            conn.setRequestProperty("User-Agent", "AuroraPlayer/1.0");
            conn.connect();

            if (conn.getResponseCode() == HttpURLConnection.HTTP_OK) {
                InputStream inputStream = conn.getInputStream();
                Bitmap bitmap = BitmapFactory.decodeStream(inputStream);
                inputStream.close();
                conn.disconnect();
                if (bitmap != null && bitmap.getWidth() > BITMAP_TARGET_SIZE) {
                    float scale = (float) BITMAP_TARGET_SIZE / bitmap.getWidth();
                    int newHeight = (int) (bitmap.getHeight() * scale);
                    bitmap = Bitmap.createScaledBitmap(bitmap, BITMAP_TARGET_SIZE, newHeight, true);
                }
                return bitmap;
            }
            conn.disconnect();
        } catch (Throwable error) {
            Log.w(TAG, "Bitmap download failed: " + urlStr, error);
        }
        return null;
    }

    private JSONObject getStructuredCatalog() {
        String json = getSharedPreferences("aurora_auto", MODE_PRIVATE).getString("catalog", "{}");
        try {
            if (json.trim().startsWith("{")) {
                return new JSONObject(json);
            }
        } catch (Exception error) {
            Log.w(TAG, "Catalog JSON parse error", error);
        }
        return new JSONObject();
    }

    private JSONArray getRawCatalogArray() {
        String json = getSharedPreferences("aurora_auto", MODE_PRIVATE).getString("catalog", "[]");
        try {
            if (json.trim().startsWith("[")) {
                return new JSONArray(json);
            }
        } catch (Exception error) {
            Log.w(TAG, "Raw catalog parse error", error);
        }
        return new JSONArray();
    }

    private void populatePlaylistsCategory(List<MediaBrowserCompat.MediaItem> items) {
        JSONObject catalog = getStructuredCatalog();
        JSONArray playlists = catalog.optJSONArray("playlists");
        if (playlists != null) {
            for (int index = 0; index < playlists.length(); index++) {
                JSONObject playlist = playlists.optJSONObject(index);
                if (playlist == null) continue;
                String id = playlist.optString("id");
                String name = playlist.optString("name", "Lista");
                String artwork = playlist.optString("artworkUrl", "");
                int count = playlist.optInt("trackCount", 0);
                String subtitle = count > 0 ? count + " canciones" : "Lista personal";
                Uri uri = !artwork.isEmpty() ? Uri.parse(artwork) : getDrawableUri(R.drawable.ic_auto_playlists);

                JSONArray trackItems = playlist.optJSONArray("items");
                boolean hasTracks = trackItems != null && trackItems.length() > 0;
                if (hasTracks) {
                    items.add(createMediaItem("playlist:" + id, name, subtitle, uri, true, true));
                } else {
                    items.add(createMediaItem("playlist_play:" + id, name, subtitle, uri, false, true));
                }
            }
        }

        JSONArray popular = catalog.optJSONArray("popularPlaylists");
        if (popular != null) {
            for (int index = 0; index < popular.length(); index++) {
                JSONObject playlist = popular.optJSONObject(index);
                if (playlist == null) continue;
                String id = playlist.optString("id");
                String name = playlist.optString("name", "Lista popular");
                String subtitle = playlist.optString("description", "Éxitos recomendados");
                Uri uri = getDrawableUri(R.drawable.ic_auto_playlists);
                String artwork = playlist.optString("artworkUrl", "");
                if (!artwork.isEmpty()) {
                    uri = Uri.parse(artwork);
                }
                items.add(createMediaItem("playlist_play:" + id, name, subtitle, uri, false, true));
            }
        }

        if (items.isEmpty()) {
            items.add(createMediaItem("playlist_play:spotify_top", "Today's Top Hits", "Éxitos del momento • Spotify", getDrawableUri(R.drawable.ic_auto_playlists), false, true));
            items.add(createMediaItem("playlist_play:spotify_latino", "Viva Latino", "Los mejores temas latinos", getDrawableUri(R.drawable.ic_auto_playlists), false, true));
            items.add(createMediaItem("playlist_play:spotify_rock", "Rock Classics", "Leyendas eternas del rock", getDrawableUri(R.drawable.ic_auto_playlists), false, true));
            items.add(createMediaItem("playlist_play:yt_top", "Top Canciones", "Éxitos de YouTube Music", getDrawableUri(R.drawable.ic_auto_playlists), false, true));
        }
    }

    private void populatePlaylistTracks(String playlistId, List<MediaBrowserCompat.MediaItem> items) {
        items.add(createMediaItem("playlist_play:" + playlistId, "▶ Reproducir todo", "Iniciar playlist completa", getDrawableUri(R.drawable.ic_auto_play_all), false, false));

        JSONObject catalog = getStructuredCatalog();
        JSONArray personal = catalog.optJSONArray("playlists");

        if (personal != null) {
            for (int index = 0; index < personal.length(); index++) {
                JSONObject playlist = personal.optJSONObject(index);
                if (playlist != null && playlistId.equals(playlist.optString("id"))) {
                    JSONArray tracks = playlist.optJSONArray("items");
                    if (tracks != null) {
                        for (int trackIndex = 0; trackIndex < tracks.length(); trackIndex++) {
                            JSONObject track = tracks.optJSONObject(trackIndex);
                            if (track == null) continue;
                            String id = track.optString("id");
                            String title = track.optString("title", "Pista");
                            String artist = track.optString("artist", "");
                            String artwork = track.optString("artworkUrl", "");
                            Uri uri = !artwork.isEmpty() ? Uri.parse(artwork) : getDrawableUri(R.drawable.ic_auto_queue);
                            items.add(createMediaItem("playid:" + id, title, artist, uri, false, false));
                        }
                    }
                    break;
                }
            }
        }
    }

    private void populateFavoritesCategory(List<MediaBrowserCompat.MediaItem> items) {
        JSONObject catalog = getStructuredCatalog();
        JSONArray favorites = catalog.optJSONArray("favorites");

        if (favorites != null && favorites.length() > 0) {
            for (int index = 0; index < favorites.length(); index++) {
                JSONObject item = favorites.optJSONObject(index);
                if (item == null) continue;
                String id = item.optString("id");
                String title = item.optString("title", "Canción");
                String artist = item.optString("artist", "");
                String artwork = item.optString("artworkUrl", "");
                Uri uri = !artwork.isEmpty() ? Uri.parse(artwork) : getDrawableUri(R.drawable.ic_auto_favorites);
                items.add(createMediaItem("playid:" + id, title, artist, uri, false, true));
            }
        } else {
            items.add(createMediaItem("empty_fav", "Sin favoritos aún", "Marca pistas como favoritas en Aurora", getDrawableUri(R.drawable.ic_auto_favorites), false, false));
        }
    }

    private void populateDiscoverCategory(List<MediaBrowserCompat.MediaItem> items) {
        JSONObject catalog = getStructuredCatalog();
        JSONArray discover = catalog.optJSONArray("discover");

        if (discover != null && discover.length() > 0) {
            for (int index = 0; index < discover.length(); index++) {
                JSONObject item = discover.optJSONObject(index);
                if (item == null) continue;
                String id = item.optString("id");
                String title = item.optString("title", "Canción");
                String artist = item.optString("artist", "");
                String artwork = item.optString("artworkUrl", "");
                Uri uri = !artwork.isEmpty() ? Uri.parse(artwork) : getDrawableUri(R.drawable.ic_auto_discover);
                items.add(createMediaItem("playid:" + id, title, artist, uri, false, true));
            }
        } else {
            items.add(createMediaItem("search_play:Top Viral 2026", "Top Viral Global", "Tendencias de streaming", getDrawableUri(R.drawable.ic_auto_discover), false, true));
            items.add(createMediaItem("search_play:Novedades Viernes", "Novedades Viernes", "Lanzamientos destacados", getDrawableUri(R.drawable.ic_auto_discover), false, true));
        }
    }

    private void populateQueueCategory(List<MediaBrowserCompat.MediaItem> items) {
        JSONObject catalog = getStructuredCatalog();
        JSONArray queue = catalog.optJSONArray("queue");
        if (queue == null) {
            queue = getRawCatalogArray();
        }

        for (int index = 0; index < queue.length(); index++) {
            JSONObject item = queue.optJSONObject(index);
            if (item == null) continue;
            String id = item.optString("id");
            String title = item.optString("title", "Canción");
            String artist = item.optString("artist", "");
            String artwork = item.optString("artworkUrl", "");
            Uri uri = !artwork.isEmpty() ? Uri.parse(artwork) : getDrawableUri(R.drawable.ic_auto_queue);
            items.add(createMediaItem("playid:" + id, title, artist, uri, false, false));
        }
    }

    @Override
    public void onSearch(String query, Bundle extras, Result<List<MediaBrowserCompat.MediaItem>> result) {
        List<MediaBrowserCompat.MediaItem> matches = new ArrayList<>();
        String normalized = query == null ? "" : query.toLowerCase().trim();

        if (!normalized.isEmpty()) {
            matches.add(createMediaItem(
                "search_play:" + query,
                "Reproducir \"" + query + "\"",
                "Buscar mejores resultados en YouTube Music",
                getDrawableUri(R.drawable.ic_auto_search),
                false,
                true
            ));

            matches.add(createMediaItem(
                "podcast:" + query.toLowerCase().replaceAll("[^a-z0-9áéíóúñ ]+", "").trim(),
                "Podcast: \"" + query + "\"",
                "Buscar podcast y reproducir último episodio",
                getDrawableUri(R.drawable.ic_auto_podcasts),
                false,
                true
            ));
        }

        JSONObject catalog = getStructuredCatalog();
        JSONArray[] sections = new JSONArray[] {
            catalog.optJSONArray("favorites"),
            catalog.optJSONArray("queue"),
            catalog.optJSONArray("discover")
        };

        for (JSONArray section : sections) {
            if (section == null) continue;
            for (int index = 0; index < section.length(); index++) {
                JSONObject item = section.optJSONObject(index);
                if (item == null) continue;
                String title = item.optString("title", "");
                String artist = item.optString("artist", "");
                String id = item.optString("id");
                String artwork = item.optString("artworkUrl", "");

                if (title.toLowerCase().contains(normalized) || artist.toLowerCase().contains(normalized)) {
                    Uri uri = !artwork.isEmpty() ? Uri.parse(artwork) : getDrawableUri(R.drawable.ic_auto_search);
                    matches.add(createMediaItem("playid:" + id, title, artist, uri, false, true));
                    if (matches.size() >= 25) break;
                }
            }
            if (matches.size() >= 25) break;
        }

        JSONArray rawQueue = getRawCatalogArray();
        for (int index = 0; index < rawQueue.length() && matches.size() < 25; index++) {
            JSONObject item = rawQueue.optJSONObject(index);
            if (item == null) continue;
            String title = item.optString("title", "");
            String artist = item.optString("artist", "");
            String id = item.optString("id");
            if (title.toLowerCase().contains(normalized) || artist.toLowerCase().contains(normalized)) {
                matches.add(createMediaItem("playid:" + id, title, artist, getDrawableUri(R.drawable.ic_auto_queue), false, false));
            }
        }

        result.sendResult(matches);
    }

    @Override
    public void onDestroy() {
        if (fallbackSession != null) {
            fallbackSession.setActive(false);
            fallbackSession.release();
            fallbackSession = null;
        }
        bitmapExecutor.shutdownNow();
        bitmapCache.clear();
        super.onDestroy();
    }
}
