import {
  FocusContext,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import { Music } from 'lucide-react';
import { FC, useMemo } from 'react';

import { useTranslation } from '@nuclearplayer/i18n';
import { pickArtwork } from '@nuclearplayer/model';
import { Toaster } from '@nuclearplayer/ui';

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

  return (
    <div className="flex flex-col gap-8 py-6">
      {recentQueueItems.length > 0 && (
        <TvContentRow title="Queue" focusKey="tv-dashboard-queue">
          {recentQueueItems.map((item, index) => (
            <TvFocusableCard
              key={`${item.track.source?.provider}-${item.track.source?.id}-${index}`}
              title={item.track.title ?? ''}
              subtitle={item.track.artists?.[0]?.name}
              src={pickArtwork(item.track.artwork, 'thumbnail', 300)?.url}
              focusKey={`tv-queue-${index}`}
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
            />
          ))}
        </TvContentRow>
      )}

      {sortedAlbums.length === 0 &&
        sortedTracks.length === 0 &&
        recentQueueItems.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-zinc-500">
            <Music size={64} className="opacity-40" />
            <p className="text-xl font-medium">
              Start exploring music to see your favorites here
            </p>
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

  return (
    <div className="flex flex-col gap-8 py-6">
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
    <div className="flex flex-col gap-8 py-6">
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
  const { ref, focusKey } = useFocusable({
    focusKey: 'TV_ROOT',
    isFocusBoundary: true,
  });

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={ref}
        data-testid="tv-shell"
        data-platform="tv"
        className="flex h-[100dvh] w-full overflow-hidden bg-zinc-950 text-white select-none"
        onContextMenu={(event) => event.preventDefault()}
      >
        <TvNavRail />

        <div className="flex min-w-0 flex-1 flex-col">
          <main className="min-h-0 flex-1 overflow-y-auto">
            <TvMainContent />
          </main>

          <TvNowPlayingBar />
        </div>

        <SoundProvider>
          <StreamResolver />
        </SoundProvider>

        <TvSearchOverlay />

        <Toaster position="top-right" />
        <ConnectedSettingsModal />
      </div>
    </FocusContext.Provider>
  );
};
