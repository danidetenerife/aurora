import { FC, ReactNode } from 'react';

import { BottomBar } from '..';
import { cn } from '../../utils';

export type PlayerBarRootProps = {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  className?: string;
};
export const PlayerBarRoot: FC<PlayerBarRootProps> = ({
  left,
  center,
  right,
  className = '',
}) => (
  <BottomBar className={cn('px-2 sm:px-4 py-2 h-auto min-h-14 sm:h-16', className)}>
    <div className="flex w-full flex-col gap-1.5 sm:grid sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-4">
      {left && <div className="min-w-0 w-full sm:flex-initial">{left}</div>}
      <div className="flex w-full items-center justify-center gap-1 sm:contents">
        {center && <div className="shrink-0">{center}</div>}
        {right && <div className="shrink-0 sm:justify-self-end">{right}</div>}
      </div>
    </div>
  </BottomBar>
);
