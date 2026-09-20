import { Music, Plus } from 'lucide-react';
import { FC } from 'react';

import { cn } from '../../utils';
import { Button } from '../Button';
import { FavoriteButton } from '../FavoriteButton';
import type { HistoryRowProps } from './types';

export const HistoryRow: FC<HistoryRowProps> = ({
  title,
  artist,
  artistContent,
  time,
  duration,
  artworkUrl,
  isFavorite = false,
  onToggleFavorite,
  onAddToQueue,
  onPlayNow,
  labels,
  classes,
  className,
  ...props
}) => (
  <div
    data-testid="history-row"
    className={cn(
      'border-border bg-background-secondary group flex items-center justify-between gap-3 border-b-(length:--border-width) p-2.5 select-none last:border-b-0',
      classes?.root,
      className,
    )}
    {...props}
  >
    <div className="flex min-w-0 flex-1 items-center gap-2.5">
      <div className="flex w-8 shrink-0 justify-center">
        {onToggleFavorite && (
          <FavoriteButton
            data-testid="history-row-favorite"
            size="sm"
            isFavorite={isFavorite}
            onToggle={onToggleFavorite}
            ariaLabelAdd={labels.favorite}
            ariaLabelRemove={labels.unfavorite}
          />
        )}
      </div>

      <div
        data-testid="history-row-thumbnail"
        className={cn(
          'flex h-11 w-11 min-w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-zinc-900',
          classes?.thumbnail,
        )}
      >
        {artworkUrl ? (
          <img
            src={artworkUrl}
            alt={title}
            className="h-full w-full object-cover"
          />
        ) : (
          <Music
            size={20}
            absoluteStrokeWidth
            className="text-foreground opacity-20"
          />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <button
          data-testid="history-row-title"
          className={cn(
            'cursor-pointer text-left leading-snug font-medium break-words hover:underline',
            classes?.title,
          )}
          onClick={(e) => {
            e.stopPropagation();
            onPlayNow?.();
          }}
        >
          {title}
        </button>
        <div
          data-testid="history-row-artist"
          className={cn(
            'text-foreground-secondary mt-0.5 text-xs break-words',
            classes?.artist,
          )}
        >
          {artistContent ?? artist}
        </div>
      </div>
    </div>

    <div className="flex shrink-0 items-center gap-2">
      <div className="flex flex-col items-end text-right text-xs tabular-nums">
        {duration && (
          <div className="flex items-center justify-end gap-1">
            {labels.duration && (
              <span className="text-foreground-secondary/70 text-[11px]">
                {labels.duration}:
              </span>
            )}
            <span
              data-testid="history-row-duration"
              className={cn('text-foreground font-medium', classes?.duration)}
            >
              {duration}
            </span>
          </div>
        )}
        <div className="flex items-center justify-end gap-1">
          {labels.playedAt && (
            <span className="text-foreground-secondary/70 text-[11px]">
              {labels.playedAt}:
            </span>
          )}
          <span
            data-testid="history-row-played-at"
            className={cn('text-foreground-secondary text-xs', classes?.time)}
          >
            {time}
          </span>
        </div>
      </div>
      {onAddToQueue && (
        <Button
          data-testid="history-row-add-to-queue"
          size="icon-sm"
          variant="text"
          className="opacity-0 transition-none group-hover:opacity-100"
          aria-label={labels.addToQueue}
          onClick={(e) => {
            e.stopPropagation();
            onAddToQueue();
          }}
        >
          <Plus size={16} />
        </Button>
      )}
    </div>
  </div>
);
