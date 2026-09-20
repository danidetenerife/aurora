import { Heart } from 'lucide-react';
import { FC, useCallback } from 'react';

import { useTranslation } from '@aurora/i18n';
import { pickArtwork, PlaylistRef } from '@aurora/model';
import type { AttributedResult } from '@aurora/plugin-sdk';
import type { CardsRowItem } from '@aurora/ui';
import { CardsRow } from '@aurora/ui';

import { useNavigateToPlaylist } from '../../../hooks/useNavigateToPlaylist';
import { isCapacitorEnvironment } from '../../../services/universalStore';
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
      imageUrl:
        pickArtwork(playlist.artwork, 'cover', 300)?.url ??
        playlist.artwork?.items?.[0]?.url,
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
    [addPlaylist, isPlaylistFavorite, navigateToPlaylist, removePlaylist],
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
      {favoritePlaylists.length > 0 &&
        (isCapacitorEnvironment() ? (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xl font-bold tracking-tight text-white select-none">
                Listas favoritas
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3.5 px-1 pb-4 select-none">
              {favoritePlaylists.map((entry) => {
                const img =
                  pickArtwork(entry.ref.artwork, 'cover', 300)?.url ??
                  entry.ref.artwork?.items?.[0]?.url;
                return (
                  <button
                    type="button"
                    key={entry.ref.source.id}
                    data-testid="card"
                    onClick={
                      entry.ref.source.url
                        ? () => navigateToPlaylist(entry.ref.source.url!)
                        : undefined
                    }
                    className="group flex w-full cursor-pointer flex-col text-left transition-transform select-none focus:outline-none active:scale-95"
                  >
                    <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-zinc-900 shadow-md ring-1 shadow-black/60 ring-white/10">
                      <img
                        src={img}
                        alt={entry.ref.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="mt-2 w-full">
                      <div
                        data-testid="card-title"
                        className="text-sm leading-tight font-bold break-words text-white"
                      >
                        {entry.ref.name}
                      </div>
                      <div className="mt-0.5 text-xs break-words text-zinc-400">
                        Lista
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <CardsRow
            title="Listas favoritas"
            items={favoritePlaylists.map((entry) => ({
              id: entry.ref.source.id,
              title: entry.ref.name,
              imageUrl:
                pickArtwork(entry.ref.artwork, 'cover', 300)?.url ??
                entry.ref.artwork?.items?.[0]?.url,
              onClick: entry.ref.source.url
                ? () => navigateToPlaylist(entry.ref.source.url!)
                : undefined,
            }))}
            labels={{
              filterPlaceholder: t('filter-playlists'),
              nothingFound: t('nothing-found'),
            }}
          />
        ))}
    </>
  );
};
