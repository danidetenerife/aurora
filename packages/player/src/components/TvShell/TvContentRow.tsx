import {
  FocusContext,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import { FC, ReactNode, useEffect, useRef } from 'react';

import { cn } from '@nuclearplayer/ui';

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
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { ref, focusKey: currentFocusKey } = useFocusable({
    focusKey,
    trackChildren: true,
    saveLastFocusedChild: true,
  });

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    const focusedChild = container.querySelector('[class*="scale-105"]');
    if (focusedChild) {
      focusedChild.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  });

  return (
    <FocusContext.Provider value={currentFocusKey}>
      <div
        ref={ref}
        data-testid="tv-content-row"
        className="flex flex-col gap-3"
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
          ref={scrollContainerRef}
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
