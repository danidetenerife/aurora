import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import { Music, PlayCircle, Search } from 'lucide-react';
import { FC, useCallback, useEffect, useMemo } from 'react';

import { useTranslation } from '@nuclearplayer/i18n';
import { pickArtwork, Track } from '@nuclearplayer/model';
import { Toaster } from '@nuclearplayer/ui';

import { playbackManager } from '../../services/playback';
import { initSpatialNavigation } from '../../services/spatialNavigation';
import { useFavoritesStore } from '../../stores/favoritesStore';
import { useQueueStore } from '../../stores/queueStore';
import { useStartupStore } from '../../stores/startupStore';
import { useTvStore } from '../../stores/tvStore';
import { sortByAddedAtDesc } from '../../utils/sort';
import { ConnectedSettingsModal } from '../ConnectedSettingsModal';
import { SoundProvider } from '../SoundProvider';
import { StreamResolver } from '../StreamResolver';
import { TvContentRow } from './TvContentRow';
import { TvFocusableCard } from './TvFocusableCard';
import { TvNavRail } from './TvNavRail';
import { TvNowPlayingBar } from './TvNowPlayingBar';
import { TvSearchOverlay } from './TvSearchOverlay';

const TvDashboardContent: FC = () => {
  const { t } = useTranslation('navigation');
  const favoriteAlbums = useFavoritesStore((state) => state.albums);
  const favoriteTracks = useFavoritesStore((state) => state.tracks);
  const openSearch = useTvStore((state) => state.openSearch);

  const sortedAlbums = useMemo(
    () => sortByAddedAtDesc(favoriteAlbums).slice(0, 20),
    [favoriteAlbums],
  );

  const sortedTracks = useMemo(
    () => sortByAddedAtDesc(favoriteTracks).slice(0, 20),
    [favoriteTracks],
  );

  const queueItems = useQueueStore((state) => state.items);
  const recentQueueItems = useMemo(() => queueItems.slice(0, 20), [queueItems]);

  const handlePlayQueueItem = useCallback((index: number) => {
    useQueueStore.getState().goToIndex(index);
    playbackManager.play();
  }, []);

  const handlePlayTrack = useCallback((track: unknown) => {
    useQueueStore.getState().addToQueue([track as Track]);
    playbackManager.play();
  }, []);

  const handlePlayAlbum = useCallback((album: unknown) => {
    const albumAny = album as { tracks?: Track[] };
    if (albumAny.tracks && albumAny.tracks.length > 0) {
      useQueueStore.getState().clearQueue();
      useQueueStore.getState().addToQueue(albumAny.tracks);
      playbackManager.play();
    }
  }, []);

  return (
    <div className="flex flex-col gap-8 py-4">
      {recentQueueItems.length > 0 && (
        <TvContentRow title="Queue" focusKey="tv-dashboard-queue">
          {recentQueueItems.map((item, index) => (
            <TvFocusableCard
              key={`${item.track.source?.provider}-${item.track.source?.id}-${index}`}
              title={item.track.title ?? ''}
              subtitle={item.track.artists?.[0]?.name}
              src={pickArtwork(item.track.artwork, 'thumbnail', 300)?.url}
              focusKey={`tv-queue-${index}`}
              onClick={() => handlePlayQueueItem(index)}
            />
          ))}
        </TvContentRow>
      )}

      {sortedAlbums.length > 0 && (
        <TvContentRow
          title={t('favoriteAlbums')}
          focusKey="tv-dashboard-albums"
          badge={String(sortedAlbums.length)}
        >
          {sortedAlbums.map((entry) => (
            <TvFocusableCard
              key={`${entry.ref.source.provider}-${entry.ref.source.id}`}
              title={entry.ref.title}
              src={pickArtwork(entry.ref.artwork, 'cover', 300)?.url}
              focusKey={`tv-album-${entry.ref.source.id}`}
              onClick={() => handlePlayAlbum(entry.ref)}
            />
          ))}
        </TvContentRow>
      )}

      {sortedTracks.length > 0 && (
        <TvContentRow
          title={t('favoriteTracks')}
          focusKey="tv-dashboard-tracks"
          badge={String(sortedTracks.length)}
        >
          {sortedTracks.map((entry) => (
            <TvFocusableCard
              key={`${entry.ref.source?.provider}-${entry.ref.source?.id}`}
              title={entry.ref.title ?? ''}
              subtitle={entry.ref.artists?.[0]?.name}
              src={pickArtwork(entry.ref.artwork, 'thumbnail', 300)?.url}
              focusKey={`tv-track-${entry.ref.source?.id}`}
              onClick={() => handlePlayTrack(entry.ref)}
            />
          ))}
        </TvContentRow>
      )}

      {sortedAlbums.length === 0 &&
        sortedTracks.length === 0 &&
        recentQueueItems.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 py-16 text-zinc-400">
            <Music size={56} className="text-zinc-600 opacity-60" />
            <p className="text-xl font-medium text-white">
              Start exploring music to see your favorites here
            </p>
            <div className="flex gap-4">
              <TvFocusableCard
                title="Search Music"
                subtitle="Explore songs & artists"
                focusKey="tv-empty-search"
                onClick={() => openSearch()}
              >
                <Search size={32} />
              </TvFocusableCard>
              <TvFocusableCard
                title="Now Playing"
                subtitle="Open player controls"
                focusKey="tv-empty-player"
                onClick={() => setFocus('tv-control-play')}
              >
                <PlayCircle size={32} />
              </TvFocusableCard>
            </div>
          </div>
        )}
    </div>
  );
};

const TvFavoritesContent: FC = () => {
  const { t } = useTranslation('navigation');
  const favoriteAlbums = useFavoritesStore((state) => state.albums);
  const favoriteTracks = useFavoritesStore((state) => state.tracks);

  const sortedAlbums = useMemo(
    () => sortByAddedAtDesc(favoriteAlbums),
    [favoriteAlbums],
  );

  const sortedTracks = useMemo(
    () => sortByAddedAtDesc(favoriteTracks),
    [favoriteTracks],
  );

  const handlePlayTrack = useCallback((track: unknown) => {
    useQueueStore.getState().addToQueue([track as Track]);
    playbackManager.play();
  }, []);

  const handlePlayAlbum = useCallback((album: unknown) => {
    const albumAny = album as { tracks?: Track[] };
    if (albumAny.tracks && albumAny.tracks.length > 0) {
      useQueueStore.getState().clearQueue();
      useQueueStore.getState().addToQueue(albumAny.tracks);
      playbackManager.play();
    }
  }, []);

  return (
    <div className="flex flex-col gap-8 py-4">
      {sortedAlbums.length > 0 && (
        <TvContentRow
          title={t('favoriteAlbums')}
          focusKey="tv-favorites-albums"
        >
          {sortedAlbums.map((entry) => (
            <TvFocusableCard
              key={`${entry.ref.source.provider}-${entry.ref.source.id}`}
              title={entry.ref.title}
              src={pickArtwork(entry.ref.artwork, 'cover', 300)?.url}
              focusKey={`tv-fav-album-${entry.ref.source.id}`}
              onClick={() => handlePlayAlbum(entry.ref)}
            />
          ))}
        </TvContentRow>
      )}

      {sortedTracks.length > 0 && (
        <TvContentRow
          title={t('favoriteTracks')}
          focusKey="tv-favorites-tracks"
        >
          {sortedTracks.map((entry) => (
            <TvFocusableCard
              key={`${entry.ref.source?.provider}-${entry.ref.source?.id}`}
              title={entry.ref.title ?? ''}
              subtitle={entry.ref.artists?.[0]?.name}
              src={pickArtwork(entry.ref.artwork, 'thumbnail', 300)?.url}
              focusKey={`tv-fav-track-${entry.ref.source?.id}`}
              onClick={() => handlePlayTrack(entry.ref)}
            />
          ))}
        </TvContentRow>
      )}
    </div>
  );
};

const TvPlaylistsContent: FC = () => {
  const { t } = useTranslation('navigation');

  return (
    <div className="flex flex-col gap-8 py-4">
      <TvContentRow title={t('playlists')} focusKey="tv-playlists-list">
        <TvFocusableCard title="Coming soon" focusKey="tv-playlist-placeholder">
          <Music size={48} className="opacity-40" />
        </TvFocusableCard>
      </TvContentRow>
    </div>
  );
};

const TvMainContent: FC = () => {
  const activeSection = useTvStore((state) => state.activeSection);
  const isStartingUp = useStartupStore((state) => state.isStartingUp);

  if (isStartingUp) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="border-primary size-12 animate-spin rounded-full border-3 border-t-transparent" />
      </div>
    );
  }

  switch (activeSection) {
    case 'favorites':
      return <TvFavoritesContent />;
    case 'playlists':
      return <TvPlaylistsContent />;
    case 'dashboard':
    default:
      return <TvDashboardContent />;
  }
};

export const TvShell: FC = () => {
  initSpatialNavigation();
  const isStartingUp = useStartupStore((state) => state.isStartingUp);
  const isSearchOpen = useTvStore((state) => state.isSearchOpen);
  const { ref, focusKey } = useFocusable({
    focusKey: 'TV_ROOT',
    isFocusBoundary: true,
  });

  useEffect(() => {
    setFocus('tv-nav-dashboard');
  }, []);

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={ref}
        data-testid="tv-shell"
        data-platform="tv"
        className="tv-shell box-border flex h-full w-full min-w-0 overflow-hidden bg-zinc-950 text-white select-none"
        onContextMenu={(event) => event.preventDefault()}
      >
        <TvNavRail />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <main className="min-h-0 flex-1 overflow-y-auto px-4">
            <TvMainContent />
          </main>

          <TvNowPlayingBar />
        </div>

        <SoundProvider>{!isStartingUp && <StreamResolver />}</SoundProvider>

        {isSearchOpen && <TvSearchOverlay />}

        <Toaster position="top-right" />
        <ConnectedSettingsModal />
      </div>
    </FocusContext.Provider>
  );
};
