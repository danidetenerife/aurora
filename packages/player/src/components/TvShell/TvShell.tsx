import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import { Music, Search } from 'lucide-react';
import { FC, useEffect, useMemo, useState } from 'react';
import { I18nextProvider } from 'react-i18next';

import { useTranslation } from '@aurora/i18n';
import { pickArtwork } from '@aurora/model';
import { Toaster } from '@aurora/ui';

import { playbackManager } from '../../services/playback';
import { initSpatialNavigation } from '../../services/spatialNavigation';
import { streamResolution } from '../../services/streamResolution';
import { useFavoritesStore } from '../../stores/favoritesStore';
import { usePlaylistStore } from '../../stores/playlistStore';
import { useQueueStore } from '../../stores/queueStore';
import { useStartupStore } from '../../stores/startupStore';
import { useTvStore } from '../../stores/tvStore';
import { sortByAddedAtDesc } from '../../utils/sort';
import { StreamResolver } from '../StreamResolver';
import { TvAutoUpdater } from './TvAutoUpdater';
import { TvButton } from './TvButton';
import { TvFocusableCard } from './TvFocusableCard';
import { tvI18n } from './tvI18n';
import { TvNavRail } from './TvNavRail';
import { TvNowPlayingBar } from './TvNowPlayingBar';
import { playTvTracks } from './tvPlayback';
import { TvSearchOverlay } from './TvSearchOverlay';
import { TvSoundProvider } from './TvSoundProvider';

const PAGE_SIZE = 24;
const TvMainContent: FC = () => {
  const { t } = useTranslation('tv');
  const section = useTvStore((state) => state.activeSection);
  const starting = useStartupStore((state) => state.isStartingUp);
  const favorites = useFavoritesStore((state) => state.tracks);
  const queue = useQueueStore((state) => state.items);
  const playlists = usePlaylistStore((state) => state.index);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [error, setError] = useState(false);
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
  const tracks =
    section === 'favorites'
      ? sortedFavorites.map((entry) => entry.ref)
      : queue.map((item) => item.track);
  const title =
    section === 'playlists'
      ? t('playlists')
      : section === 'favorites'
        ? t('favorites')
        : t('queue');
  return (
    <FocusContext.Provider value={focusKey}>
      <main ref={ref} className="tv-content">
        <h1>{title}</h1>
        {starting && <p role="status">{t('loading')}</p>}
        {error && <p role="alert">{t('playbackError')}</p>}
        <div className="tv-grid">
          {section === 'playlists'
            ? playlists.slice(0, limit).map((playlist) => (
                <TvFocusableCard
                  key={playlist.id}
                  title={playlist.name}
                  focusKey={`tv-playlist-${playlist.id}`}
                  onClick={() => {
                    void usePlaylistStore
                      .getState()
                      .loadPlaylist(playlist.id)
                      .then((result) => {
                        if (result?.items.length) {
                          playTvTracks(result.items.map((item) => item.track));
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
              ))
            : tracks.slice(0, limit).map((track, index) => (
                <TvFocusableCard
                  key={`${track.source?.provider}-${track.source?.id}-${index}`}
                  title={track.title ?? ''}
                  subtitle={track.artists
                    ?.map((artist) => artist.name)
                    .join(', ')}
                  src={pickArtwork(track.artwork, 'thumbnail', 200)?.url}
                  focusKey={`tv-content-track-${index}`}
                  onClick={() => {
                    if (section === 'favorites') {
                      playTvTracks(tracks, index);
                    } else {
                      const queue = useQueueStore.getState();
                      if (queue.currentIndex === index) {
                        const current = queue.getCurrentItem();
                        if (current && current.status !== 'success') {
                          void streamResolution.resolve(current, {
                            autoPlay: true,
                          });
                        } else {
                          playbackManager.toggle();
                        }
                      } else {
                        queue.goToIndex(index);
                        const item = queue.items[index];
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
          {(section === 'playlists' ? playlists.length : tracks.length) ===
            0 && <p className="tv-empty">{t('empty')}</p>}
          <TvFocusableCard
            title={t('search')}
            focusKey="tv-content-search"
            onClick={() => useTvStore.getState().openSearch()}
          >
            <Search />
          </TvFocusableCard>
        </div>
        {(section === 'playlists' ? playlists.length : tracks.length) >
          limit && (
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
  const { t } = useTranslation('tv');
  useEffect(() => {
    setFocus('tv-nav-dashboard');
  }, []);
  return (
    <div
      data-testid="tv-shell"
      data-platform="tv"
      className="tv-shell"
      lang="es"
      onContextMenu={(event) => event.preventDefault()}
    >
      <TvAutoUpdater />
      <TvNavRail />
      <TvMainContent />
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
