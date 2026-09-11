import { CellContext } from '@tanstack/react-table';

import { Track } from '@aurora/model';

export const PositionCell = <T extends Track>({
  getValue,
}: CellContext<T, number>) => {
  return <td className="min-w-10 text-center">{getValue()}</td>;
};
