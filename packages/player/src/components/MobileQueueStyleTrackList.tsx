import { CassetteTape, EllipsisVertical, ListPlus, Play } from 'lucide-react';
import { FC, useMemo } from 'react';

import type { Track } from '@aurora/model';
import { pickArtwork } from '@aurora/model';
import { Button } from '@aurora/ui';

import { useQueueActions } from '../hooks/useQueueActions';
import { useTrackTableLabels } from '../hooks/useTrackTableLabels';
import { useMobilePlayerStore } from '../stores/mobilePlayerStore';
import { useQueueStore } from '../stores/queueStore';

type MobileQueueStyleTrackListProps = {
  tracks: Track[];
};

const formatDuration = (totalMillis?: number) => {
  if (!totalMillis || totalMillis <= 0) {
    return '';
  }
  const totalSeconds = Math.floor(totalMillis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const MobileQueueStyleTrackList: FC<MobileQueueStyleTrackListProps> = ({
  tracks,
}) => {
  const labels = useTrackTableLabels();
  const queueActions = useQueueActions();
  const openContextMenu = useMobilePlayerStore(
    (state) => state.openContextMenu,
  );

  const currentTrack = useQueueStore(
    (state) => state.items[state.currentIndex]?.track,
  );

  const currentPlayingId = useMemo(() => {
    if (!currentTrack) {
      return null;
    }
    return (
      currentTrack.source?.id ??
      `${currentTrack.artists?.[0]?.name}-${currentTrack.title}`
    );
  }, [currentTrack]);

  return (
    <div
      className="flex h-full min-h-0 flex-col select-none"
      data-testid="mobile-queue-style-track-list"
    >
      {/* Top action toolbar */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/5 px-3 py-2">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            aria-label={labels.playAll}
            disabled={!tracks.length}
            onClick={() => queueActions.playTracks(tracks, 0)}
            className="flex h-8 cursor-pointer items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 text-xs font-bold text-white shadow-none transition-all hover:bg-white/10 active:scale-95"
          >
            <Play size={13} className="fill-current text-white" />
            <span>{labels.playAll}</span>
          </Button>

          <Button
            size="icon"
            variant="ghost"
            aria-label={labels.addAllToQueue}
            disabled={!tracks.length}
            onClick={() => queueActions.addToQueue(tracks)}
            className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-white/10 text-zinc-400 transition-all hover:bg-white/10 hover:text-white active:scale-95"
          >
            <ListPlus size={16} />
          </Button>
        </div>

        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-400">
          {tracks.length} {tracks.length === 1 ? 'canción' : 'canciones'}
        </span>
      </div>

      {/* Continuous scrollable list of tracks (Queue visual style) */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-2.5 pb-36">
        {tracks.map((track, index) => {
          const trackId =
            track.source?.id ?? `${track.artists?.[0]?.name}-${track.title}`;
          const isCurrent =
            currentPlayingId != null && trackId === currentPlayingId;

          const artwork =
            pickArtwork(track.artwork, 'thumbnail', 96) ??
            pickArtwork(track.album?.artwork, 'thumbnail', 96);
          const artworkUrl = artwork?.url;

          const artistName =
            track.artists && track.artists.length > 0
              ? track.artists
                  .map((a) => a.name)
                  .filter(Boolean)
                  .join(', ')
              : (track as unknown as { artist?: string }).artist || '';

          const durationStr = formatDuration(track.durationMs);

          return (
            <div
              key={`${trackId}-${index}`}
              data-testid="track-item"
              data-is-current={isCurrent}
              onClick={() => queueActions.playTracks(tracks, index)}
              className={`group relative flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-2.5 transition-all active:scale-[0.99] ${
                isCurrent
                  ? 'border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                  : 'border-white/5 bg-white/[0.03] hover:bg-white/[0.08]'
              }`}
            >
              {/* Thumbnail */}
              <div className="flex size-13 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/40">
                {artworkUrl ? (
                  <img
                    src={artworkUrl}
                    alt={track.title}
                    className="size-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <CassetteTape
                    size={28}
                    className="text-white/20"
                    absoluteStrokeWidth
                  />
                )}
              </div>

              {/* Title & Artist without truncation */}
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <span
                  className={`text-sm leading-snug font-bold break-words ${
                    isCurrent ? 'font-black text-emerald-400' : 'text-white'
                  }`}
                >
                  {track.title}
                </span>
                {artistName && (
                  <span className="mt-0.5 text-xs leading-snug break-words text-zinc-400">
                    {artistName}
                  </span>
                )}
              </div>

              {/* Duration and 3-dots context menu button */}
              <div className="flex shrink-0 items-center gap-1.5">
                {durationStr && (
                  <span className="font-mono text-xs text-zinc-400 tabular-nums">
                    {durationStr}
                  </span>
                )}

                <button
                  type="button"
                  data-testid="track-context-menu-button"
                  aria-label="Opciones de la canción"
                  onClick={(e) => {
                    e.stopPropagation();
                    openContextMenu(track);
                  }}
                  className="cursor-pointer rounded-lg p-2 text-zinc-400 transition-all hover:bg-white/10 hover:text-white active:scale-90"
                >
                  <EllipsisVertical size={18} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
