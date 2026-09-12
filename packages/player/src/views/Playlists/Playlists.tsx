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

const PlaylistsContent: FC = () => {
  const { t } = useTranslation('playlists');
  const navigate = useNavigate();
  const index = usePlaylistStore((state) => state.index);
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

  return (
    <ViewShell data-testid="playlists-view" title={native ? t('navigation:playlists') : t('title')} classes={native ? { root: 'aurora-mobile-library' } : undefined}>
      <PlaylistsToolbar
        filter={filter}
        onFilterChange={setFilter}
        hasPlaylists={hasPlaylists}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        sortDirection={sortDirection}
        onToggleSortDirection={toggleSortDirection}
      />

      {!hasPlaylists && (
        <EmptyState
          icon={<ListMusic size={48} />}
          title={t('empty')}
          description={t('emptyDescription')}
          className="flex-1"
        />
      )}

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
        <MobileItemPages items={sortedPlaylists.map((playlist) => (
          <button key={playlist.id} type="button" className="aurora-mobile-library-row" onClick={() => void navigate({ to: '/playlists/$playlistId', params: { playlistId: playlist.id } })}>
            <ListMusic size={28} />
            <span className="min-w-0"><strong className="block truncate">{playlist.name}</strong><span className="block text-xs">{t('trackCount', { count: playlist.itemCount })}</span></span>
          </button>
        ))} />
      )}
      {hasPlaylists && hasResults && !native && (
        <ScrollableArea className="flex-1 overflow-hidden">
          <PlaylistCardGrid
            playlists={sortedPlaylists}
            onCardClick={(id) =>
              navigate({
                to: '/playlists/$playlistId',
                params: { playlistId: id },
              })
            }
          />
        </ScrollableArea>
      )}

      <EditorialPlaylistsWidget />

      <CreatePlaylistDialog />
    </ViewShell>
  );
};

export const Playlists: FC = () => (
  <PlaylistsProvider>
    <PlaylistsContent />
  </PlaylistsProvider>
);
