import { useNavigate } from '@tanstack/react-router';
import { Disc3 } from 'lucide-react';
import { useMemo, type FC } from 'react';

import { useTranslation } from '@aurora/i18n';
import { pickArtwork } from '@aurora/model';
import { Card, CardGrid, EmptyState, ViewShell } from '@aurora/ui';

import { ConnectedFavoriteButton } from '../../components/ConnectedFavoriteButton';
import { useFavoritesStore } from '../../stores/favoritesStore';
import { sortByAddedAtDesc } from '../../utils/sort';

export const FavoriteAlbums: FC = () => {
  const { t } = useTranslation('favorites');
  const navigate = useNavigate();
  const albums = useFavoritesStore((state) => state.albums);

  const sortedAlbums = useMemo(() => sortByAddedAtDesc(albums), [albums]);

  return (
    <ViewShell data-testid="favorite-albums-view" title={t('albums.title')}>
      {sortedAlbums.length === 0 ? (
        <EmptyState
          icon={<Disc3 size={48} />}
          title={t('albums.empty')}
          description={t('albums.emptyDescription')}
          className="flex-1"
        />
      ) : (
        <CardGrid>
          {sortedAlbums.map((entry) => {
            const artistName = entry.ref.artists?.[0]?.name;
            return (
              <Card
                key={`${entry.ref.source.provider}-${entry.ref.source.id}`}
                title={entry.ref.title}
                subtitle={artistName}
                src={pickArtwork(entry.ref.artwork, 'cover', 300)?.url}
                action={
                  <ConnectedFavoriteButton
                    type="album"
                    source={entry.ref.source}
                    data={{
                      title: entry.ref.title,
                      artists: entry.ref.artists,
                      artwork: entry.ref.artwork,
                    }}
                    size="sm"
                    data-testid="favorite-album-toggle-button"
                  />
                }
                onClick={() =>
                  navigate({
                    to: `/album/${encodeURIComponent(entry.ref.source.provider)}/${encodeURIComponent(entry.ref.source.id)}`,
                  })
                }
              />
            );
          })}
        </CardGrid>
      )}
    </ViewShell>
  );
};
