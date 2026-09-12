import { useNavigate } from '@tanstack/react-router';
import isEmpty from 'lodash-es/isEmpty';
import { ListMusic, SearchX } from 'lucide-react';
import { type FC } from 'react';

import { useTranslation } from '@aurora/i18n';
import { EmptyState, ScrollableArea, ViewShell } from '@aurora/ui';

import { MobileItemPages } from '../../components/MobileItemPages';
import { isCapacitorEnvironment } from '../../services/universalStore';
import { usePlaylistStore } from '../../stores/playlistStore';
import { CreatePlaylistDialog } from './components/CreatePlaylistDialog';
import { PlaylistCardGrid } from './components/PlaylistCardGrid';
import { PlaylistsToolbar } from './components/PlaylistsToolbar';
import { usePlaylistFilter } from './hooks/usePlaylistFilter';
import { usePlaylistSort } from './hooks/usePlaylistSort';
import { PlaylistsProvider } from './PlaylistsContext';
import { EditorialPlaylistsWidget } from '../Dashboard/components/EditorialPlaylistsWidget';
import { useDashboardEditorialPlaylists } from '../Dashboard/hooks/useDashboardData';

const PlaylistsContent: FC = () => {
  const { t } = useTranslation('playlists');
  const navigate = useNavigate();
  const index = usePlaylistStore((state) => state.index);
  const { data: editorialResults } = useDashboardEditorialPlaylists();
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
        <div className="flex flex-1 flex-col gap-4 min-h-0 overflow-y-auto">
          <div className="flex flex-col gap-1">
            <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-foreground-secondary">
              {t('myPlaylists', 'Mis listas de reproducción')}
            </h2>
            <MobileItemPages
              items={sortedPlaylists.map((playlist) => (
                <button
                  key={playlist.id}
                  type="button"
                  className="aurora-mobile-library-row"
                  onClick={() =>
                    void navigate({
                      to: '/playlists/$playlistId',
                      params: { playlistId: playlist.id },
                    })
                  }
                >
                  <ListMusic size={28} />
                  <span className="min-w-0">
                    <strong className="block truncate">{playlist.name}</strong>
                    <span className="block text-xs">
                      {t('trackCount', { count: playlist.itemCount })}
                    </span>
                  </span>
                </button>
              ))}
            />
          </div>
          <EditorialPlaylistsWidget
            title={t(
              'popularPlaylists',
              'Listas populares de Spotify y YouTube Music',
            )}
          />
        </div>
      )}

      {hasPlaylists && hasResults && !native && (
        <ScrollableArea className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-6 p-1">
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-bold text-foreground">
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
              title={t(
                'popularPlaylists',
                'Listas populares de Spotify y YouTube Music',
              )}
            />
          </div>
        </ScrollableArea>
      )}

      {!hasPlaylists && hasEditorial && native && (
        <div className="flex flex-1 flex-col min-h-0 overflow-y-auto">
          <EditorialPlaylistsWidget
            title={t(
              'popularPlaylists',
              'Listas populares de Spotify y YouTube Music',
            )}
          />
        </div>
      )}

      {!hasPlaylists && hasEditorial && !native && (
        <ScrollableArea className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4 p-1">
            <EditorialPlaylistsWidget
              title={t(
                'popularPlaylists',
                'Listas populares de Spotify y YouTube Music',
              )}
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
    </ViewShell>
  );
};

export const Playlists: FC = () => (
  <PlaylistsProvider>
    <PlaylistsContent />
  </PlaylistsProvider>
);
