import { FilterIcon, Plus } from 'lucide-react';
import { type FC } from 'react';

import { useTranslation } from '@aurora/i18n';
import { Button, Input } from '@aurora/ui';

import type { PlaylistSortBy, SortDirection } from '../hooks/usePlaylistSort';
import { useCreatePlaylistContext } from '../PlaylistsContext';
import { ImportPlaylistMenu } from './ImportPlaylistMenu';
import { PlaylistSortSelect } from './PlaylistSortSelect';

type PlaylistsToolbarProps = {
  filter: string;
  onFilterChange: (value: string) => void;
  hasPlaylists: boolean;
  sortBy: PlaylistSortBy;
  onSortByChange: (sortBy: PlaylistSortBy) => void;
  sortDirection: SortDirection;
  onToggleSortDirection: () => void;
};

export const PlaylistsToolbar: FC<PlaylistsToolbarProps> = ({
  filter,
  onFilterChange,
  hasPlaylists,
  sortBy,
  onSortByChange,
  sortDirection,
  onToggleSortDirection,
}) => {
  const { t } = useTranslation('playlists');
  const { openCreateDialog } = useCreatePlaylistContext();

  return (
    <div className="aurora-playlists-toolbar mb-4 flex flex-wrap items-center gap-2">
      <Button
        onClick={openCreateDialog}
        data-testid="create-playlist-button"
        className="h-auto min-h-10 min-w-0 gap-2 whitespace-normal"
      >
        <Plus size={16} className="shrink-0" />
        {t('create')}
      </Button>
      <ImportPlaylistMenu />
      {hasPlaylists && (
        <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2">
          <PlaylistSortSelect
            sortBy={sortBy}
            onSortByChange={onSortByChange}
            sortDirection={sortDirection}
            onToggleSortDirection={onToggleSortDirection}
          />
          <div className="inline-flex w-full max-w-sm items-stretch">
            <Input
              size="sm"
              value={filter}
              onChange={(event) => onFilterChange(event.target.value)}
              placeholder={t('filterPlaylists')}
              data-testid="filter-playlists-input"
              endAddon={
                <FilterIcon
                  className="h-4 w-4"
                  aria-hidden="true"
                  strokeWidth={3}
                />
              }
            />
          </div>
        </div>
      )}
    </div>
  );
};
