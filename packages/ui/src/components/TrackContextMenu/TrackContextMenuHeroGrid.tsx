import { FC, ReactNode } from 'react';

import { cn } from '../../utils';

type TrackContextMenuHeroGridProps = {
  children: ReactNode;
  className?: string;
  'data-testid'?: string;
};

export const TrackContextMenuHeroGrid: FC<TrackContextMenuHeroGridProps> = ({
  children,
  className,
  'data-testid': testId,
}) => {
  return (
    <div
      data-testid={testId ?? 'track-context-menu-hero-grid'}
      className={cn(
        'border-border bg-background-secondary/40 grid grid-cols-3 gap-1.5 border-b p-2',
        className,
      )}
    >
      {children}
    </div>
  );
};
