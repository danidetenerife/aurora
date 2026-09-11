import { FC, ReactNode } from 'react';

import { cn } from '../../utils';

export type AuroraJamProps = {
  children: ReactNode;
  className?: string;
};

export const AuroraJamRoot: FC<AuroraJamProps> = ({ children, className }) => (
  <div
    className={cn(
      'bg-background text-foreground flex h-dvh flex-col overflow-hidden',
      className,
    )}
  >
    {children}
  </div>
);
