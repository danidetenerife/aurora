import { useNavigate } from '@tanstack/react-router';
import isEmpty from 'lodash-es/isEmpty';
import { ListMusic, SearchX, Trash2 } from 'lucide-react';
import { useState, type FC } from 'react';
import { toast } from 'sonner';

import { useTranslation } from '@aurora/i18n';
import type { PlaylistIndexEntry } from '@aurora/model';
import {
  Button,
  Dialog,
  EmptyState,
  ScrollableArea,
  ViewShell,
} from '@aurora/ui';

import { MobileItemPages } from '../../components/MobileItemPages';
import { isCapacitorEnvironment } from '../../services/universalStore';
import { usePlaylistStore } from '../../stores/playlistStore';
import { EditorialPlaylistsWidget } from '../Dashboard/components/EditorialPlaylistsWidget';
import { useDashboardEditorialPlaylists } from '../Dashboard/hooks/useDashboardData';
import { CreatePlaylistDialog } from './components/CreatePlaylistDialog';
import { PlaylistCardGrid } from './components/PlaylistCardGrid';
import { PlaylistsToolbar } from './components/PlaylistsToolbar';
import { usePlaylistFilter } from './hooks/usePlaylistFilter';
import { usePlaylistSort } from './hooks/usePlaylistSort';
import { PlaylistsProvider } from './PlaylistsContext';

const PlaylistsContent: FC = () => {
  const { t } = useTranslation('playlists');
  const navigate = useNavigate();
  const index = usePlaylistStore((state) => state.index);
  const { data: editorialResults } = useDashboardEditorialPlaylists();
  const deletePlaylist = usePlaylistStore((state) => state.deletePlaylist);
  const [playlistToDelete, setPlaylistToDelete] =
    useState<PlaylistIndexEntry | null>(null);
  const { filter, setFilter, filteredPlaylists, hasFilter } =
    usePlaylistFilter(index);
  const {
    sortBy,
    setSortBy,
    sortDirection,
    toggleSortDirection,
    sortedPlaylists,
  } = usePlaylistSort(filteredPlaylists);
  const native = isCapacitorEnvironment();
  const hasPlaylists = !isEmpty(index);
  const hasResults = !isEmpty(filteredPlaylists);
  const hasEditorial = !isEmpty(editorialResults);

  return (
    <ViewShell
      data-testid="playlists-view"
      title={native ? t('navigation:playlists') : t('title')}
      classes={native ? { root: 'aurora-mobile-library' } : undefined}
    >
      <PlaylistsToolbar
        filter={filter}
        onFilterChange={setFilter}
        hasPlaylists={hasPlaylists}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        sortDirection={sortDirection}
        onToggleSortDirection={toggleSortDirection}
      />

      {hasPlaylists && hasFilter && !hasResults && (
        <EmptyState
          icon={<SearchX size={48} />}
          title={t('filterNoResults')}
          description={t('filterNoResultsDescription')}
          className="flex-1"
          data-testid="filter-empty-state"
        />
      )}

      {hasPlaylists && hasResults && native && (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col gap-1">
            <h2 className="text-foreground-secondary px-1 text-xs font-bold tracking-wider uppercase">
              {t('myPlaylists', 'Mis listas de reproducción')}
            </h2>
            <MobileItemPages
              items={sortedPlaylists.map((playlist) => (
                <div
                  key={playlist.id}
                  className="aurora-mobile-library-row flex items-center justify-between gap-2"
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden py-1 text-left"
                    onClick={() =>
                      void navigate({
                        to: '/playlists/$playlistId',
                        params: { playlistId: playlist.id },
                      })
                    }
                  >
                    <ListMusic size={28} className="text-foreground shrink-0" />
                    <span className="min-w-0 flex-1">
                      <strong className="block break-words">
                        {playlist.name}
                      </strong>
                      <span className="text-foreground-secondary block text-xs">
                        {t('trackCount', { count: playlist.itemCount })}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    data-testid={`delete-playlist-${playlist.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlaylistToDelete(playlist);
                    }}
                    className="text-foreground-secondary hover:text-accent-red hover:bg-card shrink-0 cursor-pointer rounded-lg p-2 transition-all active:scale-95"
                    aria-label={`Eliminar lista ${playlist.name}`}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            />
          </div>
          <EditorialPlaylistsWidget
            title={t('popularPlaylists', 'Listas destacadas')}
          />
        </div>
      )}

      {hasPlaylists && hasResults && !native && (
        <ScrollableArea className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-6 p-1">
            <div className="flex flex-col gap-2">
              <h2 className="text-foreground text-sm font-bold">
                {t('myPlaylists', 'Mis listas de reproducción')}
              </h2>
              <PlaylistCardGrid
                playlists={sortedPlaylists}
                onCardClick={(id) =>
                  navigate({
                    to: '/playlists/$playlistId',
                    params: { playlistId: id },
                  })
                }
              />
            </div>
            <EditorialPlaylistsWidget
              title={t('popularPlaylists', 'Listas destacadas')}
            />
          </div>
        </ScrollableArea>
      )}

      {!hasPlaylists && hasEditorial && native && (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <EditorialPlaylistsWidget
            title={t('popularPlaylists', 'Listas destacadas')}
          />
        </div>
      )}

      {!hasPlaylists && hasEditorial && !native && (
        <ScrollableArea className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4 p-1">
            <EditorialPlaylistsWidget
              title={t('popularPlaylists', 'Listas destacadas')}
            />
          </div>
        </ScrollableArea>
      )}

      {!hasPlaylists && !hasEditorial && (
        <EmptyState
          icon={<ListMusic size={48} />}
          title={t('empty')}
          description={t('emptyDescription')}
          className="flex-1"
        />
      )}

      <CreatePlaylistDialog />

      <Dialog.Root
        isOpen={playlistToDelete != null}
        onClose={() => setPlaylistToDelete(null)}
      >
        <Dialog.Title>{t('delete', 'Eliminar lista')}</Dialog.Title>
        <Dialog.Description>
          {t(
            'deleteConfirm',
            `¿Seguro que quieres eliminar la lista "${playlistToDelete?.name ?? ''}"?`,
          )}
        </Dialog.Description>
        <Dialog.Actions>
          <Dialog.Close>{t('common:actions.cancel', 'Cancelar')}</Dialog.Close>
          <Button
            intent="danger"
            onClick={async () => {
              if (playlistToDelete) {
                const name = playlistToDelete.name;
                await deletePlaylist(playlistToDelete.id);
                toast.success(
                  t('playlistDeleted', `Lista "${name}" eliminada`),
                );
                setPlaylistToDelete(null);
              }
            }}
          >
            {t('common:actions.delete', 'Eliminar')}
          </Button>
        </Dialog.Actions>
      </Dialog.Root>
    </ViewShell>
  );
};

export const Playlists: FC = () => (
  <PlaylistsProvider>
    <PlaylistsContent />
  </PlaylistsProvider>
);
