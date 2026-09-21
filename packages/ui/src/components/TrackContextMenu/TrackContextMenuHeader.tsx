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
        <div className="text-foreground text-sm font-bold break-normal whitespace-normal [overflow-wrap:anywhere] leading-snug">
          {title}
        </div>
        {subtitle && (
          <div className="text-foreground-secondary text-xs break-normal whitespace-normal [overflow-wrap:anywhere] leading-tight mt-0.5">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
};
