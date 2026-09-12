import { CellContext } from '@tanstack/react-table';

import { Track } from '@aurora/model';

import { cn } from '../../../utils';

type ClickableMeta = {
  onArtistClick?: (artistName: string, track: Track) => void;
  onAlbumClick?: (albumTitle: string, track: Track) => void;
  noTruncate?: boolean;
};

export const TextCell = <T extends Track>(
  context: CellContext<T, string | number | undefined>,
) => {
  const { getValue, column, row, table } = context;
  const value = getValue();
  const meta = table.options.meta as ClickableMeta | undefined;
  const track = row.original;

  const isArtist = column.id === 'artist';
  const isAlbum = column.id === 'album';
  const isDuration = column.id === 'duration';

  const clickHandler =
    isArtist && meta?.onArtistClick && value
      ? () => meta.onArtistClick!(String(value), track as unknown as Track)
      : isAlbum && meta?.onAlbumClick && value
        ? () => meta.onAlbumClick!(String(value), track as unknown as Track)
        : undefined;

  const isNoTruncate = Boolean(meta?.noTruncate);

  return (
    <td
      className={cn(
        isNoTruncate ? 'px-2' : 'truncate px-2',
        isArtist && 'hidden sm:table-cell',
        isNoTruncate && isDuration && 'whitespace-nowrap text-right',
        clickHandler ? 'cursor-pointer' : 'cursor-default',
      )}
    >
      {clickHandler ? (
        <button
          type="button"
          className={cn(
            'w-full',
            !isNoTruncate && 'truncate',
            'text-left hover:underline focus:outline-none',
          )}
          onClick={(event) => {
            event.stopPropagation();
            clickHandler();
          }}
        >
          {value}
        </button>
      ) : (
        <div className={isNoTruncate ? '' : 'truncate'}>{value}</div>
      )}
    </td>
  );
};
