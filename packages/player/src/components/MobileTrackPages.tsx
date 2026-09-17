import { ChevronLeft, ChevronRight, ListPlus, Play, Radio } from 'lucide-react';
import { FC, useCallback, useEffect, useRef, useState } from 'react';

import { useTranslation } from '@aurora/i18n';
import type { Track } from '@aurora/model';
import { Button } from '@aurora/ui';

import { useQueueActions } from '../hooks/useQueueActions';
import { useTrackTableLabels } from '../hooks/useTrackTableLabels';
import { useQueueStore } from '../stores/queueStore';
import { ConnectedTrackTable } from './ConnectedTrackTable';

const ROW_HEIGHT = 64;
const AUTO_RETURN_DELAY_MS = 8000;
const SWIPE_THRESHOLD_PX = 40;
const SWIPE_MAX_TIME_MS = 800;
const HORIZONTAL_BIAS_RATIO = 1.2;

export const MobileTrackPages: FC<{
  tracks: Track[];
  initialCapacity?: number;
}> = ({ tracks, initialCapacity = 1 }) => {
  const { t } = useTranslation('pagination');
  const labels = useTrackTableLabels();
  const queue = useQueueActions();
  const viewport = useRef<HTMLDivElement>(null);
  const [capacity, setCapacity] = useState(initialCapacity);
  const [offset, setOffset] = useState(0);
  const [, setIsUserBrowsing] = useState(false);
  const autoReturnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(
    null,
  );
  const hasSwipedRef = useRef(false);

  const currentTrack = useQueueStore(
    (state) => state.items[state.currentIndex]?.track,
  );

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

  const currentPlayingIndex = currentTrack
    ? tracks.findIndex(
        (item) =>
          (item.source?.id &&
            currentTrack.source?.id &&
            item.source?.id === currentTrack.source?.id) ||
          (item.title?.trim().toLowerCase() ===
            currentTrack.title?.trim().toLowerCase() &&
            item.artists?.[0]?.name?.trim().toLowerCase() ===
              currentTrack.artists?.[0]?.name?.trim().toLowerCase()),
      )
    : -1;

  const currentPlayingPage =
    currentPlayingIndex >= 0 ? Math.floor(currentPlayingIndex / capacity) : -1;

  useEffect(() => {
    if (currentPlayingPage >= 0) {
      setOffset(currentPlayingPage * capacity);
      setIsUserBrowsing(false);
      if (autoReturnTimerRef.current) {
        clearTimeout(autoReturnTimerRef.current);
        autoReturnTimerRef.current = null;
      }
    }
  }, [currentTrack, currentPlayingPage, capacity]);

  useEffect(() => {
    return () => {
      if (autoReturnTimerRef.current) {
        clearTimeout(autoReturnTimerRef.current);
      }
    };
  }, []);

  const goToPage = useCallback(
    (targetPage: number) => {
      const clampedPage = Math.max(0, Math.min(targetPage, pages - 1));
      setOffset(clampedPage * capacity);

      if (autoReturnTimerRef.current) {
        clearTimeout(autoReturnTimerRef.current);
        autoReturnTimerRef.current = null;
      }

      if (currentPlayingPage >= 0 && clampedPage !== currentPlayingPage) {
        setIsUserBrowsing(true);
        autoReturnTimerRef.current = setTimeout(() => {
          setIsUserBrowsing(false);
          setOffset(currentPlayingPage * capacity);
          autoReturnTimerRef.current = null;
        }, AUTO_RETURN_DELAY_MS);
      } else {
        setIsUserBrowsing(false);
      }
    },
    [capacity, currentPlayingPage, pages],
  );

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) {
      return;
    }
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
    hasSwipedRef.current = false;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) {
      return;
    }
    const touch = e.changedTouches[0];
    if (!touch) {
      return;
    }

    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const elapsed = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;

    if (
      elapsed <= SWIPE_MAX_TIME_MS &&
      Math.abs(deltaX) >= SWIPE_THRESHOLD_PX &&
      Math.abs(deltaX) > Math.abs(deltaY) * HORIZONTAL_BIAS_RATIO
    ) {
      hasSwipedRef.current = true;
      if (deltaX < 0) {
        if (page < pages - 1) {
          goToPage(page + 1);
        }
      } else {
        if (page > 0) {
          goToPage(page - 1);
        }
      }
    }
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    if (hasSwipedRef.current) {
      e.stopPropagation();
      e.preventDefault();
      hasSwipedRef.current = false;
    }
  };

  const isCurrentTrackMatch = useCallback(
    (track: Track) => {
      if (!currentTrack) {
        return false;
      }
      return (
        (track.source?.id &&
          currentTrack.source?.id &&
          track.source?.id === currentTrack.source?.id) ||
        (track.title?.trim().toLowerCase() ===
          currentTrack.title?.trim().toLowerCase() &&
          track.artists?.[0]?.name?.trim().toLowerCase() ===
            currentTrack.artists?.[0]?.name?.trim().toLowerCase())
      );
    },
    [currentTrack],
  );

  const isOffNowPlayingPage =
    currentPlayingPage >= 0 && page !== currentPlayingPage;

  return (
    <div className="aurora-mobile-pages" data-testid="mobile-track-pages">
      <div className="aurora-mobile-pages-toolbar">
        <Button
          size="icon"
          aria-label={labels.playAll}
          disabled={!tracks.length}
          onClick={() => {
            queue.playTracks(tracks, 0);
          }}
        >
          <Play size={20} />
        </Button>
        <Button
          size="icon"
          aria-label={labels.addAllToQueue}
          disabled={!tracks.length}
          onClick={() => queue.addToQueue(tracks)}
        >
          <ListPlus size={20} />
        </Button>

        {isOffNowPlayingPage && (
          <Button
            size="icon"
            data-testid="sync-now-playing-button"
            aria-label={t('goToCurrentTrack')}
            className="text-accent-green hover:text-accent-green"
            onClick={() => goToPage(currentPlayingPage)}
          >
            <Radio size={20} />
          </Button>
        )}

        <span className="flex-1" />

        <Button
          size="icon"
          data-testid="pagination-prev-button"
          aria-label={t('previous')}
          disabled={page === 0}
          onClick={() => goToPage(page - 1)}
        >
          <ChevronLeft size={22} />
        </Button>
        <span
          data-testid="pagination-indicator"
          aria-live="polite"
          className="text-foreground-secondary text-sm font-semibold tabular-nums"
        >
          {page + 1} / {pages}
        </span>
        <Button
          size="icon"
          data-testid="pagination-next-button"
          aria-label={t('next')}
          disabled={page === pages - 1}
          onClick={() => goToPage(page + 1)}
        >
          <ChevronRight size={22} />
        </Button>
      </div>

      <div
        ref={viewport}
        className="aurora-mobile-page-rows"
        data-testid="mobile-track-rows-container"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClickCapture={handleClickCapture}
      >
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
          meta={{
            isCurrentTrack: isCurrentTrackMatch,
          }}
        />
      </div>
    </div>
  );
};
