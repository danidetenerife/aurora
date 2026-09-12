import { ChevronLeft, ChevronRight, ListPlus, Play } from 'lucide-react';
import { FC, useEffect, useRef, useState } from 'react';

import { useTranslation } from '@aurora/i18n';
import type { Track } from '@aurora/model';
import { Button } from '@aurora/ui';

import { useQueueActions } from '../hooks/useQueueActions';
import { useTrackTableLabels } from '../hooks/useTrackTableLabels';
import { ConnectedTrackTable } from './ConnectedTrackTable';

const ROW_HEIGHT = 56;

export const MobileTrackPages: FC<{ tracks: Track[] }> = ({ tracks }) => {
  const { t } = useTranslation('pagination');
  const labels = useTrackTableLabels();
  const queue = useQueueActions();
  const viewport = useRef<HTMLDivElement>(null);
  const [capacity, setCapacity] = useState(1);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const element = viewport.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      setCapacity(
        Math.max(1, Math.floor(entry.contentRect.height / ROW_HEIGHT)),
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const pages = Math.max(1, Math.ceil(tracks.length / capacity));
  const page = Math.min(Math.floor(offset / capacity), pages - 1);
  const start = page * capacity;

  return (
    <div className="aurora-mobile-pages">
      <div className="aurora-mobile-pages-toolbar">
        <Button
          size="icon"
          aria-label={labels.playAll}
          disabled={!tracks.length}
          onClick={() => {
            queue.clearQueue();
            queue.addToQueue(tracks);
          }}
        >
          <Play size={18} />
        </Button>
        <Button
          size="icon"
          aria-label={labels.addAllToQueue}
          disabled={!tracks.length}
          onClick={() => queue.addToQueue(tracks)}
        >
          <ListPlus size={18} />
        </Button>
        <span className="flex-1" />
        <Button
          size="icon"
          aria-label={t('previous')}
          disabled={page === 0}
          onClick={() => setOffset(Math.max(0, start - capacity))}
        >
          <ChevronLeft size={18} />
        </Button>
        <span
          aria-live="polite"
          className="text-foreground-secondary text-xs tabular-nums"
        >
          {page + 1} / {pages}
        </span>
        <Button
          size="icon"
          aria-label={t('next')}
          disabled={page === pages - 1}
          onClick={() => setOffset(start + capacity)}
        >
          <ChevronRight size={18} />
        </Button>
      </div>
      <div ref={viewport} className="aurora-mobile-page-rows">
        <ConnectedTrackTable
          tracks={tracks.slice(start, start + capacity)}
          playbackTracks={tracks}
          rowHeight={ROW_HEIGHT}
          features={{
            header: false,
            filterable: false,
            sortable: false,
            playAll: false,
            addAllToQueue: false,
          }}
          display={{ displayDuration: false }}
        />
      </div>
    </div>
  );
};
