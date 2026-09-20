import { Disc, Pause, Play, SkipForward } from 'lucide-react';
import { FC } from 'react';

import { pickArtwork } from '@aurora/model';
import { PlayerBar } from '@aurora/ui';

import { playbackManager } from '../../services/playback';
import { isCapacitorEnvironment } from '../../services/universalStore';
import { useMobilePlayerStore } from '../../stores/mobilePlayerStore';
import { useQueueStore } from '../../stores/queueStore';
import { useSoundStore } from '../../stores/soundStore';

import './mobile-player.css';

import { ConnectedControls } from './ConnectedControls';
import { ConnectedNowPlaying } from './ConnectedNowPlaying';
import { ConnectedSeekBar } from './ConnectedSeekBar';
import { ConnectedVolume } from './ConnectedVolume';

export const ConnectedPlayerBar: FC = () => {
  const isCapacitor = isCapacitorEnvironment();
  const track = useQueueStore(
    (state) => state.items[state.currentIndex]?.track,
  );
  const goToNext = useQueueStore((state) => state.goToNext);
  const status = useSoundStore((state) => state.status);
  const seek = useSoundStore((state) => state.seek);
  const duration = useSoundStore((state) => state.duration);

  if (isCapacitor) {
    if (!track) {
      return null;
    }

    const artwork =
      pickArtwork(track.artwork, 'thumbnail', 96) ??
      pickArtwork(track.artwork, 'cover', 96);
    const title = track.title;
    const artist = track.artists?.map((a) => a.name).join(', ') ?? '';
    const progressPercent =
      duration > 0 ? Math.min(100, Math.max(0, (seek / duration) * 100)) : 0;

    return (
      <div
        className="mobile-mini-player bg-background-secondary border-border flex w-full shrink-0 cursor-pointer flex-col border-t select-none"
        onClick={() => useMobilePlayerStore.getState().openExpanded()}
        data-testid="mobile-mini-player"
      >
        {/* YouTube Music ultra-thin top progress indicator */}
        <div className="bg-border/40 h-[2px] w-full overflow-hidden">
          <div
            className="bg-primary h-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Mini Player Row */}
        <div className="flex min-h-14 w-full items-center justify-between gap-3 px-3 py-2">
          {/* Artwork */}
          <div className="border-border bg-card size-10 shrink-0 overflow-hidden rounded-lg border">
            {artwork?.url ? (
              <img
                src={artwork.url}
                alt={title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="bg-card text-foreground-secondary flex h-full w-full items-center justify-center">
                <Disc className="size-5" />
              </div>
            )}
          </div>

          {/* Title & Artist */}
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <span className="text-foreground text-sm leading-tight font-bold break-words">
              {title}
            </span>
            <span className="text-foreground-secondary mt-0.5 text-xs leading-tight break-words">
              {artist}
            </span>
          </div>

          {/* Transport buttons */}
          <div
            className="flex shrink-0 items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={playbackManager.toggle}
              className="text-foreground hover:text-primary cursor-pointer p-2 transition-transform active:scale-90"
              aria-label={status === 'playing' ? 'Pausar' : 'Reproducir'}
              data-testid="mobile-mini-play-pause"
            >
              {status === 'playing' ? (
                <Pause className="size-6 fill-current" />
              ) : (
                <Play className="size-6 fill-current" />
              )}
            </button>
            <button
              type="button"
              onClick={goToNext}
              className="text-foreground-secondary hover:text-foreground cursor-pointer p-2 transition-transform active:scale-90"
              aria-label="Siguiente"
              data-testid="mobile-mini-next"
            >
              <SkipForward className="size-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <ConnectedSeekBar />
      <PlayerBar
        className="aurora-player"
        left={<ConnectedNowPlaying />}
        center={<ConnectedControls />}
        right={<ConnectedVolume />}
      />
    </>
  );
};
