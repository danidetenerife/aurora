package com.auroraplayer.app;

import android.app.PendingIntent;
import android.content.ContentResolver;
import android.content.Context;
import android.graphics.Bitmap;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.support.v4.media.MediaBrowserCompat;
import android.support.v4.media.MediaDescriptionCompat;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.media.MediaBrowserServiceCompat;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.json.JSONArray;
import org.json.JSONObject;

public class AuroraAutoMediaBrowserService extends MediaBrowserServiceCompat {
    private static final String TAG = "AuroraAutoService";

    public static final String CONTENT_STYLE_SUPPORTED = "android.media.browse.CONTENT_STYLE_SUPPORTED";
    public static final String CONTENT_STYLE_BROWSABLE_HINT = "android.media.browse.CONTENT_STYLE_BROWSABLE_HINT";
    public static final String CONTENT_STYLE_PLAYABLE_HINT = "android.media.browse.CONTENT_STYLE_PLAYABLE_HINT";
    public static final String CONTENT_STYLE_SINGLE_ITEM_HINT = "android.media.browse.CONTENT_STYLE_SINGLE_ITEM";
    public static final String CONTENT_STYLE_GROUP_TITLE_HINT = "android.media.browse.CONTENT_STYLE_GROUP_TITLE";

    public static final int CONTENT_STYLE_LIST_ITEM_HINT_VALUE = 1;
    public static final int CONTENT_STYLE_GRID_ITEM_HINT_VALUE = 2;

    public static final String METADATA_KEY_IS_EXPLICIT = "android.media.metadata.IS_EXPLICIT";
    public static final long METADATA_VALUE_ATTRIBUTE_PRESENT = 1L;

    public static final String EXTRA_COMPLETION_STATUS = "android.media.extra.COMPLETION_STATUS";
    public static final int COMPLETION_STATUS_NOT_PLAYED = 1;
    public static final int COMPLETION_STATUS_PARTIALLY_PLAYED = 2;
    public static final int COMPLETION_STATUS_FULLY_PLAYED = 3;
    public static final String EXTRA_COMPLETION_PERCENTAGE = "android.media.extra.COMPLETION_PERCENTAGE";

    private static final String ROOT_ID = "__AURORA_AUTO_ROOT__";
    private static final String CATEGORY_EXPLORE = "cat_explore";
    private static final String CATEGORY_FAVORITES = "cat_favorites";
    private static final String CATEGORY_PLAYLISTS = "cat_playlists";
    private static final String CATEGORY_PODCASTS = "cat_podcasts";

    private static final int HTTP_CONNECT_TIMEOUT_MS = 4000;
    private static final int HTTP_READ_TIMEOUT_MS = 4000;

    private static volatile AuroraAutoMediaBrowserService sInstance;
    private final ExecutorService asyncExecutor = Executors.newFixedThreadPool(4);

    public static AuroraAutoMediaBrowserService getInstance() {
        return sInstance;
    }

    public static void onCatalogUpdated() {
        AuroraAutoMediaBrowserService service = sInstance;
        if (service != null) {
            try {
                service.notifyChildrenChanged(ROOT_ID);
                service.notifyChildrenChanged(CATEGORY_EXPLORE);
                service.notifyChildrenChanged(CATEGORY_FAVORITES);
                service.notifyChildrenChanged(CATEGORY_PLAYLISTS);
                service.notifyChildrenChanged(CATEGORY_PODCASTS);
            } catch (Throwable error) {
                Log.w(TAG, "Failed notifying children update", error);
            }
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        sInstance = this;
        MediaSessionCompat session = AuroraMediaSessionHolder.getOrCreateSession(this);
        setSessionToken(session.getSessionToken());
        ensureAudioServiceRunning();
    }

    private void handleVoicePlaySearch(String query, Bundle extras) {
        String cleanQuery = (query == null) ? "" : query.trim();
        if (cleanQuery.isEmpty()) {
            forwardActionToAudioService("com.auroraplayer.ACTION_PLAY_PAUSE", true);
            return;
        }

        String lower = cleanQuery.toLowerCase();
        if (lower.startsWith("reproduce ") || lower.startsWith("pon ") || lower.startsWith("escuchar ")) {
            cleanQuery = cleanQuery.substring(cleanQuery.indexOf(' ') + 1).trim();
        }

        setBufferingState("search_play:" + cleanQuery);
        NativeMediaSessionPlugin.queueOrDispatchMediaAction(this, "search_play:" + cleanQuery, -1);
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
                loadingTitle = "Cargando lista...";
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

        session.setMetadata(bufferingMeta.build());

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
            .build();
        session.setPlaybackState(bufferingState);
    }

    private MediaSessionCompat getActiveSession() {
        return AuroraMediaSessionHolder.getOrCreateSession(this);
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
                Log.w(TAG, "AudioForegroundService startup error", error);
            }
        }
    }

    private void forwardActionToAudioService(String action, Boolean targetPlay) {
        AudioForegroundService afs = AudioForegroundService.getInstance();
        if (afs != null && "com.auroraplayer.ACTION_PLAY_PAUSE".equals(action) && targetPlay != null) {
            if (targetPlay) afs.resumeStream();
            else afs.pauseStream();
        }

        if ("com.auroraplayer.ACTION_NEXT".equals(action)) {
            NativeMediaSessionPlugin.queueOrDispatchMediaAction(this, "nexttrack", -1);
        } else if ("com.auroraplayer.ACTION_PREVIOUS".equals(action)) {
            NativeMediaSessionPlugin.queueOrDispatchMediaAction(this, "previoustrack", -1);
        } else if ("com.auroraplayer.ACTION_PLAY_PAUSE".equals(action)) {
            NativeMediaSessionPlugin.queueOrDispatchMediaAction(this, targetPlay == null || targetPlay ? "play" : "pause", -1);
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
            Log.w(TAG, "Failed forwarding intent", error);
        }
    }

    private MediaBrowserCompat.MediaItem createMediaItem(
            String mediaId,
            String title,
            String subtitle,
            Uri iconUri,
            boolean browsable,
            boolean isGrid,
            @Nullable String groupTitle
    ) {
        Bundle extras = new Bundle();
        int hint = isGrid ? CONTENT_STYLE_GRID_ITEM_HINT_VALUE : CONTENT_STYLE_LIST_ITEM_HINT_VALUE;
        extras.putInt(CONTENT_STYLE_SINGLE_ITEM_HINT, hint);
        extras.putInt(CONTENT_STYLE_BROWSABLE_HINT, hint);
        extras.putInt(CONTENT_STYLE_PLAYABLE_HINT, hint);

        if (groupTitle != null && !groupTitle.trim().isEmpty()) {
            extras.putString(CONTENT_STYLE_GROUP_TITLE_HINT, groupTitle);
        }

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
        rootExtras.putInt(CONTENT_STYLE_PLAYABLE_HINT, CONTENT_STYLE_LIST_ITEM_HINT_VALUE);
        rootExtras.putBoolean("android.media.browse.SEARCH_SUPPORTED", true);

        return new BrowserRoot(ROOT_ID, rootExtras);
    }

    private Uri getResourceUri(int resId) {
        try {
            String type = getResources().getResourceTypeName(resId);
            String name = getResources().getResourceEntryName(resId);
            return new Uri.Builder()
                .scheme(ContentResolver.SCHEME_ANDROID_RESOURCE)
                .authority(getPackageName())
                .appendPath(type)
                .appendPath(name)
                .build();
        } catch (Throwable e) {
            return Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + getPackageName() + "/" + resId);
        }
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
            items.add(createMediaItem(
                CATEGORY_EXPLORE,
                "Explorar",
                "Música para conducir y géneros",
                getResourceUri(R.drawable.ic_auto_discover),
                true,
                true,
                null
            ));
            items.add(createMediaItem(
                CATEGORY_FAVORITES,
                "Favoritos",
                "Tus canciones preferidas",
                getResourceUri(R.drawable.ic_auto_favorites),
                true,
                false,
                null
            ));
            items.add(createMediaItem(
                CATEGORY_PLAYLISTS,
                "Listas",
                "Colecciones y listas populares",
                getResourceUri(R.drawable.ic_auto_playlists),
                true,
                true,
                null
            ));
            items.add(createMediaItem(
                CATEGORY_PODCASTS,
                "Podcasts",
                "Programas, comedia e historia",
                getResourceUri(R.drawable.ic_auto_podcasts),
                true,
                true,
                null
            ));
        } else if (CATEGORY_EXPLORE.equals(parentMediaId)) {
            populateExploreCategory(items);
        } else if (CATEGORY_PLAYLISTS.equals(parentMediaId)) {
            populatePlaylistsCategory(items);
        } else if (parentMediaId.startsWith("playlist:")) {
            populatePlaylistTracks(parentMediaId.substring("playlist:".length()), items);
        } else if (CATEGORY_FAVORITES.equals(parentMediaId)) {
            populateFavoritesCategory(items);
        }

        result.sendResult(items);
    }

    private void populateExploreCategory(List<MediaBrowserCompat.MediaItem> items) {
        final String GROUP_ROAD = "Música para el viaje";
        items.add(createMediaItem("search_play:Música para Conducir", "Para Conducir", "Ritmo, asfalto y energía", ArtworkContentProvider.getPresetUri("cover_driving"), false, true, GROUP_ROAD));
        items.add(createMediaItem("search_play:Top España 2026", "Top España 2026", "Los mayores éxitos del país", ArtworkContentProvider.getPresetUri("cover_spain"), false, true, GROUP_ROAD));
        items.add(createMediaItem("search_play:Rock Clásico", "Rock Carretera", "Guitarras y leyendas del rock", ArtworkContentProvider.getPresetUri("cover_rock"), false, true, GROUP_ROAD));
        items.add(createMediaItem("search_play:Reggaeton Éxitos", "Reggaetón & Urbano", "Flow y pista de baile", ArtworkContentProvider.getPresetUri("cover_reggaeton"), false, true, GROUP_ROAD));

        final String GROUP_MOODS = "Géneros y Estados de Ánimo";
        items.add(createMediaItem("search_play:Chill Lo-Fi Beats", "Chill & Lo-Fi", "Calma y concentración", ArtworkContentProvider.getPresetUri("cover_lofi"), false, true, GROUP_MOODS));
        items.add(createMediaItem("search_play:Pop Internacional", "Pop Internacional", "Los hits más cantados", ArtworkContentProvider.getPresetUri("cover_pop"), false, true, GROUP_MOODS));
        items.add(createMediaItem("search_play:Éxitos de los 80 y 90", "Nostalgia 80s 90s", "Éxitos dorados de dos décadas", ArtworkContentProvider.getPresetUri("cover_retro"), false, true, GROUP_MOODS));
        items.add(createMediaItem("search_play:Electrónica Dance", "Electrónica & Club", "Beats y energía dance", ArtworkContentProvider.getPresetUri("cover_electronic"), false, true, GROUP_MOODS));
        items.add(createMediaItem("search_play:Tendencias Virales", "Tendencias Virales", "Lo más sonado en redes", ArtworkContentProvider.getPresetUri("cover_viral"), false, true, GROUP_MOODS));
        items.add(createMediaItem("search_play:Novedades Semanales", "Novedades de la Semana", "Estrenos recién publicados", ArtworkContentProvider.getPresetUri("cover_new"), false, true, GROUP_MOODS));
    }

    private void loadPodcastsAsync(final Result<List<MediaBrowserCompat.MediaItem>> result) {
        asyncExecutor.execute(() -> {
            List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();

            final String GROUP_GENRES = "Categorías de Podcasts";
            items.add(createMediaItem("podcast_genre:comedia española podcast", "Comedia & Risas", "Humor, anécdotas y monólogos", ArtworkContentProvider.getPresetUri("cover_podcast_comedy"), true, true, GROUP_GENRES));
            items.add(createMediaItem("podcast_genre:true crime misterio español", "Crimen & Misterio", "Investigación y misterios", ArtworkContentProvider.getPresetUri("cover_podcast_truecrime"), true, true, GROUP_GENRES));
            items.add(createMediaItem("podcast_genre:tecnologia inteligencia artificial podcast", "Tecnología & IA", "Innovación, futuro y gadgets", ArtworkContentProvider.getPresetUri("cover_podcast_tech"), true, true, GROUP_GENRES));
            items.add(createMediaItem("podcast_genre:historia podcast español", "Historia Viva", "Grandes momentos de la humanidad", ArtworkContentProvider.getPresetUri("cover_podcast_history"), true, true, GROUP_GENRES));
            items.add(createMediaItem("podcast_genre:noticias actualidad diario", "Noticias al Día", "La actualidad en minutos", ArtworkContentProvider.getPresetUri("cover_podcast_news"), true, true, GROUP_GENRES));
            items.add(createMediaItem("podcast_genre:deportes motor formula 1 futbol", "Deportes & Motor", "Fútbol, F1 y debates", ArtworkContentProvider.getPresetUri("cover_podcast_sports"), true, true, GROUP_GENRES));
            items.add(createMediaItem("podcast_genre:ciencia cosmos universo", "Ciencia & Cosmos", "Descubrimientos del universo", ArtworkContentProvider.getPresetUri("cover_podcast_science"), true, true, GROUP_GENRES));
            items.add(createMediaItem("podcast_genre:cultura cine libros", "Cultura & Arte", "Cine, libros y reflexiones", ArtworkContentProvider.getPresetUri("cover_podcast_culture"), true, true, GROUP_GENRES));

            final String GROUP_FEATURED = "Programas Populares";
            items.add(createMediaItem("podcast:todopoderosos", "Todopoderosos", "Cultura, cine y humor", ArtworkContentProvider.getRemoteUri("https://static-ivoox.epimg.net/canales/3/2/5/1/11325_big.jpg"), false, true, GROUP_FEATURED));
            items.add(createMediaItem("podcast:the-wild-project", "The Wild Project", "Charlas e invitados con Jordi Wild", ArtworkContentProvider.getRemoteUri("https://i.scdn.co/image/ab6765630000ba8a798f480fe98dfce4b1bc41fc"), false, true, GROUP_FEATURED));
            items.add(createMediaItem("podcast:la-ruina", "La Ruina", "Ignasi Taltavull y Tomàs Fuentes", ArtworkContentProvider.getRemoteUri("https://i.scdn.co/image/ab6765630000ba8aa410d10b784a0d81fc69c6cf"), false, true, GROUP_FEATURED));
            items.add(createMediaItem("podcast:nadie-sabe-nada", "Nadie Sabe Nada", "Andreu Buenafuente y Berto Romero", ArtworkContentProvider.getRemoteUri("https://i.scdn.co/image/ab6765630000ba8a83fa716757545ee2b1fa8519"), false, true, GROUP_FEATURED));

            result.sendResult(items);
        });
    }

    private void loadPodcastGenreAsync(final String genreQuery, final Result<List<MediaBrowserCompat.MediaItem>> result) {
        asyncExecutor.execute(() -> {
            List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();
            try {
                String encodedQuery = URLEncoder.encode(genreQuery, "UTF-8");
                URL apiUrl = new URL("https://itunes.apple.com/search?term=" + encodedQuery + "&entity=podcast&limit=16&country=ES");
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
                            Uri artUri = !artworkUrl.isEmpty()
                                ? ArtworkContentProvider.getRemoteUri(artworkUrl)
                                : ArtworkContentProvider.getPresetUri("cover_podcast_tech");

                            items.add(createMediaItem("podcast:" + podcastSlug, podcastName, artistName, artUri, false, true, null));
                        }
                    }
                } else {
                    conn.disconnect();
                }
            } catch (Throwable error) {
                Log.w(TAG, "Podcast genre search failed: " + genreQuery, error);
            }

            if (items.isEmpty()) {
                items.add(createMediaItem(
                    "podcast:" + genreQuery,
                    "Buscar: " + genreQuery,
                    "Reproducir último episodio",
                    ArtworkContentProvider.getPresetUri("cover_podcast_comedy"),
                    false,
                    true,
                    null
                ));
            }

            result.sendResult(items);
        });
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

    private void populatePlaylistsCategory(List<MediaBrowserCompat.MediaItem> items) {
        JSONObject catalog = getStructuredCatalog();
        JSONArray playlists = catalog.optJSONArray("playlists");
        final String GROUP_USER = "Tus Listas Creadas";

        if (playlists != null && playlists.length() > 0) {
            for (int index = 0; index < playlists.length(); index++) {
                JSONObject playlist = playlists.optJSONObject(index);
                if (playlist == null) continue;
                String id = playlist.optString("id");
                String name = playlist.optString("name", "Lista");
                String artwork = playlist.optString("artworkUrl", "");
                int count = playlist.optInt("trackCount", 0);
                String subtitle = count > 0 ? count + " canciones" : "Lista personal";

                Uri uri = !artwork.isEmpty()
                    ? ArtworkContentProvider.getRemoteUri(artwork)
                    : ArtworkContentProvider.getGeneratedUri(name, subtitle, "LISTA");

                JSONArray trackItems = playlist.optJSONArray("items");
                boolean hasTracks = trackItems != null && trackItems.length() > 0;
                items.add(createMediaItem(
                    hasTracks ? "playlist:" + id : "playlist_play:" + id,
                    name,
                    subtitle,
                    uri,
                    hasTracks,
                    true,
                    GROUP_USER
                ));
            }
        }

        final String GROUP_POPULAR = "Listas Populares";
        items.add(createMediaItem("playlist_play:spotify_top", "Today's Top Hits", "Los mayores éxitos globales", ArtworkContentProvider.getPresetUri("cover_pop"), false, true, GROUP_POPULAR));
        items.add(createMediaItem("playlist_play:retro_80s_90s", "Éxitos 80s y 90s", "Clásicos dorados del pop y rock", ArtworkContentProvider.getPresetUri("cover_retro"), false, true, GROUP_POPULAR));
        items.add(createMediaItem("playlist_play:spotify_rock", "Rock Classics", "Leyendas e himnos del rock", ArtworkContentProvider.getPresetUri("cover_rock"), false, true, GROUP_POPULAR));
        items.add(createMediaItem("playlist_play:spotify_latino", "Viva Latino", "Grandes éxitos de música latina", ArtworkContentProvider.getPresetUri("cover_reggaeton"), false, true, GROUP_POPULAR));
        items.add(createMediaItem("playlist_play:yt_top", "Top Canciones", "Éxitos más escuchados en YouTube Music", ArtworkContentProvider.getPresetUri("cover_spain"), false, true, GROUP_POPULAR));
    }

    private void populatePlaylistTracks(String playlistId, List<MediaBrowserCompat.MediaItem> items) {
        items.add(createMediaItem(
            "playlist_play:" + playlistId,
            "▶ Reproducir todo",
            "Iniciar reproducción completa",
            ArtworkContentProvider.getPresetUri("cover_driving"),
            false,
            false,
            "Acciones"
        ));

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
                            Uri uri = !artwork.isEmpty()
                                ? ArtworkContentProvider.getRemoteUri(artwork)
                                : ArtworkContentProvider.getGeneratedUri(title, artist, "PISTA");
                            items.add(createMediaItem("playid:" + id, title, artist, uri, false, false, "Canciones"));
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
            items.add(createMediaItem(
                "play_favorites_shuffle",
                "▶ Reproducir favoritos aleatorio",
                favorites.length() + " canciones guardadas",
                ArtworkContentProvider.getPresetUri("cover_favorites"),
                false,
                false,
                "Acciones"
            ));

            for (int index = 0; index < favorites.length(); index++) {
                JSONObject item = favorites.optJSONObject(index);
                if (item == null) continue;
                String id = item.optString("id");
                String title = item.optString("title", "Canción");
                String artist = item.optString("artist", "");
                String artwork = item.optString("artworkUrl", "");

                Uri uri = !artwork.isEmpty()
                    ? ArtworkContentProvider.getRemoteUri(artwork)
                    : ArtworkContentProvider.getGeneratedUri(title, artist, "FAV");

                items.add(createMediaItem("playid:" + id, title, artist, uri, false, false, "Tus Canciones Favoritas"));
            }
        } else {
            items.add(createMediaItem(
                "empty_fav",
                "Sin favoritos guardados",
                "Marca canciones con el corazón en Aurora",
                ArtworkContentProvider.getPresetUri("cover_favorites"),
                false,
                false,
                null
            ));
        }
    }

    @Override
    public void onSearch(String query, Bundle extras, Result<List<MediaBrowserCompat.MediaItem>> result) {
        List<MediaBrowserCompat.MediaItem> matches = new ArrayList<>();
        String normalized = stripDiacritics(query == null ? "" : query.toLowerCase().trim());

        if (!normalized.isEmpty()) {
            matches.add(createMediaItem(
                "search_play:" + query,
                "Reproducir \"" + query + "\" en streaming",
                "Buscar en YouTube Music y reproducir",
                ArtworkContentProvider.getPresetUri("cover_driving"),
                false,
                false,
                "Búsqueda Rápida"
            ));

            String podcastSlug = normalized.replaceAll("[^a-z0-9 ]+", "").trim().replaceAll(" +", "-");
            matches.add(createMediaItem(
                "podcast:" + podcastSlug,
                "Podcast: \"" + query + "\"",
                "Buscar podcast y reproducir episodio",
                ArtworkContentProvider.getPresetUri("cover_podcast_tech"),
                false,
                false,
                "Búsqueda Rápida"
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

                String itemNorm = stripDiacritics((title + " " + artist).toLowerCase());
                if (itemNorm.contains(normalized)) {
                    Uri uri = !artwork.isEmpty()
                        ? ArtworkContentProvider.getRemoteUri(artwork)
                        : ArtworkContentProvider.getGeneratedUri(title, artist, "TRACK");

                    matches.add(createMediaItem("playid:" + id, title, artist, uri, false, false, "En tu biblioteca"));
                    if (matches.size() >= 25) break;
                }
            }
            if (matches.size() >= 25) break;
        }

        result.sendResult(matches);
    }

    private static String stripDiacritics(String str) {
        if (str == null) return "";
        String normalized = Normalizer.normalize(str, Normalizer.Form.NFD);
        return normalized.replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
    }

    @Override
    public void onDestroy() {
        if (sInstance == this) {
            sInstance = null;
        }
        MediaSessionCompat session = AuroraMediaSessionHolder.getSession();
        if (session != null && AudioForegroundService.getInstance() == null) {
            session.setActive(false);
            session.release();
        }
        asyncExecutor.shutdownNow();
        super.onDestroy();
    }
}
