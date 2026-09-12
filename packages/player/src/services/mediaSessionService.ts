import type { Track } from '@aurora/model';
import { pickArtwork } from '@aurora/model';

import { useFavoritesStore } from '../stores/favoritesStore';
import { usePlaylistStore } from '../stores/playlistStore';
import { useQueueStore } from '../stores/queueStore';
import { useSoundStore } from '../stores/soundStore';
import { metadataHost } from './metadataHost';
import { NativeMediaSessionPlugin } from './nativeMediaSession';
import { personalizationEngine } from './personalizationEngine';
import { playbackManager } from './playback';
import { isCapacitorEnvironment } from './universalStore';

const secondsToMs = (seconds: number): number => Math.round(seconds * 1000);

const syncAutoCatalog = (): void => {
  if (!isCapacitorEnvironment()) {
    return;
  }

  const queueState = useQueueStore.getState();
  const queueItems = queueState.items.slice(0, 50).map((item) => ({
    id: item.id,
    title: item.track.title,
    artist: item.track.artists?.map((credit) => credit.name).join(', ') || '',
    album: item.track.album?.title || '',
    artworkUrl: pickArtwork(item.track.artwork, 'thumbnail', 512)?.url || '',
  }));

  const favoritesState = useFavoritesStore.getState();
  const favorites = favoritesState.tracks.slice(0, 50).map((entry) => ({
    id: entry.ref.source?.id || entry.ref.title,
    title: entry.ref.title,
    artist: entry.ref.artists?.map((credit) => credit.name).join(', ') || '',
    album: entry.ref.album?.title || '',
    artworkUrl: pickArtwork(entry.ref.artwork, 'thumbnail', 512)?.url || '',
  }));

  const playlistState = usePlaylistStore.getState();
  const playlists = playlistState.index.slice(0, 20).map((entry) => {
    const fullPlaylist = playlistState.playlists.get(entry.id);
    const items =
      fullPlaylist?.items.slice(0, 25).map((item) => ({
        id: item.id,
        title: item.track.title,
        artist: item.track.artists?.map((credit) => credit.name).join(', ') || '',
        artworkUrl: pickArtwork(item.track.artwork, 'thumbnail', 512)?.url || '',
      })) || [];

    return {
      id: entry.id,
      name: entry.name,
      description: fullPlaylist?.description || '',
      artworkUrl:
        pickArtwork(entry.artwork, 'thumbnail', 512)?.url ||
        entry.thumbnails[0] ||
        '',
      trackCount: entry.itemCount,
      items,
    };
  });

  const popularPlaylists = [
    {
      id: 'spotify_top',
      name: "Today's Top Hits",
      description: 'Los mayores éxitos mundiales • Spotify',
      artworkUrl:
        'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop',
      items: [],
    },
    {
      id: 'spotify_latino',
      name: 'Viva Latino',
      description: 'Lo mejor de la música latina • Spotify',
      artworkUrl:
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop',
      items: [],
    },
    {
      id: 'spotify_rock',
      name: 'Rock Classics',
      description: 'Grandes leyendas del rock • Spotify',
      artworkUrl:
        'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=600&auto=format&fit=crop',
      items: [],
    },
    {
      id: 'yt_top',
      name: 'Top Canciones',
      description: 'Tendencias globales de YouTube Music',
      artworkUrl:
        'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop',
      items: [],
    },
    {
      id: 'yt_exitos',
      name: 'Éxitos Globales',
      description: 'Canciones más escuchadas en todo el planeta',
      artworkUrl:
        'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&auto=format&fit=crop',
      items: [],
    },
  ];

  const discover = [...favorites.slice(0, 10), ...queueItems.slice(0, 10)];

  const catalogPayload = {
    queue: queueItems,
    favorites,
    playlists,
    popularPlaylists,
    discover,
  };

  NativeMediaSessionPlugin.updateAutoCatalog({
    json: JSON.stringify(catalogPayload),
  }).catch(() => {});
};

export const initMediaSessionService = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  const hasWebMediaSession = 'mediaSession' in navigator;

  if (hasWebMediaSession) {
    try {
      navigator.mediaSession.setActionHandler('play', () => {
        playbackManager.play();
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        playbackManager.pause();
      });

      navigator.mediaSession.setActionHandler('previoustrack', () => {
        useQueueStore.getState().goToPrevious();
      });

      navigator.mediaSession.setActionHandler('nexttrack', () => {
        useQueueStore.getState().goToNext();
      });

      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime != null) {
          useSoundStore.getState().seekTo(details.seekTime);
        }
      });
    } catch {
      // ignore
    }
  }

  let lastSentItemId: string | null = null;

  useQueueStore.subscribe((state) => {
    syncAutoCatalog();

    const currentItem = state.getCurrentItem();
    if (!currentItem) {
      return;
    }

    if (currentItem.id === lastSentItemId) {
      return;
    }
    lastSentItemId = currentItem.id;

    const track = currentItem.track;
    const artwork = pickArtwork(track.artwork, 'thumbnail', 512);
    const artist =
      track.artists?.map((artistCredit) => artistCredit.name).join(', ') || '';
    const albumTitle = track.album?.title || '';
    const artworkUrl = artwork?.url || '';

    if (hasWebMediaSession) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title,
          artist,
          album: albumTitle,
          artwork: artworkUrl
            ? [
                {
                  src: artworkUrl,
                  sizes: '512x512',
                  type: 'image/png',
                },
              ]
            : [],
        });
      } catch {
        // ignore
      }
    }

    const durationMs = track.durationMs;

    if (isCapacitorEnvironment()) {
      NativeMediaSessionPlugin.updateMetadata({
        title: track.title,
        artist,
        album: albumTitle,
        artworkUrl,
        durationMs,
      }).catch(() => {});
    }
  });

  useFavoritesStore.subscribe(() => {
    syncAutoCatalog();
  });

  usePlaylistStore.subscribe(() => {
    syncAutoCatalog();
  });

  syncAutoCatalog();

  let lastStatus = '';
  let lastReportedSeek = 0;
  let lastReportedTime = 0;

  useSoundStore.subscribe((state) => {
    const isPlaying = state.status === 'playing';
    const statusChanged = state.status !== lastStatus;
    const now = Date.now();
    const seekDelta = Math.abs(state.seek - lastReportedSeek);
    const timeDelta = now - lastReportedTime;

    try {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    } catch {
      // ignore
    }

    if (isCapacitorEnvironment()) {
      if (statusChanged) {
        lastStatus = state.status;
        lastReportedSeek = state.seek;
        lastReportedTime = now;

        NativeMediaSessionPlugin.updatePlaybackState({
          isPlaying,
          positionMs: secondsToMs(state.seek),
        }).catch(() => {});
      } else if (seekDelta > 3 || timeDelta > 15000) {
        lastReportedSeek = state.seek;
        lastReportedTime = now;

        NativeMediaSessionPlugin.updatePosition({
          positionMs: secondsToMs(state.seek),
        }).catch(() => {});
      }
    }
  });

  if (isCapacitorEnvironment()) {
    NativeMediaSessionPlugin.addListener('mediaAction', (data) => {
      if (data.action.startsWith('playid:')) {
        const requestedId = data.action.slice('playid:'.length);
        const queue = useQueueStore.getState();
        const requestedIndex = queue.items.findIndex(
          (item) => item.id === requestedId,
        );
        if (requestedIndex >= 0) {
          queue.goToIndex(requestedIndex);
          playbackManager.play();
          return;
        }

        const favTrack = useFavoritesStore
          .getState()
          .tracks.find(
            (entry) =>
              entry.ref.source?.id === requestedId ||
              entry.ref.title === requestedId,
          )?.ref;

        if (favTrack) {
          queue.addToQueue([favTrack]);
          queue.goToIndex(queue.items.length - 1);
          playbackManager.play();
          return;
        }

        void metadataHost
          .search({ query: requestedId, types: ['tracks'], limit: 5 })
          .then((results) => {
            const tracks = results.tracks ?? [];
            if (tracks.length) {
              queue.addToQueue([tracks[0]]);
              queue.goToIndex(queue.items.length - 1);
              playbackManager.play();
            }
          });
        return;
      }

      if (
        data.action.startsWith('playlist:') ||
        data.action.startsWith('playlist_play:')
      ) {
        const prefix = data.action.startsWith('playlist_play:')
          ? 'playlist_play:'
          : 'playlist:';
        const rawId = data.action.slice(prefix.length);

        const personalPlaylist = usePlaylistStore
          .getState()
          .playlists.get(rawId);
        if (personalPlaylist && personalPlaylist.items.length > 0) {
          const tracks = personalPlaylist.items.map((item) => item.track);
          const queue = useQueueStore.getState();
          queue.addToQueue(tracks);
          queue.goToIndex(queue.items.length - tracks.length);
          playbackManager.play();
          return;
        }

        const queryMap: Record<string, string> = {
          spotify_top: "Today's Top Hits",
          spotify_latino: 'Viva Latino',
          spotify_rock: 'Rock Classics',
          yt_top: 'Top canciones',
          yt_exitos: 'Éxitos globales',
        };
        const searchQuery = queryMap[rawId] || rawId;
        void metadataHost
          .search({ query: searchQuery, types: ['tracks'], limit: 25 })
          .then((results) => {
            const tracks = results.tracks ?? [];
            if (tracks.length) {
              const queue = useQueueStore.getState();
              queue.addToQueue(tracks);
              queue.goToIndex(queue.items.length - tracks.length);
              playbackManager.play();
            }
          });
        return;
      }

      if (data.action.startsWith('podcast:')) {
        const podcastId = data.action.slice('podcast:'.length);
        const knownPodcasts: Record<string, string> = {
          todopoderosos: 'Todopoderosos',
          'the-wild-project': 'The Wild Project',
          'nude-project': 'The Nude Project',
          'historia-national': 'Historia National Geographic',
          'la-ruina': 'La Ruina',
          'nadie-sabe-nada': 'Nadie Sabe Nada',
          daily: 'The Daily',
          serial: 'Serial',
        };
        const searchTerm =
          knownPodcasts[podcastId] || podcastId.replace(/-/g, ' ');
        void fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(
            searchTerm,
          )}&entity=podcast&limit=1`,
        )
          .then((response) => response.json())
          .then(async (resultData) => {
            const collectionId = resultData.results?.[0]?.collectionId;
            if (!collectionId) {
              return;
            }
            const epResponse = await fetch(
              `https://itunes.apple.com/lookup?id=${collectionId}&entity=podcastEpisode&limit=20`,
            );
            const epData = await epResponse.json();
            const firstEp = epData.results?.find(
              (entry: { kind?: string; episodeUrl?: string }) =>
                entry.kind === 'podcast-episode' && entry.episodeUrl,
            );
            if (firstEp) {
              const episodeTrack: Track = {
                title: firstEp.trackName ?? searchTerm,
                artists: [{ name: searchTerm, roles: ['host'] }],
                source: {
                  provider: 'podcast-audio',
                  id: String(firstEp.trackId),
                  url: firstEp.episodeUrl,
                },
                durationMs: firstEp.trackTimeMillis,
                artwork: {
                  items: firstEp.artworkUrl600
                    ? [{ url: firstEp.artworkUrl600, purpose: 'thumbnail' }]
                    : [],
                },
              };
              const queue = useQueueStore.getState();
              queue.addToQueue([episodeTrack]);
              queue.goToIndex(queue.items.length - 1);
              playbackManager.play();
            }
          })
          .catch((error) =>
            console.error('[mediaSessionService] podcast error', error),
          );
        return;
      }

      if (
        data.action.startsWith('search:') ||
        data.action.startsWith('search_play:')
      ) {
        const prefix = data.action.startsWith('search_play:')
          ? 'search_play:'
          : 'search:';
        const query = data.action.slice(prefix.length).trim();
        if (query) {
          void metadataHost
            .search({ query, types: ['tracks'], limit: 25 })
            .then((results) => {
              const tracks = results.tracks ?? [];
              if (tracks.length) {
                const queue = useQueueStore.getState();
                queue.addToQueue(tracks);
                queue.goToIndex(queue.items.length - tracks.length);
                playbackManager.play();
              }
            });
        }
        return;
      }

      switch (data.action) {
        case 'callstart':
          useSoundStore.getState().setCallActive(true);
          playbackManager.pause();
          break;
        case 'callend':
          useSoundStore.getState().setCallActive(false);
          break;
        case 'play':
          playbackManager.play();
          break;
        case 'pause':
          playbackManager.pause();
          break;
        case 'nexttrack':
          useQueueStore.getState().goToNext();
          break;
        case 'previoustrack':
          useQueueStore.getState().goToPrevious();
          break;
        case 'dislike': {
          const currentTrack = useQueueStore.getState().getCurrentItem()?.track;
          if (currentTrack) {
            const trackId =
              currentTrack.source?.id ||
              `${currentTrack.artists?.[0]?.name}-${currentTrack.title}`;
            void personalizationEngine.blacklistTrack(trackId);
            useQueueStore.getState().goToNext();
          }
          break;
        }
        case 'seekto':
          if (data.seekPositionMs != null && data.seekPositionMs >= 0) {
            useSoundStore.getState().seekTo(data.seekPositionMs / 1000);
          }
          break;
        case 'stop':
          playbackManager.pause();
          break;
      }
    }).catch(() => {});
  }
};
