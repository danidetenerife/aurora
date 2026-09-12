import { Heart } from 'lucide-react';
import { FC, useCallback } from 'react';

import { useTranslation } from '@aurora/i18n';
import { pickArtwork, PlaylistRef } from '@aurora/model';
import type { AttributedResult } from '@aurora/plugin-sdk';
import type { CardsRowItem } from '@aurora/ui';
import { CardsRow } from '@aurora/ui';

import { useNavigateToPlaylist } from '../../../hooks/useNavigateToPlaylist';
import { useFavoritesStore } from '../../../stores/favoritesStore';
import { useDashboardEditorialPlaylists } from '../hooks/useDashboardData';
import { DashboardCardsWidget } from './DashboardCardsWidget';

type EditorialPlaylistsWidgetProps = {
  title?: string;
};

export const EditorialPlaylistsWidget: FC<EditorialPlaylistsWidgetProps> = ({
  title,
}) => {
  const { t } = useTranslation('dashboard');
  const { data: results, isLoading } = useDashboardEditorialPlaylists();
  const navigateToPlaylist = useNavigateToPlaylist();
  const addPlaylist = useFavoritesStore((state) => state.addPlaylist);
  const removePlaylist = useFavoritesStore((state) => state.removePlaylist);
  const isPlaylistFavorite = useFavoritesStore(
    (state) => state.isPlaylistFavorite,
  );
  const favoritePlaylists = useFavoritesStore((state) => state.playlists);

  const mapPlaylist = useCallback(
    (
      playlist: PlaylistRef,
      result: AttributedResult<PlaylistRef>,
    ): CardsRowItem => ({
      id: `${result.providerId}-${playlist.source.id}`,
      title: playlist.name,
      imageUrl: pickArtwork(playlist.artwork, 'cover', 300)?.url,
      onClick: playlist.source.url
        ? () => navigateToPlaylist(playlist.source.url!)
        : undefined,
      action: (
        <button
          type="button"
          aria-label={
            isPlaylistFavorite(playlist.source)
              ? 'Quitar de favoritas'
              : 'Añadir a favoritas'
          }
          className="rounded-full bg-black/70 p-2 text-white"
          onClick={(event) => {
            event.stopPropagation();
            void (isPlaylistFavorite(playlist.source)
              ? removePlaylist(playlist.source)
              : addPlaylist(playlist));
          }}
        >
          <Heart
            size={16}
            fill={isPlaylistFavorite(playlist.source) ? 'currentColor' : 'none'}
          />
        </button>
      ),
    }),
    [navigateToPlaylist],
  );

  return (
    <>
      <DashboardCardsWidget
        data-testid="dashboard-editorial-playlists"
        results={results}
        isLoading={isLoading}
        title={
          title ??
          t(
            'editorial-playlists',
            'Listas populares de Spotify y YouTube Music',
          )
        }
        labels={{
          filterPlaceholder: t('filter-playlists'),
          nothingFound: t('nothing-found'),
        }}
        mapItem={mapPlaylist}
      />
      {favoritePlaylists.length > 0 && (
        <CardsRow
          title="Listas favoritas"
          items={favoritePlaylists.map((entry) => ({
            id: entry.ref.source.id,
            title: entry.ref.name,
            onClick: entry.ref.source.url
              ? () => navigateToPlaylist(entry.ref.source.url!)
              : undefined,
          }))}
          labels={{
            filterPlaceholder: t('filter-playlists'),
            nothingFound: t('nothing-found'),
          }}
        />
      )}
    </>
  );
};
