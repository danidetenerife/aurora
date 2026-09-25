import { FC } from 'react';

import { cn } from '../../utils';

type TrackContextMenuHeaderProps = {
  title: string;
  subtitle?: string;
  coverUrl?: string;
};

export const TrackContextMenuHeader: FC<TrackContextMenuHeaderProps> = ({
  title,
  subtitle,
  coverUrl,
}) => {
  return (
    <div className="border-border flex items-center gap-3 border-b">
      {coverUrl && (
        <img
          src={coverUrl}
          alt=""
          className="border-border size-16 border-r object-cover"
        />
      )}
      <div
        className={cn('min-w-0 flex-1 py-3 pr-3', {
          'pl-3': !coverUrl,
        })}
      >
        <div className="text-foreground text-sm leading-snug font-bold break-normal [overflow-wrap:anywhere] whitespace-normal">
          {title}
        </div>
        {subtitle && (
          <div className="text-foreground-secondary mt-0.5 text-xs leading-tight break-normal [overflow-wrap:anywhere] whitespace-normal">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
};
