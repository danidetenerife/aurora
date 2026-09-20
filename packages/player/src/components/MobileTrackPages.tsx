import {
  CassetteTape,
  ChevronLeft,
  ChevronRight,
  EllipsisVertical,
  ListPlus,
  Play,
  Radio,
} from 'lucide-react';
import { FC, useCallback, useEffect, useRef, useState } from 'react';

import { useTranslation } from '@aurora/i18n';
import { pickArtwork, type Track } from '@aurora/model';
import { Button } from '@aurora/ui';

import { useQueueActions } from '../hooks/useQueueActions';
import { useTrackTableLabels } from '../hooks/useTrackTableLabels';
import { useMobilePlayerStore } from '../stores/mobilePlayerStore';
import { useQueueStore } from '../stores/queueStore';
import { ConnectedTrackTable } from './ConnectedTrackTable';

const ROW_HEIGHT = 64;
const AUTO_RETURN_DELAY_MS = 8000;
const SWIPE_THRESHOLD_PX = 40;
const SWIPE_MAX_TIME_MS = 800;
const HORIZONTAL_BIAS_RATIO = 1.2;

const formatDuration = (totalMillis?: number) => {
  if (!totalMillis || totalMillis <= 0) {
    return '';
  }
  const totalSeconds = Math.floor(totalMillis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const MobileTrackPages: FC<{
  tracks: Track[];
  initialCapacity?: number;
  pageSize?: number;
  variant?: 'table' | 'queue';
}> = ({ tracks, initialCapacity = 1, pageSize, variant = 'table' }) => {
  const { t } = useTranslation('pagination');
  const labels = useTrackTableLabels();
  const queue = useQueueActions();
  const openContextMenu = useMobilePlayerStore(
    (state) => state.openContextMenu,
  );
  const viewport = useRef<HTMLDivElement>(null);
  const [capacity, setCapacity] = useState(pageSize ?? initialCapacity);
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
    if (pageSize !== undefined) {
      setCapacity(pageSize);
      return;
    }
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
  }, [pageSize]);

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
      <div className="aurora-mobile-pages-toolbar flex items-center justify-between gap-2 px-1 py-1 select-none">
        <Button
          size="sm"
          variant="ghost"
          aria-label={labels.playAll}
          disabled={!tracks.length}
          onClick={() => {
            queue.playTracks(tracks, 0);
          }}
          className="flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3.5 text-xs font-semibold text-white shadow-none transition-all hover:bg-white/10 active:bg-white/20"
        >
          <Play size={12} className="fill-current" />
          <span>{labels.playAll}</span>
        </Button>

        <div className="flex items-center gap-1.5">
          <Button
            size="icon"
            variant="ghost"
            aria-label={labels.addAllToQueue}
            disabled={!tracks.length}
            onClick={() => queue.addToQueue(tracks)}
            className="flex size-7 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition-all hover:text-white active:scale-95"
          >
            <ListPlus size={15} />
          </Button>

          {isOffNowPlayingPage && (
            <Button
              size="icon"
              variant="ghost"
              data-testid="sync-now-playing-button"
              aria-label={t('goToCurrentTrack')}
              className="text-primary hover:text-primary size-7 rounded-full"
              onClick={() => goToPage(currentPlayingPage)}
            >
              <Radio size={15} />
            </Button>
          )}

          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5">
            <Button
              size="icon"
              variant="ghost"
              data-testid="pagination-prev-button"
              aria-label={t('previous')}
              disabled={page === 0}
              onClick={() => goToPage(page - 1)}
              className="size-5 cursor-pointer text-zinc-400 hover:text-white disabled:opacity-20"
            >
              <ChevronLeft size={14} />
            </Button>
            <span
              data-testid="pagination-indicator"
              aria-live="polite"
              className="px-0.5 text-[11px] font-bold text-zinc-400 tabular-nums"
            >
              {page + 1} / {pages}
            </span>
            <Button
              size="icon"
              variant="ghost"
              data-testid="pagination-next-button"
              aria-label={t('next')}
              disabled={page === pages - 1}
              onClick={() => goToPage(page + 1)}
              className="size-5 cursor-pointer text-zinc-400 hover:text-white disabled:opacity-20"
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </div>

      <div
        ref={viewport}
        className="aurora-mobile-page-rows"
        data-testid="mobile-track-rows-container"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClickCapture={handleClickCapture}
      >
        {variant === 'queue' ? (
          <div className="flex flex-col gap-2 py-1 select-none">
            {tracks.slice(start, start + capacity).map((track, idx) => {
              const globalIndex = start + idx;
              const isCurrent = isCurrentTrackMatch(track);
              const artwork =
                pickArtwork(track.artwork, 'thumbnail', 96) ??
                pickArtwork(track.album?.artwork, 'thumbnail', 96);
              const artworkUrl = artwork?.url;
              const artistName =
                track.artists && track.artists.length > 0
                  ? track.artists
                      .map((a) => a.name)
                      .filter(Boolean)
                      .join(', ')
                  : (track as unknown as { artist?: string }).artist || '';
              const durationStr = formatDuration(track.durationMs);

              return (
                <div
                  key={track.source?.id ?? `${track.title}-${globalIndex}`}
                  data-testid="track-row"
                  data-is-current={isCurrent}
                  onClick={() => queue.playTracks(tracks, globalIndex)}
                  className={`group relative flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-2.5 transition-all active:scale-[0.99] ${
                    isCurrent
                      ? 'border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                      : 'border-white/5 bg-white/[0.03] hover:bg-white/[0.08]'
                  }`}
                >
                  <div className="flex size-13 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/40">
                    {artworkUrl ? (
                      <img
                        src={artworkUrl}
                        alt={track.title}
                        className="size-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <CassetteTape
                        size={28}
                        className="text-white/20"
                        absoluteStrokeWidth
                      />
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col justify-center">
                    <span
                      className={`text-sm leading-snug font-bold break-words ${
                        isCurrent ? 'font-black text-emerald-400' : 'text-white'
                      }`}
                    >
                      {track.title}
                    </span>
                    {artistName && (
                      <span className="mt-0.5 text-xs leading-snug break-words text-zinc-400">
                        {artistName}
                      </span>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {durationStr && (
                      <span className="font-mono text-xs text-zinc-400 tabular-nums">
                        {durationStr}
                      </span>
                    )}

                    <button
                      type="button"
                      data-testid="track-context-menu-button"
                      aria-label="Opciones de la canción"
                      onClick={(e) => {
                        e.stopPropagation();
                        openContextMenu(track);
                      }}
                      className="cursor-pointer rounded-lg p-2 text-zinc-400 transition-all hover:bg-white/10 hover:text-white active:scale-90"
                    >
                      <EllipsisVertical size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
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
              noTruncate: true,
            }}
          />
        )}
      </div>
    </div>
  );
};
