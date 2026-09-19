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
  <BottomBar className={cn('h-14 px-2 py-1.5 sm:h-16 sm:px-4', className)}>
    <div className="flex w-full items-center justify-between gap-2 sm:grid sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-4">
      {left && <div className="min-w-0 flex-1 sm:flex-initial">{left}</div>}
      {center && <div className="shrink-0 justify-self-center">{center}</div>}
      {right && <div className="hidden justify-self-end sm:block">{right}</div>}
    </div>
  </BottomBar>
);
