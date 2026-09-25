import {
  ChevronDown,
  ListEnd,
  ListMusic,
  MoreVertical,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { FC } from 'react';
import { toast } from 'sonner';

import { useTranslation } from '@aurora/i18n';
import { pickArtwork } from '@aurora/model';
import { RepeatMode } from '@aurora/plugin-sdk';
import { PillRatingGroup } from '@aurora/ui';

import { useCoreSetting } from '../../hooks/useCoreSetting';
import { personalizationEngine } from '../../services/personalizationEngine';
import { playbackManager } from '../../services/playback';
import { isCapacitorEnvironment } from '../../services/universalStore';
import { useFavoritesStore } from '../../stores/favoritesStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { useMobilePlayerStore } from '../../stores/mobilePlayerStore';
import { useQueueStore } from '../../stores/queueStore';
import { useSoundStore } from '../../stores/soundStore';

const formatSeconds = (sec: number): string => {
  if (!Number.isFinite(sec) || sec < 0) {
    return '0:00';
  }
  const minutes = Math.floor(sec / 60);
  const seconds = Math.floor(sec % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

export const MobileExpandedPlayer: FC = () => {
  const { t: tTrack } = useTranslation('track');
  const { t: tCommon } = useTranslation('common');
  const { isExpanded, closeExpanded, openContextMenu } = useMobilePlayerStore();
  const toggleRightSidebar = useLayoutStore((s) => s.toggleRightSidebar);

  const track = useQueueStore(
    (state) => state.items[state.currentIndex]?.track,
  );
  const goToNext = useQueueStore((state) => state.goToNext);

  const status = useSoundStore((state) => state.status);
  const seek = useSoundStore((state) => state.seek);
  const duration = useSoundStore((state) => state.duration);
  const seekTo = useSoundStore((state) => state.seekTo);

  const [shuffleEnabled, setShuffleEnabled] =
    useCoreSetting<boolean>('playback.shuffle');
  const [repeatMode, setRepeatMode] =
    useCoreSetting<RepeatMode>('playback.repeat');

  const isFavorite = useFavoritesStore((state) =>
    track
      ? state.tracks.some(
          (entry) =>
            entry.ref.source?.provider === track.source?.provider &&
            entry.ref.source?.id === track.source?.id,
        )
      : false,
  );
  const addTrack = useFavoritesStore((state) => state.addTrack);
  const removeTrack = useFavoritesStore((state) => state.removeTrack);

  if (!isCapacitorEnvironment() || !isExpanded || !track) {
    return null;
  }

  const artwork =
    pickArtwork(track.artwork, 'cover', 500) ??
    pickArtwork(track.artwork, 'thumbnail', 300);
  const title = track.title;
  const artist = track.artists?.map((a) => a.name).join(', ') ?? '';

  const handleToggleFavorite = () => {
    if (isFavorite) {
      void removeTrack(track.source);
    } else {
      void addTrack(track);
    }
  };

  const handleDislike = () => {
    const trackId =
      track.source?.id || `${track.artists?.[0]?.name}-${track.title}`;
    void personalizationEngine.blacklistTrack(trackId);
    toast.success(tTrack('actions.trackBlacklisted'), {
      action: {
        label: tCommon('actions.undo'),
        onClick: () => {
          void personalizationEngine.unblacklistTrack(trackId);
        },
      },
    });
    goToNext();
  };

  const handleToggleShuffle = () => {
    setShuffleEnabled(!shuffleEnabled);
  };

  const handleToggleRepeat = () => {
    const modes: Array<RepeatMode> = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf(repeatMode ?? 'off');
    const nextIndex = (currentIndex + 1) % modes.length;
    setRepeatMode(modes[nextIndex]);
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetPercent = Number(e.target.value);
    if (duration > 0) {
      seekTo((targetPercent / 100) * duration);
    }
  };

  const progressPercent = duration > 0 ? (seek / duration) * 100 : 0;

  return (
    <div
      data-testid="mobile-expanded-player"
      className="from-background-secondary via-background to-background fixed inset-0 z-50 flex flex-col justify-between bg-gradient-to-b px-6 pt-12 pb-14 select-none"
    >
      {/* Header */}
      <div className="flex w-full items-center justify-between">
        <button
          type="button"
          onClick={closeExpanded}
          className="border-border text-foreground hover:bg-background-secondary cursor-pointer rounded-xl border p-2 transition-all active:scale-95"
          data-testid="expanded-player-close"
          aria-label="Minimizar reproductor"
        >
          <ChevronDown className="size-6" />
        </button>

        <div className="flex flex-col text-center">
          <span className="text-primary text-[11px] font-black tracking-widest uppercase">
            Reproduciendo ahora
          </span>
          {track.album?.title && (
            <span className="text-foreground-secondary max-w-[280px] text-xs leading-tight break-normal [overflow-wrap:anywhere] whitespace-normal">
              {track.album.title}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => openContextMenu(track)}
          className="border-border text-foreground hover:bg-background-secondary cursor-pointer rounded-xl border p-2 transition-all active:scale-95"
          data-testid="expanded-player-more"
          aria-label="Más opciones"
        >
          <MoreVertical className="size-5" />
        </button>
      </div>

      {/* Main Canvas: Artwork */}
      <div className="my-4 flex w-full flex-1 flex-col items-center justify-center">
        <div className="border-border bg-card relative aspect-square h-64 w-64 overflow-hidden rounded-2xl border-2 shadow-2xl sm:h-72 sm:w-72">
          {artwork?.url ? (
            <img
              src={artwork.url}
              alt={title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="bg-card text-foreground-secondary flex h-full w-full items-center justify-center">
              <ListMusic className="size-20 opacity-30" />
            </div>
          )}
        </div>

        {/* Metadata & Rating Pill Group */}
        <div className="mt-6 w-full text-center">
          <h1 className="text-foreground px-2 text-xl leading-tight font-black break-words sm:text-2xl">
            {title}
          </h1>
          <p className="text-foreground-secondary mt-1 px-2 text-base leading-tight font-medium break-words">
            {artist}
          </p>

          <div className="mt-3 flex justify-center">
            <PillRatingGroup
              size="default"
              isFavorite={isFavorite}
              onToggleFavorite={handleToggleFavorite}
              onDislike={handleDislike}
              labels={{
                favoriteAdd: tTrack('actions.addToFavorites'),
                favoriteRemove: tTrack('actions.removeFromFavorites'),
                dislike: tTrack('actions.dislike'),
              }}
              data-testid="expanded-player-pill-rating"
            />
          </div>
        </div>
      </div>

      {/* Bottom Controls Area */}
      <div className="flex w-full flex-col gap-3">
        {/* Scrubber Progress Bar */}
        <div className="w-full">
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={progressPercent}
            onChange={handleSeekChange}
            className="bg-background-secondary accent-primary h-2 w-full cursor-pointer appearance-none rounded-lg"
            aria-label="Posición de reproducción"
          />
          <div className="text-foreground-secondary mt-1 flex justify-between text-xs font-semibold tabular-nums">
            <span>{formatSeconds(seek)}</span>
            <span>{formatSeconds(duration)}</span>
          </div>
        </div>

        {/* YouTube Music Transport Controls */}
        <div className="flex w-full items-center justify-between px-2">
          {/* Shuffle */}
          <button
            type="button"
            onClick={handleToggleShuffle}
            className={`cursor-pointer rounded-xl p-2 transition-all ${
              shuffleEnabled
                ? 'text-primary font-bold'
                : 'text-foreground-secondary hover:text-foreground'
            }`}
            aria-label="Aleatorio"
          >
            <Shuffle className="size-6" />
          </button>

          {/* Previous */}
          <button
            type="button"
            onClick={playbackManager.previous}
            className="text-foreground hover:text-primary cursor-pointer p-2 transition-all active:scale-90"
            aria-label="Canción anterior"
          >
            <SkipBack className="size-7" />
          </button>

          {/* Large Center Play/Pause */}
          <button
            type="button"
            onClick={playbackManager.toggle}
            className="bg-primary text-primary-foreground flex size-16 cursor-pointer items-center justify-center rounded-full shadow-xl transition-transform active:scale-90"
            aria-label={status === 'playing' ? 'Pausar' : 'Reproducir'}
            data-testid="expanded-player-play-pause"
          >
            {status === 'playing' ? (
              <Pause className="size-8 fill-current" />
            ) : (
              <Play className="ml-1 size-8 fill-current" />
            )}
          </button>

          {/* Next */}
          <button
            type="button"
            onClick={goToNext}
            className="text-foreground hover:text-primary cursor-pointer p-2 transition-all active:scale-90"
            aria-label="Siguiente canción"
          >
            <SkipForward className="size-7" />
          </button>

          {/* Repeat */}
          <button
            type="button"
            onClick={handleToggleRepeat}
            className={`cursor-pointer rounded-xl p-2 transition-all ${
              repeatMode !== 'off'
                ? 'text-primary font-bold'
                : 'text-foreground-secondary hover:text-foreground'
            }`}
            aria-label="Repetir"
          >
            {repeatMode === 'one' ? (
              <Repeat1 className="size-6" />
            ) : (
              <Repeat className="size-6" />
            )}
          </button>
        </div>

        {/* Quick Action Footer */}
        <div className="mt-2 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => {
              closeExpanded();
              toggleRightSidebar();
            }}
            className="border-border bg-card text-foreground hover:bg-background-secondary flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all active:scale-95"
            data-testid="expanded-player-open-queue"
          >
            <ListEnd className="text-primary size-4" />
            <span>Cola</span>
          </button>

          <button
            type="button"
            onClick={() => openContextMenu(track)}
            className="border-border bg-card text-foreground hover:bg-background-secondary flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all active:scale-95"
          >
            <ListMusic className="text-primary size-4" />
            <span>Opciones</span>
          </button>
        </div>
      </div>
    </div>
  );
};
