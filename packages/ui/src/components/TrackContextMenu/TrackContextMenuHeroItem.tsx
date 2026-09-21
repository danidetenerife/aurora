import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { FC, ReactNode } from 'react';

import { cn } from '../../utils';

type TrackContextMenuHeroItemProps = {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
  className?: string;
  'data-testid'?: string;
};

export const TrackContextMenuHeroItem: FC<TrackContextMenuHeroItemProps> = ({
  icon,
  children,
  onClick,
  className,
  'data-testid': testId,
}) => {
  return (
    <DropdownMenu.Item
      className={cn(
        'border-border bg-card hover:bg-background-secondary data-[highlighted]:bg-background-secondary text-foreground flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border p-2 text-center text-xs font-semibold transition-colors outline-none select-none active:translate-y-px',
        className,
      )}
      onClick={onClick}
      data-testid={testId}
    >
      <span className="shrink-0">{icon}</span>
      <span className="w-full break-normal whitespace-normal [overflow-wrap:anywhere] leading-tight">
        {children}
      </span>
    </DropdownMenu.Item>
  );
};
