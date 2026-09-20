import { CassetteTape } from 'lucide-react';
import { FC } from 'react';

import type { TopListEntry } from './types';

type TopListRowProps = {
  entry: TopListEntry;
  rank: number;
  fillRatio: number;
  formatValue: (value: number) => string;
};

export const TopListRow: FC<TopListRowProps> = ({
  entry,
  rank,
  fillRatio,
  formatValue,
}) => (
  <div
    data-testid="top-list-row"
    className="border-border grid grid-cols-[auto_auto_1fr_auto] items-center gap-3 border-b-(length:--border-width) py-2 last:border-b-0"
  >
    <span className="text-foreground-secondary w-5 shrink-0 text-right text-sm tabular-nums">
      {rank}
    </span>
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded">
      {entry.imageUrl ? (
        <img
          src={entry.imageUrl}
          alt={entry.label}
          className="h-full w-full object-cover"
        />
      ) : (
        <CassetteTape
          size={32}
          absoluteStrokeWidth
          className="text-foreground opacity-20"
        />
      )}
    </div>
    <div className="flex min-w-0 flex-1 flex-col justify-center">
      <div
        data-testid="top-list-label"
        className="leading-snug font-medium break-words"
      >
        {entry.labelContent ?? entry.label}
      </div>
      {entry.sublabel && (
        <div
          data-testid="top-list-sublabel"
          className="text-foreground-secondary mt-0.5 text-sm leading-snug break-words"
        >
          {entry.sublabelContent ?? entry.sublabel}
        </div>
      )}
    </div>
    <div
      data-testid="top-list-value"
      className="bg-primary/50 min-w-fit shrink-0 px-2 py-1 text-right text-xs whitespace-nowrap tabular-nums"
      style={{ width: `${Math.max(fillRatio * 100, 20)}%` }}
    >
      {formatValue(entry.value)}
    </div>
  </div>
);
