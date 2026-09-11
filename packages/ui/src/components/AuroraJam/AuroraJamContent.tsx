import { FC, ReactNode } from 'react';

import { cn } from '../../utils';

export type AuroraJamContentProps = {
  children: ReactNode;
  className?: string;
};

export const AuroraJamContent: FC<AuroraJamContentProps> = ({
  children,
  className,
}) => (
  <div className={cn('relative flex min-h-0 flex-1 flex-col', className)}>
    {children}
  </div>
);
