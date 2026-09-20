import { useNavigate } from '@tanstack/react-router';
import { EllipsisIcon, ListPlus, Shuffle, Trash2Icon } from 'lucide-react';
import { FC, useEffect, useMemo, useState } from 'react';

import { useTranslation } from '@aurora/i18n';
import { Button, Dialog, FilterChips, Input, QueuePanel } from '@aurora/ui';

import { useCoreSetting } from '../hooks/useCoreSetting';
import { useCurrentQueueItem } from '../hooks/useCurrentQueueItem';
import { useQueue } from '../hooks/useQueue';
import { useQueueActions } from '../hooks/useQueueActions';
import { enrichTracksInQueue } from '../services/artworkEnricher';
import { useFavoritesStore } from '../stores/favoritesStore';
import { usePlaylistStore } from '../stores/playlistStore';

type ConnectedQueuePanelProps = {
  isCollapsed?: boolean;
};

type QueueFilter = 'all' | 'upcoming' | 'favorites';

export const ConnectedQueuePanel: FC<ConnectedQueuePanelProps> = ({
  isCollapsed = false,
}) => {
  const { t } = useTranslation('queue');
  const queue = useQueue();
  const currentItem = useCurrentQueueItem();
  const actions = useQueueActions();
  const [selectedFilter, setSelectedFilter] = useState<QueueFilter>('all');
  const favoriteTracks = useFavoritesStore((state) => state.tracks);

  useEffect(() => {
    enrichTracksInQueue();
  }, [queue.items.length]);

  const handleReorder = (fromIndex: number, toIndex: number) => {
    actions.reorder(fromIndex, toIndex);
  };

  const handleSelectItem = (itemId: string) => {
    actions.goToId(itemId);
  };

  const handleRemoveItem = (itemId: string) => {
    actions.removeByIds([itemId]);
  };

  const filteredItems = useMemo(() => {
    if (selectedFilter === 'upcoming') {
      return queue.items.slice(queue.currentIndex);
    }
    if (selectedFilter === 'favorites') {
      const favoriteSet = new Set(
        favoriteTracks.map(
          (entry) => `${entry.ref.source?.provider}:${entry.ref.source?.id}`,
        ),
      );
      return queue.items.filter((item) =>
        favoriteSet.has(
          `${item.track.source?.provider}:${item.track.source?.id}`,
        ),
      );
    }
    return queue.items;
  }, [queue.items, queue.currentIndex, selectedFilter, favoriteTracks]);

  return (
    <div className="flex h-full flex-col">
      {!isCollapsed && queue.items.length > 0 && (
        <div className="border-border/50 border-b px-3 py-2">
          <FilterChips
            selected={selectedFilter}
            onChange={(filterId) => setSelectedFilter(filterId as QueueFilter)}
            items={[
              { id: 'all', label: t('filters.all') },
              { id: 'upcoming', label: t('filters.upcoming') },
              { id: 'favorites', label: t('filters.favorites') },
            ]}
          />
        </div>
      )}
      <div className="min-h-0 flex-1">
        <QueuePanel
          items={filteredItems}
          currentItemId={currentItem?.id}
          isCollapsed={isCollapsed}
          reorderable={!isCollapsed && selectedFilter === 'all'}
          onReorder={handleReorder}
          onSelectItem={handleSelectItem}
          onRemoveItem={handleRemoveItem}
          onSelectCandidate={actions.selectCandidate}
          labels={{
            emptyTitle: t('empty.title'),
            emptySubtitle: t('empty.subtitle'),
            removeButton: t('actions.remove'),
            playbackError: t('errors.playback'),
            noCandidates: t('candidates.empty'),
            candidateFailed: t('candidates.failed'),
          }}
        />
      </div>
    </div>
  );
};

export const QueueHeaderActions: FC = () => {
  const { t } = useTranslation('queue');
  const { t: tPlaylists } = useTranslation('playlists');
  const navigate = useNavigate();
  const queue = useQueue();
  const { clearQueue } = useQueueActions();
  const [shuffleEnabled, setShuffleEnabled] =
    useCoreSetting<boolean>('playback.shuffle');
  const saveQueueAsPlaylist = usePlaylistStore(
    (state) => state.saveQueueAsPlaylist,
  );

  const [menuOpen, setMenuOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [playlistName, setPlaylistName] = useState('');

  const handleSaveAsPlaylist = async () => {
    if (!playlistName.trim()) {
      return;
    }
    const playlistId = await saveQueueAsPlaylist(playlistName.trim());
    setSaveDialogOpen(false);
    setPlaylistName('');
    navigate({ to: '/playlists/$playlistId', params: { playlistId } });
  };

  if (queue.items.length === 0) {
    return null;
  }

  return (
    <div className="relative flex items-center gap-1.5">
      <Button
        size="icon"
        data-testid="clear-queue-button"
        onClick={clearQueue}
        title={t('actions.clear', { defaultValue: 'Vaciar cola' })}
      >
        <Trash2Icon className="size-4" />
      </Button>

      <div className="relative">
        <Button
          size="icon"
          data-testid="queue-more-button"
          onClick={() => setMenuOpen((prev) => !prev)}
          title="Opciones de cola"
        >
          <EllipsisIcon className="size-4" />
        </Button>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMenuOpen(false)}
            />
            <div
              className="border-border bg-background-secondary animate-in fade-in zoom-in-95 absolute top-full right-0 z-50 mt-2 min-w-[200px] rounded-xl border p-1 shadow-2xl backdrop-blur-xl duration-100"
              role="menu"
            >
              <button
                type="button"
                className="text-foreground hover:bg-background-tertiary flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors"
                data-testid="save-queue-as-playlist"
                onClick={() => {
                  setMenuOpen(false);
                  setSaveDialogOpen(true);
                }}
              >
                <ListPlus className="text-accent-blue size-4 shrink-0" />
                <span>
                  {t('actions.saveAsPlaylist', {
                    defaultValue: 'Guardar como lista',
                  })}
                </span>
              </button>

              <button
                type="button"
                className="text-foreground hover:bg-background-tertiary flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors"
                data-testid="shuffle-queue-action"
                onClick={() => {
                  setShuffleEnabled(!shuffleEnabled);
                  setMenuOpen(false);
                }}
              >
                <Shuffle
                  className={`size-4 shrink-0 ${shuffleEnabled ? 'text-accent-green' : 'text-foreground-secondary'}`}
                />
                <span>
                  {shuffleEnabled ? 'Desactivar aleatorio' : 'Modo aleatorio'}
                </span>
              </button>

              <button
                type="button"
                className="text-accent-red hover:bg-background-tertiary border-border/40 mt-1 flex w-full cursor-pointer items-center gap-2.5 rounded-lg border-t px-3 py-2 pt-1.5 text-left text-xs font-semibold transition-colors"
                data-testid="clear-queue-menu-action"
                onClick={() => {
                  setMenuOpen(false);
                  clearQueue();
                }}
              >
                <Trash2Icon className="size-4 shrink-0" />
                <span>
                  {t('actions.clear', { defaultValue: 'Vaciar cola' })}
                </span>
              </button>
            </div>
          </>
        )}
      </div>

      <Dialog.Root
        isOpen={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleSaveAsPlaylist();
          }}
        >
          <Dialog.Title>{t('actions.saveAsPlaylist')}</Dialog.Title>
          <div className="mt-4">
            <Input
              label={tPlaylists('name')}
              placeholder={tPlaylists('namePlaceholder')}
              value={playlistName}
              onChange={(event) => setPlaylistName(event.target.value)}
              data-testid="save-queue-playlist-name-input"
              autoFocus
            />
          </div>
          <Dialog.Actions>
            <Dialog.Close>{t('common:actions.cancel')}</Dialog.Close>
            <Button type="submit">{t('common:actions.save')}</Button>
          </Dialog.Actions>
        </form>
      </Dialog.Root>
    </div>
  );
};
