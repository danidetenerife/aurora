import { CellContext } from '@tanstack/react-table';
import { EllipsisVertical, Plus } from 'lucide-react';
import { ComponentProps, FC, forwardRef } from 'react';

import { Track } from '@aurora/model';

import { cn } from '../../../utils';
import { Button } from '../../Button';
import { useTrackTableContext } from '../TrackTableContext';
import { ContextMenuWrapperProps } from '../types';

type TitleCellMeta = {
  displayQueueControls?: boolean;
  onAddToQueue?: (track: Track) => void;
  ContextMenuWrapper?: FC<ContextMenuWrapperProps>;
  noTruncate?: boolean;
  hideSubtitleArtist?: boolean;
  isCurrentTrack?: (track: Track) => boolean;
  onArtistClick?: (artistName: string, track: Track) => void;
};

type AddToQueueButtonProps = {
  label: string;
  onClick: () => void;
};

const AddToQueueButton: FC<AddToQueueButtonProps> = ({ label, onClick }) => (
  <Button
    data-testid="add-to-queue-button"
    size="icon-sm"
    variant="text"
    className="opacity-0 transition-none group-hover:opacity-100"
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    aria-label={label}
  >
    <Plus size={16} />
  </Button>
);

type ContextMenuButtonProps = ComponentProps<'button'> & {
  label: string;
};

const ContextMenuButton = forwardRef<HTMLButtonElement, ContextMenuButtonProps>(
  function ContextMenuButton({ label, onClick, ...props }, ref) {
    return (
      <Button
        {...props}
        ref={ref}
        data-testid="track-context-menu-button"
        size="icon-sm"
        variant="text"
        className="flex min-h-8 min-w-8 cursor-pointer items-center justify-center p-2 opacity-100 transition-none md:opacity-0 md:group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(e);
        }}
        aria-label={label}
      >
        <EllipsisVertical size={18} />
      </Button>
    );
  },
);

export const TitleCell = <T extends Track>({
  getValue,
  row,
  table,
}: CellContext<T, string | number | undefined>) => {
  const meta = table.options.meta as TitleCellMeta | undefined;
  const { actions, labels } = useTrackTableContext<T>();
  const showControls = meta?.displayQueueControls;
  const ContextMenuWrapper = meta?.ContextMenuWrapper;
  const noTruncate = Boolean(meta?.noTruncate);
  const hideSubtitleArtist = Boolean(meta?.hideSubtitleArtist);
  const track = row.original;
  const hasAddToQueue = Boolean(meta?.onAddToQueue);
  const hasContextMenu = Boolean(ContextMenuWrapper);
  const hasActions = hasAddToQueue || hasContextMenu;
  const isCurrent = Boolean(meta?.isCurrentTrack?.(track));
  const onArtistClick = actions?.onArtistClick ?? meta?.onArtistClick;
  const artistName =
    track.artists && track.artists.length > 0
      ? track.artists
          .map((artist) => artist.name)
          .filter(Boolean)
          .join(', ')
      : (track as unknown as { artist?: string }).artist || '';

  return (
    <td className="min-w-0 px-2 py-1.5">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div
          className={
            noTruncate
              ? 'flex min-w-0 flex-1 flex-col justify-center text-left'
              : 'flex min-w-0 flex-1 flex-col justify-center overflow-hidden text-left'
          }
        >
          <button
            type="button"
            className="flex min-w-0 cursor-pointer items-center text-left focus:outline-none"
            onClick={(e) => {
              e.stopPropagation();
              actions.onPlayNow?.(track);
            }}
          >
            <span
              className={cn(
                noTruncate
                  ? 'text-sm leading-snug font-semibold break-words whitespace-normal'
                  : 'line-clamp-2 text-sm leading-snug font-semibold break-words',
                'hover:underline',
                isCurrent ? 'text-accent-green font-bold' : 'text-foreground',
              )}
            >
              {getValue()}
            </span>
          </button>
          {artistName && !hideSubtitleArtist ? (
            <div
              className={
                noTruncate
                  ? 'text-foreground-secondary text-xs break-words whitespace-normal'
                  : 'text-foreground-secondary line-clamp-1 text-xs break-words'
              }
            >
              {track.artists && track.artists.length > 0 ? (
                track.artists.map((artist, index) => (
                  <span key={index}>
                    {index > 0 && <span>, </span>}
                    {onArtistClick && artist.name ? (
                      <button
                        type="button"
                        className="hover:text-foreground cursor-pointer text-left hover:underline focus:outline-none"
                        onClick={(e) => {
                          e.stopPropagation();
                          onArtistClick(artist.name, track);
                        }}
                      >
                        {artist.name}
                      </button>
                    ) : (
                      <span>{artist.name}</span>
                    )}
                  </span>
                ))
              ) : onArtistClick ? (
                <button
                  type="button"
                  className="hover:text-foreground cursor-pointer text-left hover:underline focus:outline-none"
                  onClick={(e) => {
                    e.stopPropagation();
                    onArtistClick(artistName, track);
                  }}
                >
                  {artistName}
                </button>
              ) : (
                <span>{artistName}</span>
              )}
            </div>
          ) : null}
        </div>
        {showControls && hasActions && (
          <div className="flex shrink-0 items-center gap-1">
            {hasAddToQueue && (
              <AddToQueueButton
                label={labels.addToQueue}
                onClick={() => meta?.onAddToQueue?.(track)}
              />
            )}
            {ContextMenuWrapper && (
              <ContextMenuWrapper track={track}>
                <ContextMenuButton label={labels.trackOptions} />
              </ContextMenuWrapper>
            )}
          </div>
        )}
      </div>
    </td>
  );
};
