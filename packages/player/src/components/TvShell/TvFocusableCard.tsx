import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { FC, ReactNode, useCallback, useEffect, useRef } from 'react';

import { cn } from '@nuclearplayer/ui';

type TvFocusableCardProps = {
  title: string;
  subtitle?: string;
  src?: string;
  onClick?: () => void;
  className?: string;
  focusKey?: string;
  children?: ReactNode;
};

export const TvFocusableCard: FC<TvFocusableCardProps> = ({
  title,
  subtitle,
  src,
  onClick,
  className,
  focusKey,
  children,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  const onEnterPress = useCallback(() => {
    onClick?.();
  }, [onClick]);

  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress,
  });

  useEffect(() => {
    if (focused && cardRef.current) {
      cardRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [focused]);

  return (
    <div
      ref={(element) => {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current =
          element;
        (cardRef as React.MutableRefObject<HTMLDivElement | null>).current =
          element;
      }}
      role="button"
      tabIndex={0}
      data-testid="tv-focusable-card"
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick?.();
        }
      }}
      className={cn(
        'group relative flex cursor-pointer flex-col overflow-hidden rounded-xl transition-all duration-200 outline-none',
        'border-2 border-transparent bg-zinc-800/60',
        'w-48 shrink-0',
        focused && 'border-primary shadow-primary/20 z-10 scale-105 shadow-lg',
        className,
      )}
    >
      <div className="aspect-square w-full overflow-hidden bg-zinc-900">
        {src ? (
          <img
            src={src}
            alt={title}
            className={cn(
              'h-full w-full object-cover transition-transform duration-200',
              focused && 'scale-105',
            )}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zinc-600">
            {children}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 p-3">
        <span className="truncate text-sm font-bold text-white">{title}</span>
        {subtitle && (
          <span className="truncate text-xs text-zinc-400">{subtitle}</span>
        )}
      </div>
    </div>
  );
};
