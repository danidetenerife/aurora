import {
  FocusContext,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import { FC, ReactNode } from 'react';

import { cn } from '@aurora/ui';

type TvContentRowProps = {
  title: string;
  focusKey: string;
  children: ReactNode;
  badge?: string;
};

export const TvContentRow: FC<TvContentRowProps> = ({
  title,
  focusKey,
  children,
  badge,
}) => {
  const { ref, focusKey: currentFocusKey } = useFocusable({
    focusKey,
    trackChildren: true,
    saveLastFocusedChild: true,
  });

  return (
    <FocusContext.Provider value={currentFocusKey}>
      <div
        ref={ref}
        data-testid="tv-content-row"
        className="flex min-w-0 flex-col gap-3"
      >
        <div className="flex items-center gap-3 px-[5%]">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          {badge && (
            <span className="bg-primary/20 text-primary rounded-full px-3 py-0.5 text-xs font-bold">
              {badge}
            </span>
          )}
        </div>
        <div
          className={cn(
            'scrollbar-none flex gap-4 overflow-x-auto px-[5%] pb-4',
          )}
        >
          {children}
        </div>
      </div>
    </FocusContext.Provider>
  );
};
