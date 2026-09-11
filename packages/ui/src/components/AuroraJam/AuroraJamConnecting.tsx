import { FC } from 'react';

import { cn } from '../../utils';
import { Loader } from '../Loader';

export type AuroraJamConnectingLabels = {
  title: string;
  subtitle: string;
};

type AuroraJamConnectingProps = {
  labels: AuroraJamConnectingLabels;
  className?: string;
};

export const AuroraJamConnecting: FC<AuroraJamConnectingProps> = ({
  labels,
  className,
}) => (
  <div
    className={cn(
      'flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center',
      className,
    )}
    data-testid="jam-connecting"
  >
    <Loader size="xl" />
    <h1 className="text-foreground text-3xl">{labels.title}</h1>
    <h2 className="text-foreground-secondary text-xl">{labels.subtitle}</h2>
  </div>
);
