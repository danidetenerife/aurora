import { DragEndEvent } from '@dnd-kit/core';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Music } from 'lucide-react';
import { FC, useRef } from 'react';

import type { QueueItem as QueueItemType } from '@aurora/model';

import { cn } from '../../utils';
import { type QueueItemLabels } from '../QueueItem/types';
import { ScrollableArea } from '../ScrollableArea';
import { QueueReorderLayer } from './QueueReorderLayer';
import { ReorderableQueueItem } from './ReorderableQueueItem';

const VIRTUALIZATION_THRESHOLD = 40;
const ITEM_HEIGHT_COLLAPSED = 48;
const ITEM_HEIGHT_EXPANDED = 56;
const OVERSCAN_COUNT = 5;

export type QueuePanelProps = {
  items: QueueItemType[];
  currentItemId?: string;
  isCollapsed?: boolean;
  reorderable?: boolean;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onSelectItem?: (itemId: string) => void;
  onRemoveItem?: (itemId: string) => void;
  onSelectCandidate?: (itemId: string, candidateId: string) => void;
  labels: QueueItemLabels & {
    emptyTitle?: string;
    emptySubtitle?: string;
    noCandidates?: string;
    candidateFailed?: string;
  };
  classes?: {
    root?: string;
    list?: string;
    empty?: string;
  };
};

export const QueuePanel: FC<QueuePanelProps> = ({
  items,
  currentItemId,
  isCollapsed = false,
  reorderable = true,
  onReorder,
  onSelectItem,
  onRemoveItem,
  onSelectCandidate,
  labels,
  classes,
}) => {
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorder) {
      return;
    }

    const fromIndex = items.findIndex((item) => item.id === active.id);
    const toIndex = items.findIndex((item) => item.id === over.id);
    if (fromIndex === -1 || toIndex === -1) {
      return;
    }

    onReorder(fromIndex, toIndex);
  };

  if (items.length === 0) {
    return (
      <div
        data-testid="queue-empty-state"
        className={cn(
          'flex h-full flex-col items-center justify-center gap-4 p-8 text-center transition-opacity duration-150',
          {
            'opacity-0': isCollapsed,
            'opacity-100': !isCollapsed,
          },
          classes?.empty,
        )}
      >
        <Music size={64} className="text-foreground-secondary opacity-50" />
        {(labels?.emptyTitle || labels?.emptySubtitle) && (
          <div>
            {labels?.emptyTitle && (
              <div className="text-foreground text-lg font-bold">
                {labels.emptyTitle}
              </div>
            )}
            {labels?.emptySubtitle && (
              <div className="text-foreground-secondary mt-2 text-sm">
                {labels.emptySubtitle}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const itemIds = items.map((item) => item.id);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const shouldVirtualize = items.length > VIRTUALIZATION_THRESHOLD;

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () =>
      isCollapsed ? ITEM_HEIGHT_COLLAPSED : ITEM_HEIGHT_EXPANDED,
    overscan: OVERSCAN_COUNT,
    enabled: shouldVirtualize,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const paddingTop =
    shouldVirtualize && virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    shouldVirtualize && virtualItems.length > 0
      ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
      : 0;

  const visibleItems =
    shouldVirtualize && virtualItems.length > 0
      ? virtualItems
          .map((virtualRow) => items[virtualRow.index])
          .filter(Boolean)
      : items;

  return (
    <div
      data-testid="queue-panel"
      className={cn('flex h-full flex-col', classes?.root)}
    >
      <ScrollableArea viewportRef={viewportRef}>
        <QueueReorderLayer
          enabled={reorderable}
          items={itemIds}
          onDragEnd={handleDragEnd}
        >
          <div
            className={cn(
              'flex flex-col',
              isCollapsed ? 'items-center gap-1 px-1' : 'gap-1',
              classes?.list,
            )}
            style={
              shouldVirtualize
                ? {
                    paddingTop: `${paddingTop}px`,
                    paddingBottom: `${paddingBottom}px`,
                  }
                : undefined
            }
          >
            {visibleItems.map((queueItem) => (
              <ReorderableQueueItem
                key={queueItem.id}
                item={queueItem}
                isCurrent={queueItem.id === currentItemId}
                isCollapsed={isCollapsed}
                isReorderable={reorderable}
                onSelect={onSelectItem}
                onRemove={onRemoveItem}
                onSelectCandidate={onSelectCandidate}
                labels={{
                  removeButton: labels?.removeButton,
                  playbackError: labels?.playbackError,
                  noCandidates: labels?.noCandidates,
                  candidateFailed: labels?.candidateFailed,
                }}
              />
            ))}
          </div>
        </QueueReorderLayer>
      </ScrollableArea>
    </div>
  );
};
