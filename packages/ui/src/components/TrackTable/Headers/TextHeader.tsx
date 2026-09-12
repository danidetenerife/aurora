import { HeaderContext } from '@tanstack/react-table';
import { SortAsc, SortDesc } from 'lucide-react';
import { PropsWithChildren, useCallback } from 'react';

import { Track } from '@aurora/model';

import { cn } from '../../../utils';

type HeaderValue = string | undefined;

export function TextHeader<T extends Track>({
  children,
  context,
}: PropsWithChildren<{ context: HeaderContext<T, HeaderValue> }>) {
  const { getCanSort, getIsSorted, toggleSorting, id } = context.column;

  const isSorted = getIsSorted();
  const canSort = getCanSort();

  const onClick = useCallback(() => {
    if (canSort) {
      toggleSorting();
    }
  }, [canSort, toggleSorting]);

  return (
    <th
      role="columnheader"
      className={cn(
        'px-2 text-left',
        { 'cursor-pointer': canSort },
        id === 'title' && 'w-full',
        id === 'artist' && 'hidden w-40 whitespace-nowrap sm:table-cell',
        id === 'album' && 'hidden w-40 whitespace-nowrap md:table-cell',
        id === 'duration' && 'w-20 text-right whitespace-nowrap',
      )}
      onClick={onClick}
    >
      <span
        className={cn('flex items-center', id === 'duration' && 'justify-end')}
      >
        {children}
        {isSorted === 'desc' && <SortDesc className="ml-1 h-4 w-4" />}
        {isSorted === 'asc' && <SortAsc className="ml-1 h-4 w-4" />}
      </span>
    </th>
  );
}
