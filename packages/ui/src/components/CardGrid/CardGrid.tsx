import { FC, ReactNode } from 'react';

import { cn } from '../../utils';

type CardGridProps = {
  children?: ReactNode;
  className?: string;
  'data-testid'?: string;
};

export const CardGrid: FC<CardGridProps> = ({
  children,
  className,
  'data-testid': dataTestId,
}) => {
  return (
    <div
      className={cn(
        'grid grid-cols-[repeat(auto-fill,11rem)] justify-start gap-4 pr-2 pb-4',
        className,
      )}
      role="grid"
      data-testid={dataTestId}
    >
      {children}
    </div>
  );
};
