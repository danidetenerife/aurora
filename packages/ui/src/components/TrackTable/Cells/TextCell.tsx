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

  const isNoTruncate =
    meta?.noTruncate !== undefined ? Boolean(meta.noTruncate) : true;

  return (
    <td
      className={cn(
        isNoTruncate ? 'px-2' : 'truncate px-2',
        isArtist && 'hidden sm:table-cell',
        isDuration && 'w-20 text-right whitespace-nowrap',
        clickHandler ? 'cursor-pointer' : 'cursor-default',
      )}
    >
      {clickHandler ? (
        <button
          type="button"
          className={cn(
            'w-full text-left hover:underline focus:outline-none break-normal whitespace-normal [overflow-wrap:anywhere]',
            !isNoTruncate && 'truncate',
          )}
          onClick={(event) => {
            event.stopPropagation();
            clickHandler();
          }}
        >
          {value}
        </button>
      ) : (
        <div
          className={
            isNoTruncate
              ? 'break-normal whitespace-normal [overflow-wrap:anywhere]'
              : 'truncate'
          }
        >
          {value}
        </div>
      )}
    </td>
  );
};
