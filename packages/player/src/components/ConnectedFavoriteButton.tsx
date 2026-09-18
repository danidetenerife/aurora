import { FC } from 'react';

import { useTranslation } from '@aurora/i18n';
import type { AlbumRef, ArtistRef, ProviderRef } from '@aurora/model';
import { FavoriteButton } from '@aurora/ui';

import { useFavoritesStore } from '../stores/favoritesStore';

type ConnectedFavoriteButtonProps = {
  className?: string;
  size?: 'sm' | 'default';
  'data-testid'?: string;
} & (
  | { type: 'album'; source: ProviderRef; data: Omit<AlbumRef, 'source'> }
  | { type: 'artist'; source: ProviderRef; data: Omit<ArtistRef, 'source'> }
);

export const ConnectedFavoriteButton: FC<ConnectedFavoriteButtonProps> = (
  props,
) => {
  const { t } = useTranslation('track');
  const { type, source, data, size = 'default', className, 'data-testid': testId } = props;

  const isFavorite = useFavoritesStore((state) =>
    type === 'album'
      ? state.albums.some(
          (entry) =>
            entry.ref.source.provider === source.provider &&
            entry.ref.source.id === source.id,
        )
      : state.artists.some(
          (entry) =>
            (source?.id && entry.ref.source?.id === source.id) ||
            entry.ref.name.toLowerCase() ===
              (data as Omit<ArtistRef, 'source'>).name?.toLowerCase(),
        ),
  );

  const addAlbum = useFavoritesStore((state) => state.addAlbum);
  const addArtist = useFavoritesStore((state) => state.addArtist);
  const removeAlbum = useFavoritesStore((state) => state.removeAlbum);
  const removeArtist = useFavoritesStore((state) => state.removeArtist);

  const handleToggle = () => {
    if (type === 'album') {
      if (isFavorite) {
        void removeAlbum(source);
      } else {
        void addAlbum({ ...(data as Omit<AlbumRef, 'source'>), source });
      }
    } else {
      const artistData = data as Omit<ArtistRef, 'source'>;
      if (isFavorite) {
        void removeArtist(source, artistData.name);
      } else {
        void addArtist({ ...artistData, source });
      }
    }
  };

  return (
    <FavoriteButton
      isFavorite={isFavorite}
      onToggle={handleToggle}
      size={size}
      className={className}
      data-testid={testId}
      ariaLabelAdd={t('actions.addToFavorites')}
      ariaLabelRemove={t('actions.removeFromFavorites')}
    />
  );
};
