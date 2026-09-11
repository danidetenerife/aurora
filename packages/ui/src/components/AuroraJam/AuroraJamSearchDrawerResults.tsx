import { FC, ReactNode } from 'react';

import { ScrollableArea } from '../ScrollableArea';

export type AuroraJamSearchDrawerResultsProps = {
  children: ReactNode;
};

export const AuroraJamSearchDrawerResults: FC<
  AuroraJamSearchDrawerResultsProps
> = ({ children }) => (
  <div className="relative min-h-0" data-testid="jam-search-results">
    <ScrollableArea viewportClassName="max-h-[60dvh]">
      {children}
    </ScrollableArea>
  </div>
);
