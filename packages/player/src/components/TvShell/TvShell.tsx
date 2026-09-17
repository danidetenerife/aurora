import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import { Music, Search } from 'lucide-react';
import { FC, useEffect, useMemo, useState } from 'react';
import { I18nextProvider } from 'react-i18next';

import { useTranslation } from '@aurora/i18n';
import { pickArtwork, type PodcastRef } from '@aurora/model';
import { cn, Toaster } from '@aurora/ui';

import { playbackManager } from '../../services/playback';
import { metadataHost } from '../../services/metadataHost';
import { podcastService } from '../../services/podcastService';
import { initSpatialNavigation } from '../../services/spatialNavigation';
import { streamResolution } from '../../services/streamResolution';
import { useFavoritesStore } from '../../stores/favoritesStore';
import { usePlaylistStore } from '../../stores/playlistStore';
import { POPULAR_YOUTUBE_PLAYLISTS } from './tvPlaylists';
import { usePodcastStore } from '../../stores/podcastStore';
import { useQueueStore } from '../../stores/queueStore';
import { useStartupStore } from '../../stores/startupStore';
import { useTvStore } from '../../stores/tvStore';
import { sortByAddedAtDesc } from '../../utils/sort';
import { StreamResolver } from '../StreamResolver';
import { TvAutoUpdater } from './TvAutoUpdater';
import { TvButton } from './TvButton';
import { TvDashboard } from './TvDashboard';
import { TvFocusableCard } from './TvFocusableCard';
import { tvI18n } from './tvI18n';
import { TvNavRail } from './TvNavRail';
import { TvNowPlayingBar } from './TvNowPlayingBar';
import { playTvTracks } from './tvPlayback';
import { TvPodcastDetail } from './TvPodcastDetail';
import { TvSearchOverlay } from './TvSearchOverlay';
import { TvSoundProvider } from './TvSoundProvider';
import { TvSyncSection } from './TvSyncSection';
import { TvVideoPlayer } from './TvVideoPlayer';
import { initTvInfiniteQueue } from './tvInfiniteQueue';

const PAGE_SIZE = 24;

const TvMainContent: FC = () => {
  const { t } = useTranslation('tv');
  const section = useTvStore((state) => state.activeSection);
  const selectedPodcast = useTvStore((state) => state.selectedPodcast);
  const setSelectedPodcast = useTvStore((state) => state.setSelectedPodcast);
  const starting = useStartupStore((state) => state.isStartingUp);
  const favorites = useFavoritesStore((state) => state.tracks);
  const queue = useQueueStore((state) => state.items);
  const playlists = usePlaylistStore((state) => state.index);
  const podcastFavorites = usePodcastStore((state) => state.favorites);
  const podcastsLoaded = usePodcastStore((state) => state.loaded);
  const loadPodcasts = usePodcastStore((state) => state.load);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [error, setError] = useState(false);
  const [podcastList, setPodcastList] = useState<PodcastRef[]>([]);

  const sortedFavorites = useMemo(
    () => sortByAddedAtDesc(favorites),
    [favorites],
  );

  const { ref, focusKey } = useFocusable({
    focusKey: 'TV_CONTENT',
    trackChildren: true,
    saveLastFocusedChild: true,
  });

  useEffect(() => {
    setLimit(PAGE_SIZE);
    setError(false);
  }, [section]);

  useEffect(() => {
    if (!podcastsLoaded) {
      void loadPodcasts();
    }
  }, [loadPodcasts, podcastsLoaded]);

  useEffect(() => {
    let active = true;
    void podcastService
      .getFeaturedPodcasts()
      .then((results) => {
        if (!active || results.length === 0) {
          return;
        }
        const mapped: PodcastRef[] = results.map((item) => ({
          id: item.id,
          name: item.name,
          publisher: item.publisher,
          artworkUrl: item.artwork,
          sourceUrl: `https://music.youtube.com/browse/${item.id}`,
        }));
        setPodcastList(mapped);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  if (section === 'dashboard') {
    return (
      <FocusContext.Provider value={focusKey}>
        <main ref={ref} className="tv-content">
          <TvDashboard />
        </main>
      </FocusContext.Provider>
    );
  }

  if (section === 'settings') {
    return (
      <FocusContext.Provider value={focusKey}>
        <main ref={ref} className="tv-content">
          <TvSyncSection />
        </main>
      </FocusContext.Provider>
    );
  }

  if (section === 'podcasts' && selectedPodcast) {
    return (
      <main className="tv-content">
        <TvPodcastDetail
          podcast={selectedPodcast}
          onBack={() => {
            const previousId = selectedPodcast.id;
            setSelectedPodcast(null);
            setTimeout(() => setFocus(`tv-podcast-${previousId}`), 0);
          }}
        />
      </main>
    );
  }

  const tracks =
    section === 'favorites'
      ? sortedFavorites.map((entry) => entry.ref)
      : queue.map((item) => item.track);

  const title =
    section === 'podcasts'
      ? 'Podcasts'
      : section === 'playlists'
        ? t('playlists')
        : section === 'favorites'
          ? t('favorites')
          : t('queue');

  const handlePlayPopularPlaylist = async (query: string) => {
    try {
      const response = await metadataHost.search({
        query,
        types: ['tracks'],
        limit: 30,
      });
      if (response.tracks?.length) {
        playTvTracks(response.tracks);
        setError(false);
      } else {
        useTvStore.getState().openSearch();
      }
    } catch {
      useTvStore.getState().openSearch();
    }
  };

  return (
    <FocusContext.Provider value={focusKey}>
      <main ref={ref} className="tv-content">
        <h1>{title}</h1>
        {starting && <p role="status">{t('loading')}</p>}
        {error && <p role="alert">{t('playbackError')}</p>}
        <div className="tv-grid">
          {section === 'podcasts'
            ? podcastList.map((podcast) => {
                const isFavorite = podcastFavorites.some((item) => item.id === podcast.id);
                return (
                  <TvFocusableCard
                    key={podcast.id}
                    title={`${podcast.name}${isFavorite ? ' ♥' : ''}`}
                    subtitle={podcast.publisher}
                    src={podcast.artworkUrl}
                    focusKey={`tv-podcast-${podcast.id}`}
                    onClick={() => setSelectedPodcast(podcast)}
                  >
                    <Music />
                  </TvFocusableCard>
                );
              })
            : section === 'playlists'
              ? [
                  ...playlists.map((playlist) => (
                    <TvFocusableCard
                      key={`user-${playlist.id}`}
                      title={playlist.name}
                      subtitle={`${playlist.itemCount ?? 0} ${t('episodesCount', { defaultValue: 'canciones' })} · Tu lista`}
                      src={playlist.thumbnails?.[0] ?? pickArtwork(playlist.artwork, 'thumbnail', 300)?.url}
                      focusKey={`tv-user-playlist-${playlist.id}`}
                      onClick={() => {
                        void usePlaylistStore
                          .getState()
                          .loadPlaylist(playlist.id)
                          .then((result) => {
                            if (result?.items.length) {
                              playTvTracks(
                                result.items.map((item) => item.track),
                              );
                              setError(false);
                            } else {
                              setError(true);
                            }
                          })
                          .catch(() => setError(true));
                      }}
                    >
                      <Music />
                    </TvFocusableCard>
                  )),
                  ...POPULAR_YOUTUBE_PLAYLISTS.map((popPlaylist) => (
                    <TvFocusableCard
                      key={`pop-${popPlaylist.id}`}
                      title={popPlaylist.title}
                      subtitle={`${popPlaylist.subtitle} · YouTube Music`}
                      src={popPlaylist.src}
                      focusKey={`tv-pop-playlist-${popPlaylist.id}`}
                      onClick={() => void handlePlayPopularPlaylist(popPlaylist.query)}
                    />
                  )),
                ].slice(0, limit)
              : tracks.slice(0, limit).map((track, index) => (
                  <TvFocusableCard
                    key={`${track.source?.provider}-${track.source?.id}-${index}`}
                    title={track.title ?? ''}
                    subtitle={track.artists
                      ?.map((artist) => artist.name)
                      .join(', ')}
                    src={pickArtwork(track.artwork ?? track.album?.artwork, 'thumbnail', 300)?.url}
                    focusKey={`tv-content-track-${index}`}
                    onClick={() => {
                      if (section === 'favorites') {
                        playTvTracks(tracks, index);
                      } else {
                        const q = useQueueStore.getState();
                        if (q.currentIndex === index) {
                          const current = q.getCurrentItem();
                          if (current && current.status !== 'success') {
                            void streamResolution.resolve(current, {
                              autoPlay: true,
                            });
                          } else {
                            playbackManager.toggle();
                          }
                        } else {
                          q.goToIndex(index);
                          const item = q.items[index];
                          if (item) {
                            void streamResolution.resolve(item, {
                              autoPlay: true,
                            });
                          } else {
                            playbackManager.play();
                          }
                        }
                      }
                    }}
                  >
                    <Music />
                  </TvFocusableCard>
                ))}
          {(section === 'playlists'
            ? playlists.length + POPULAR_YOUTUBE_PLAYLISTS.length
            : section === 'podcasts'
              ? podcastList.length
              : tracks.length) === 0 && (
            <p className="tv-empty">{t('empty')}</p>
          )}
          <TvFocusableCard
            title={t('search')}
            focusKey="tv-content-search"
            onClick={() => useTvStore.getState().openSearch()}
          >
            <Search />
          </TvFocusableCard>
        </div>
        {(section === 'playlists'
          ? playlists.length + POPULAR_YOUTUBE_PLAYLISTS.length
          : section === 'podcasts'
            ? podcastList.length
            : tracks.length) > limit && (
          <TvButton
            focusKey="tv-more"
            onClick={() => setLimit(limit + PAGE_SIZE)}
            destinations={{ down: 'tv-control-play', up: 'tv-nav-dashboard' }}
          >
            {t('more')}
          </TvButton>
        )}
      </main>
    </FocusContext.Provider>
  );
};

const TvShellContent: FC = () => {
  initSpatialNavigation();
  const starting = useStartupStore((state) => state.isStartingUp);
  const searchOpen = useTvStore((state) => state.isSearchOpen);
  const showVideo = useTvStore((state) => state.showVideo);
  const currentItem = useQueueStore((state) => state.getCurrentItem());
  const currentTrack = currentItem?.track;

  const { t } = useTranslation('tv');
  useEffect(() => {
    setFocus('tv-nav-dashboard');
    return initTvInfiniteQueue();
  }, []);

  useEffect(() => {
    const handleBack = (event: Event) => {
      if (
        event instanceof KeyboardEvent &&
        event.key !== 'Escape' &&
        event.key !== 'Back'
      ) {
        return;
      }
      const state = useTvStore.getState();
      if (state.isSearchOpen) {
        event.preventDefault();
        event.stopImmediatePropagation();
        state.closeSearch();
      } else if (state.showVideo) {
        event.preventDefault();
        event.stopImmediatePropagation();
        state.setShowVideo(false);
        setTimeout(() => {
          setFocus('tv-hero-video');
        }, 50);
      } else if (state.selectedPodcast) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const previousId = state.selectedPodcast.id;
        state.setSelectedPodcast(null);
        setTimeout(() => setFocus(`tv-podcast-${previousId}`), 0);
      } else if (state.activeSection !== 'dashboard') {
        event.preventDefault();
        event.stopImmediatePropagation();
        state.setActiveSection('dashboard');
        setTimeout(() => {
          setFocus('tv-nav-dashboard');
        }, 50);
      }
    };
    window.addEventListener('tv:back', handleBack);
    window.addEventListener('keydown', handleBack, true);
    return () => {
      window.removeEventListener('tv:back', handleBack);
      window.removeEventListener('keydown', handleBack, true);
    };
  }, []);

  return (
    <div
      data-testid="tv-shell"
      data-platform="tv"
      className={cn('tv-shell', showVideo && 'tv-video-active')}
      lang="es"
      onContextMenu={(event) => event.preventDefault()}
    >
      <TvAutoUpdater />
      <TvNavRail />
      {showVideo ? (
        <TvVideoPlayer track={currentTrack} />
      ) : (
        <TvMainContent />
      )}
      <TvNowPlayingBar />
      <p className="tv-hint">{t('hint')}</p>
      <TvSoundProvider>{!starting && <StreamResolver />}</TvSoundProvider>
      {searchOpen && <TvSearchOverlay />}
      <Toaster position="top-right" />
    </div>
  );
};

export const TvShell: FC = () => (
  <I18nextProvider i18n={tvI18n}>
    <TvShellContent />
  </I18nextProvider>
);
