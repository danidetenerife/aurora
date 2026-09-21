import { Music2 } from 'lucide-react';
import { FC, ReactNode } from 'react';

import { cn } from '../../utils';

type PlayerBarNowPlayingProps = {
  title: string;
  artist: string;
  coverUrl?: string;
  className?: string;
  action?: ReactNode;
  onTitleClick?: () => void;
  onArtistClick?: () => void;
};

export const PlayerBarNowPlaying: FC<PlayerBarNowPlayingProps> = ({
  title,
  artist,
  coverUrl,
  className = '',
  action,
  onTitleClick,
  onArtistClick,
}) => (
  <div
    className={cn('flex min-w-0 flex-1 items-center gap-2 sm:gap-3', className)}
  >
    <div className="border-border bg-background-secondary size-9 shrink-0 overflow-hidden rounded-md border-(length:--border-width) sm:size-12">
      {coverUrl ? (
        <img
          src={coverUrl}
          alt=""
          className="size-full object-cover select-none"
          data-testid="player-now-playing-thumbnail"
        />
      ) : (
        <div
          className="text-foreground-secondary flex size-full items-center justify-center"
          data-testid="player-now-playing-placeholder"
        >
          <Music2 size={16} />
        </div>
      )}
    </div>
    <div className="min-w-0 flex-1">
      <div
        className={cn(
          'text-foreground text-xs leading-tight font-bold break-words sm:text-sm',
          {
            'cursor-pointer hover:underline': onTitleClick,
          },
        )}
        data-testid="now-playing-title"
        onClick={onTitleClick}
      >
        {title}
      </div>
      {artist ? (
        <div
          className={cn(
            'text-foreground-secondary text-[11px] sm:text-xs break-normal whitespace-normal [overflow-wrap:anywhere] leading-tight mt-0.5',
            {
              'cursor-pointer hover:underline': onArtistClick,
            },
          )}
          data-testid="player-now-playing-artist"
          onClick={onArtistClick}
        >
          {artist}
        </div>
      ) : null}
    </div>
    {action}
  </div>
);
