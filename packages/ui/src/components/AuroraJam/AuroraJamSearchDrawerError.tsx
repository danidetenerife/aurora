import { TriangleAlert } from 'lucide-react';
import { FC } from 'react';

import { EmptyState } from '../EmptyState';

export type AuroraJamSearchDrawerErrorLabels = {
  title: string;
  description?: string;
};

export type AuroraJamSearchDrawerErrorProps = {
  labels: AuroraJamSearchDrawerErrorLabels;
};

export const AuroraJamSearchDrawerError: FC<
  AuroraJamSearchDrawerErrorProps
> = ({ labels }) => (
  <EmptyState
    icon={<TriangleAlert size={48} />}
    title={labels.title}
    description={labels.description}
    className="flex-1"
    data-testid="jam-search-error"
  />
);
