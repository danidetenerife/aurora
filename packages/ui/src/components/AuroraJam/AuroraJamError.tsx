import { WifiOff } from 'lucide-react';
import { FC } from 'react';

import { cn } from '../../utils';
import { EmptyState } from '../EmptyState';

export type AuroraJamErrorLabels = {
  title: string;
  subtitle: string;
};

type AuroraJamErrorProps = {
  labels: AuroraJamErrorLabels;
  className?: string;
};

export const AuroraJamError: FC<AuroraJamErrorProps> = ({
  labels,
  className,
}) => (
  <EmptyState
    icon={<WifiOff size={48} />}
    title={labels.title}
    description={labels.subtitle}
    className={cn('flex-1', className)}
    data-testid="jam-error"
  />
);
