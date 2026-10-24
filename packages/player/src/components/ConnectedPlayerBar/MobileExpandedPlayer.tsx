import {
  Car,
  ChevronDown,
  Heart,
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
  ThumbsDown,
} from 'lucide-react';
import { FC, useRef, useState } from 'react';
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

const SECONDS_PER_MINUTE = 60;
const TEN_SECONDS = 10;
const PERCENT_MULTIPLIER = 100;
const COVER_ARTWORK_SIZE = 500;
const THUMBNAIL_ARTWORK_SIZE = 300;
const NEXT_THUMBNAIL_SIZE = 120;
const SWIPE_HORIZONTAL_THRESHOLD_PX = 50;
const SWIPE_VERTICAL_CLOSE_PX = 90;
const DOUBLE_TAP_WINDOW_MS = 320;
const HEART_BURST_DURATION_MS = 750;
const HAPTIC_SHORT_MS = 25;
const HAPTIC_FAVORITE_PATTERN = [30, 45, 55];

const triggerHaptic = (pattern: number | number[]): void => {
  try {
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.vibrate === 'function'
    ) {
      navigator.vibrate(pattern);
    }
  } catch {
    return;
  }
};

const formatSeconds = (totalSeconds: number): string => {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return '0:00';
  }
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = Math.floor(totalSeconds % SECONDS_PER_MINUTE);
  return `${minutes}:${seconds < TEN_SECONDS ? '0' : ''}${seconds}`;
};

export const MobileExpandedPlayer: FC = () => {
  const { t: tTrack } = useTranslation('track');
  const { t: tCommon } = useTranslation('common');
  const {
    isExpanded,
    isDrivingMode,
    closeExpanded,
    toggleDrivingMode,
    openContextMenu,
  } = useMobilePlayerStore();
  const toggleRightSidebar = useLayoutStore(
    (state) => state.toggleRightSidebar,
  );

  const track = useQueueStore(
    (state) => state.items[state.currentIndex]?.track,
  );
  const nextTrack = useQueueStore(
    (state) => state.items[state.currentIndex + 1]?.track,
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
      ? state.isTrackFavorite(
          track.source,
          track.title,
          track.artists?.[0]?.name,
        )
      : false,
  );
  const addTrack = useFavoritesStore((state) => state.addTrack);
  const removeTrack = useFavoritesStore((state) => state.removeTrack);
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const [showHeartBurst, setShowHeartBurst] = useState(false);

  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const lastTapTimeRef = useRef<number>(0);

  if (!isCapacitorEnvironment() || !isExpanded || !track) {
    return null;
  }

  const artwork =
    pickArtwork(track.artwork, 'cover', COVER_ARTWORK_SIZE) ??
    pickArtwork(track.artwork, 'thumbnail', THUMBNAIL_ARTWORK_SIZE);
  const nextArtwork = nextTrack
    ? (pickArtwork(nextTrack.artwork, 'thumbnail', NEXT_THUMBNAIL_SIZE) ??
      pickArtwork(nextTrack.artwork, 'cover', NEXT_THUMBNAIL_SIZE))
    : undefined;
  const title = track.title;
  const artist =
    track.artists?.map((artistItem) => artistItem.name).join(', ') ?? '';
  const nextArtist =
    nextTrack?.artists?.map((artistItem) => artistItem.name).join(', ') ?? '';

  const handleToggleFavorite = () => {
    triggerHaptic(HAPTIC_FAVORITE_PATTERN);
    if (isFavorite) {
      void removeTrack(track.source, track.title, track.artists?.[0]?.name);
    } else {
      void addTrack(track);
      setShowHeartBurst(true);
      window.setTimeout(() => {
        setShowHeartBurst(false);
      }, HEART_BURST_DURATION_MS);
    }
  };

  const handleDislike = () => {
    triggerHaptic(HAPTIC_SHORT_MS);
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
    useQueueStore.getState().dislikeTrack(track);
  };

  const handleSkipNext = () => {
    triggerHaptic(HAPTIC_SHORT_MS);
    goToNext();
  };

  const handleSkipPrevious = () => {
    triggerHaptic(HAPTIC_SHORT_MS);
    playbackManager.previous();
  };

  const handlePlayPause = () => {
    triggerHaptic(HAPTIC_SHORT_MS);
    playbackManager.toggle();
  };

  const handleToggleShuffle = () => {
    triggerHaptic(HAPTIC_SHORT_MS);
    setShuffleEnabled(!shuffleEnabled);
  };

  const handleToggleRepeat = () => {
    triggerHaptic(HAPTIC_SHORT_MS);
    const modes: Array<RepeatMode> = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf(repeatMode ?? 'off');
    const nextIndex = (currentIndex + 1) % modes.length;
    setRepeatMode(modes[nextIndex]);
  };

  const handleSeekChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const targetPercent = Number(event.target.value);
    if (duration > 0) {
      seekTo((targetPercent / PERCENT_MULTIPLIER) * duration);
    }
  };

  const handleArtworkTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const firstTouch = event.touches[0];
    if (!firstTouch) {
      return;
    }
    touchStartXRef.current = firstTouch.clientX;
    touchStartYRef.current = firstTouch.clientY;
  };

  const handleArtworkTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const changedTouch = event.changedTouches[0];
    const startX = touchStartXRef.current;
    const startY = touchStartYRef.current;
    touchStartXRef.current = null;
    touchStartYRef.current = null;

    if (!changedTouch || startX === null || startY === null) {
      return;
    }

    const deltaX = changedTouch.clientX - startX;
    const deltaY = changedTouch.clientY - startY;

    if (
      Math.abs(deltaX) > Math.abs(deltaY) &&
      Math.abs(deltaX) >= SWIPE_HORIZONTAL_THRESHOLD_PX
    ) {
      if (deltaX < 0) {
        handleSkipNext();
      } else {
        handleSkipPrevious();
      }
      return;
    }

    if (
      deltaY > SWIPE_VERTICAL_CLOSE_PX &&
      Math.abs(deltaY) > Math.abs(deltaX)
    ) {
      triggerHaptic(HAPTIC_SHORT_MS);
      closeExpanded();
    }
  };

  const handleArtworkClick = () => {
    const now = Date.now();
    if (now - lastTapTimeRef.current <= DOUBLE_TAP_WINDOW_MS) {
      lastTapTimeRef.current = 0;
      handleToggleFavorite();
      return;
    }
    lastTapTimeRef.current = now;
  };

  const progressPercent =
    duration > 0 ? (seek / duration) * PERCENT_MULTIPLIER : 0;
  const hasValidArtwork = Boolean(artwork?.url && brokenUrl !== artwork.url);

  return (
    <div
      data-testid="mobile-expanded-player"
      className="from-background-secondary via-background to-background fixed inset-0 z-50 flex flex-col justify-between overflow-hidden bg-gradient-to-b px-5 pt-10 pb-10 select-none landscape:px-8 landscape:pt-4 landscape:pb-4"
    >
      {hasValidArtwork && artwork?.url && (
        <div
          data-testid="expanded-player-ambient-bg"
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        >
          <img
            src={artwork.url}
            alt=""
            aria-hidden="true"
            referrerPolicy="no-referrer"
            className="h-full w-full scale-125 object-cover opacity-35 blur-3xl transition-all duration-700"
          />
          <div
            className={`absolute inset-0 ${
              isDrivingMode
                ? 'bg-black/80'
                : 'from-background/60 via-background/80 to-background/95 bg-gradient-to-b'
            }`}
          />
        </div>
      )}

      <div className="flex w-full items-center justify-between gap-2">
        <button
          type="button"
          onClick={closeExpanded}
          className="border-border bg-card/70 text-foreground hover:bg-background-secondary cursor-pointer rounded-xl border p-2.5 backdrop-blur-md transition-all active:scale-95"
          data-testid="expanded-player-close"
          aria-label="Minimizar reproductor"
        >
          <ChevronDown className="size-6" />
        </button>

        <div className="flex flex-col text-center">
          <span className="text-primary text-[11px] font-black tracking-widest uppercase">
            {isDrivingMode ? 'Modo Conducción' : 'Reproduciendo ahora'}
          </span>
          {track.album?.title && !isDrivingMode && (
            <span className="text-foreground-secondary max-w-[220px] truncate text-xs leading-tight">
              {track.album.title}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(HAPTIC_SHORT_MS);
              toggleDrivingMode();
            }}
            className={`cursor-pointer rounded-xl border p-2.5 backdrop-blur-md transition-all active:scale-95 ${
              isDrivingMode
                ? 'border-primary bg-primary text-primary-foreground shadow-lg'
                : 'border-border bg-card/70 text-foreground hover:bg-background-secondary'
            }`}
            data-testid="expanded-player-driving-toggle"
            aria-label="Modo conducción"
            aria-pressed={isDrivingMode}
          >
            <Car className="size-5" />
          </button>

          <button
            type="button"
            onClick={() => openContextMenu(track)}
            className="border-border bg-card/70 text-foreground hover:bg-background-secondary cursor-pointer rounded-xl border p-2.5 backdrop-blur-md transition-all active:scale-95"
            data-testid="expanded-player-more"
            aria-label="Más opciones"
          >
            <MoreVertical className="size-5" />
          </button>
        </div>
      </div>

      <div className="my-2 flex w-full flex-1 flex-col items-center justify-between gap-4 landscape:my-1 landscape:flex-row landscape:items-center landscape:gap-8">
        <div
          onTouchStart={handleArtworkTouchStart}
          onTouchEnd={handleArtworkTouchEnd}
          onClick={handleArtworkClick}
          data-testid="expanded-player-artwork-gesture-zone"
          className="flex flex-col items-center justify-center landscape:w-5/12"
        >
          <div
            className={`border-border bg-card relative aspect-square overflow-hidden rounded-3xl border-2 shadow-2xl transition-all ${
              isDrivingMode
                ? 'h-52 w-52 sm:h-64 sm:w-64 landscape:h-48 landscape:w-48'
                : 'h-60 w-60 sm:h-72 sm:w-72 landscape:h-48 landscape:w-48'
            }`}
          >
            {hasValidArtwork && artwork?.url ? (
              <img
                src={artwork.url}
                alt={title}
                referrerPolicy="no-referrer"
                onError={() => setBrokenUrl(artwork.url)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="bg-card text-foreground-secondary flex h-full w-full items-center justify-center">
                <ListMusic className="size-20 opacity-30" />
              </div>
            )}

            {showHeartBurst && (
              <div
                data-testid="expanded-player-heart-burst"
                className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 backdrop-blur-[2px]"
              >
                <Heart className="text-primary size-24 animate-ping fill-current" />
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-3 py-2 text-center">
              <span className="text-[11px] font-semibold tracking-wide text-white/90">
                Desliza ◄ ► cambiar · 2 toques ❤️
              </span>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col justify-between gap-3 landscape:w-7/12">
          <div className="w-full text-center landscape:text-left">
            <h1
              className={`text-foreground px-2 leading-tight font-black break-words landscape:px-0 ${
                isDrivingMode
                  ? 'line-clamp-2 text-2xl sm:text-3xl'
                  : 'line-clamp-2 text-xl sm:text-2xl'
              }`}
            >
              {title}
            </h1>
            <p
              className={`text-foreground-secondary mt-1 px-2 leading-tight font-semibold break-words landscape:px-0 ${
                isDrivingMode ? 'text-lg sm:text-xl' : 'text-base'
              }`}
            >
              {artist}
            </p>

            {isDrivingMode ? (
              <div className="mt-4 grid w-full grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleDislike}
                  data-testid="driving-dislike-button"
                  aria-label={tTrack('actions.dislike')}
                  className="border-border bg-card/85 text-foreground hover:bg-background-secondary flex min-h-14 cursor-pointer items-center justify-center gap-2.5 rounded-2xl border-2 px-4 py-3 text-base font-bold shadow-md transition-transform active:scale-95"
                >
                  <ThumbsDown className="size-6" />
                  <span>Saltar / No</span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  data-testid="driving-favorite-button"
                  aria-label={
                    isFavorite
                      ? tTrack('actions.removeFromFavorites')
                      : tTrack('actions.addToFavorites')
                  }
                  className={`flex min-h-14 cursor-pointer items-center justify-center gap-2.5 rounded-2xl border-2 px-4 py-3 text-base font-bold shadow-md transition-transform active:scale-95 ${
                    isFavorite
                      ? 'border-primary bg-primary/20 text-primary'
                      : 'border-border bg-card/85 text-foreground hover:bg-background-secondary'
                  }`}
                >
                  <Heart
                    className={`size-6 ${isFavorite ? 'fill-current' : ''}`}
                  />
                  <span>{isFavorite ? 'En Favoritos' : 'Favorito'}</span>
                </button>
              </div>
            ) : (
              <div className="mt-3 flex justify-center landscape:justify-start">
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
            )}
          </div>

          <div className="flex w-full flex-col gap-3">
            <div className="w-full">
              <input
                type="range"
                min="0"
                max="100"
                step="0.1"
                value={progressPercent}
                onChange={handleSeekChange}
                className={`bg-background-secondary accent-primary w-full cursor-pointer appearance-none rounded-full ${
                  isDrivingMode ? 'h-4' : 'h-2'
                }`}
                aria-label="Posición de reproducción"
              />
              <div
                className={`text-foreground-secondary mt-1.5 flex justify-between font-bold tabular-nums ${
                  isDrivingMode ? 'text-sm' : 'text-xs'
                }`}
              >
                <span>{formatSeconds(seek)}</span>
                <span>{formatSeconds(duration)}</span>
              </div>
            </div>

            <div className="flex w-full items-center justify-between px-1">
              <button
                type="button"
                onClick={handleToggleShuffle}
                className={`cursor-pointer rounded-xl p-2.5 transition-all active:scale-90 ${
                  shuffleEnabled
                    ? 'text-primary font-bold'
                    : 'text-foreground-secondary hover:text-foreground'
                }`}
                aria-label="Aleatorio"
              >
                <Shuffle className={isDrivingMode ? 'size-7' : 'size-6'} />
              </button>

              <button
                type="button"
                onClick={handleSkipPrevious}
                className={`text-foreground hover:text-primary flex cursor-pointer items-center justify-center transition-all active:scale-90 ${
                  isDrivingMode
                    ? 'border-border bg-card/80 size-16 rounded-2xl border shadow-lg'
                    : 'p-2'
                }`}
                aria-label="Canción anterior"
              >
                <SkipBack className={isDrivingMode ? 'size-9' : 'size-7'} />
              </button>

              <button
                type="button"
                onClick={handlePlayPause}
                className={`bg-primary text-primary-foreground flex cursor-pointer items-center justify-center rounded-full shadow-2xl transition-transform active:scale-90 ${
                  isDrivingMode ? 'size-20 sm:size-24' : 'size-16'
                }`}
                aria-label={status === 'playing' ? 'Pausar' : 'Reproducir'}
                data-testid="expanded-player-play-pause"
              >
                {status === 'playing' ? (
                  <Pause
                    className={`fill-current ${
                      isDrivingMode ? 'size-11' : 'size-8'
                    }`}
                  />
                ) : (
                  <Play
                    className={`ml-1 fill-current ${
                      isDrivingMode ? 'size-11' : 'size-8'
                    }`}
                  />
                )}
              </button>

              <button
                type="button"
                onClick={handleSkipNext}
                className={`text-foreground hover:text-primary flex cursor-pointer items-center justify-center transition-all active:scale-90 ${
                  isDrivingMode
                    ? 'border-border bg-card/80 size-16 rounded-2xl border shadow-lg'
                    : 'p-2'
                }`}
                aria-label="Siguiente canción"
              >
                <SkipForward className={isDrivingMode ? 'size-9' : 'size-7'} />
              </button>

              <button
                type="button"
                onClick={handleToggleRepeat}
                className={`cursor-pointer rounded-xl p-2.5 transition-all active:scale-90 ${
                  repeatMode !== 'off'
                    ? 'text-primary font-bold'
                    : 'text-foreground-secondary hover:text-foreground'
                }`}
                aria-label="Repetir"
              >
                {repeatMode === 'one' ? (
                  <Repeat1 className={isDrivingMode ? 'size-7' : 'size-6'} />
                ) : (
                  <Repeat className={isDrivingMode ? 'size-7' : 'size-6'} />
                )}
              </button>
            </div>

            {nextTrack && (
              <button
                type="button"
                onClick={handleSkipNext}
                data-testid="expanded-player-up-next"
                className="border-border bg-card/75 hover:bg-background-secondary flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5 text-left backdrop-blur-md transition-all active:scale-98"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {nextArtwork?.url ? (
                    <img
                      src={nextArtwork.url}
                      alt={nextTrack.title}
                      referrerPolicy="no-referrer"
                      className="size-10 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="bg-background-secondary text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                      <ListMusic className="size-5" />
                    </div>
                  )}
                  <div className="flex min-w-0 flex-col">
                    <span className="text-primary text-[10px] font-extrabold tracking-wider uppercase">
                      Siguiente en cola
                    </span>
                    <span className="text-foreground truncate text-sm font-bold">
                      {nextTrack.title}
                    </span>
                    {nextArtist && (
                      <span className="text-foreground-secondary truncate text-xs">
                        {nextArtist}
                      </span>
                    )}
                  </div>
                </div>
                <SkipForward className="text-foreground-secondary size-5 shrink-0" />
              </button>
            )}

            {!isDrivingMode && (
              <div className="mt-1 flex items-center justify-center gap-4 landscape:justify-start">
                <button
                  type="button"
                  onClick={() => {
                    closeExpanded();
                    if (useLayoutStore.getState().rightSidebar.isCollapsed) {
                      toggleRightSidebar();
                    }
                  }}
                  className="border-border bg-card/80 text-foreground hover:bg-background-secondary flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all active:scale-95"
                  data-testid="expanded-player-open-queue"
                >
                  <ListEnd className="text-primary size-4" />
                  <span>Cola</span>
                </button>

                <button
                  type="button"
                  onClick={() => openContextMenu(track)}
                  className="border-border bg-card/80 text-foreground hover:bg-background-secondary flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all active:scale-95"
                >
                  <ListMusic className="text-primary size-4" />
                  <span>Opciones</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
