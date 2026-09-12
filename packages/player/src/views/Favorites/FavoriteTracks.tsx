import { Music } from 'lucide-react';
import { useEffect, useMemo, type FC } from 'react';

import { useTranslation } from '@aurora/i18n';
import { EmptyState, ViewShell } from '@aurora/ui';

import { ConnectedTrackTable } from '../../components/ConnectedTrackTable';
import { MobileTrackPages } from '../../components/MobileTrackPages';
import { isCapacitorEnvironment } from '../../services/universalStore';
import { enrichFavoriteTracks } from '../../services/artworkEnricher';
import { useFavoritesStore } from '../../stores/favoritesStore';
import { sortByAddedAtDesc } from '../../utils/sort';

export const FavoriteTracks: FC = () => {
  const { t } = useTranslation('favorites');
  const favorites = useFavoritesStore((state) => state.tracks);

  useEffect(() => {
    void enrichFavoriteTracks();
  }, [favorites]);

  const sortedTracks = useMemo(
    () => sortByAddedAtDesc(favorites).map((entry) => entry.ref),
    [favorites],
  );

  const hasDuration = sortedTracks.some((track) => track.durationMs != null);

  return (
    <ViewShell data-testid="favorite-tracks-view" title={t('tracks.title')} classes={isCapacitorEnvironment() ? { root: 'aurora-mobile-library' } : undefined}>
      {sortedTracks.length === 0 ? (
        <EmptyState
          icon={<Music size={48} />}
          title={t('tracks.empty')}
          description={t('tracks.emptyDescription')}
          className="flex-1"
        />
      ) : (
        isCapacitorEnvironment() ? <MobileTrackPages tracks={sortedTracks} /> : <ConnectedTrackTable
          tracks={sortedTracks}
          features={{
            header: true,
            filterable: true,
            sortable: true,
            playAll: true,
            addAllToQueue: true,
          }}
          display={{
            displayThumbnail: true,
            displayArtist: true,
            displayDuration: hasDuration,
            displayQueueControls: true,
          }}
        />
      )}
    </ViewShell>
  );
};
