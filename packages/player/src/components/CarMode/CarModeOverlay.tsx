import {
  Car,
  ChevronDown,
  Heart,
  Music,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  ThumbsDown,
} from 'lucide-react';
import { FC, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { pickArtwork } from '@aurora/model';
import { RepeatMode } from '@aurora/plugin-sdk';

import { useCoreSetting } from '../../hooks/useCoreSetting';
import { playbackManager } from '../../services/playback';
import { personalizationEngine } from '../../services/personalizationEngine';
import { useCarModeStore } from '../../stores/carModeStore';
import { useFavoritesStore } from '../../stores/favoritesStore';
import { useQueueStore } from '../../stores/queueStore';
import { useSoundStore } from '../../stores/soundStore';

const formatSeconds = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) {
    return '0:00';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const CarModeOverlay: FC = () => {
  const isCarMode = useCarModeStore((state) => state.isCarMode);
  const exitCarMode = useCarModeStore((state) => state.exitCarMode);
  const isBluetoothConnected = useCarModeStore(
    (state) => state.isBluetoothConnected,
  );
  const bluetoothDeviceName = useCarModeStore(
    (state) => state.bluetoothDeviceName,
  );

  const currentItem = useQueueStore((state) => state.getCurrentItem());
  const currentTrack = currentItem?.track;

  const { goToNext, goToPrevious } = useQueueStore(
    useShallow((state) => ({
      goToNext: state.goToNext,
      goToPrevious: state.goToPrevious,
    })),
  );

  const status = useSoundStore((state) => state.status);
  const seek = useSoundStore((state) => state.seek);
  const duration = useSoundStore((state) => state.duration);
  const seekTo = useSoundStore((state) => state.seekTo);

  const isPlaying = status === 'playing';

  const [shuffleEnabled, setShuffleEnabled] =
    useCoreSetting<boolean>('playback.shuffle');
  const [repeatMode, setRepeatMode] =
    useCoreSetting<RepeatMode>('playback.repeat');

  const { isTrackFavorite, addTrack, removeTrack } = useFavoritesStore(
    useShallow((state) => ({
      isTrackFavorite: state.isTrackFavorite,
      addTrack: state.addTrack,
      removeTrack: state.removeTrack,
    })),
  );

  const isFav = currentTrack ? isTrackFavorite(currentTrack.source) : false;

  const handleToggleFavorite = () => {
    if (!currentTrack) {
      return;
    }
    if (isFav) {
      void removeTrack(currentTrack.source);
    } else {
      void addTrack(currentTrack);
    }
  };

  const handleDislike = () => {
    if (!currentTrack) {
      return;
    }
    const trackId =
      currentTrack.source?.id ||
      `${currentTrack.artists?.[0]?.name}-${currentTrack.title}`;
    void personalizationEngine.blacklistTrack(trackId);
    goToNext();
  };

  const handleToggleRepeat = () => {
    const modes: Array<RepeatMode> = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf(repeatMode ?? 'off');
    const nextIndex = (currentIndex + 1) % modes.length;
    setRepeatMode(modes[nextIndex]);
  };

  const artwork = useMemo(() => {
    if (!currentTrack?.artwork) {
      return undefined;
    }
    return (
      pickArtwork(currentTrack.artwork, 'cover', 600) ??
      pickArtwork(currentTrack.artwork, 'thumbnail', 600)
    );
  }, [currentTrack]);

  const [seekingValue, setSeekingValue] = useState<number | null>(null);

  if (!isCarMode) {
    return null;
  }

  const effectiveTime = seekingValue ?? seek;

  return (
    <div
      data-testid="car-mode-overlay"
      className="fixed inset-0 z-50 flex flex-col justify-between overflow-hidden bg-zinc-950 text-white select-none"
    >
      {/* Top Header Bar */}
      <div className="aurora-car-header relative z-10 flex flex-wrap items-center justify-between gap-2 px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-zinc-700/60 bg-zinc-800/80 px-3.5 py-1.5 shadow-lg backdrop-blur-md">
            <Car size={18} className="animate-pulse text-emerald-400" />
            <span className="text-xs font-bold tracking-wider text-zinc-200 uppercase">
              Modo Coche
            </span>
            {isBluetoothConnected && (
              <span className="flex items-center gap-1 border-l border-zinc-700 pl-1 text-[11px] font-medium text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {bluetoothDeviceName || 'Bluetooth'}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={exitCarMode}
          className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800/90 px-4 py-2 text-sm font-bold text-zinc-200 shadow-md transition-all hover:bg-zinc-700 active:scale-95"
        >
          <ChevronDown size={18} />
          <span>Salir</span>
        </button>
        <button
          onClick={handleToggleRepeat}
          className={`flex size-11 items-center justify-center rounded-full border text-zinc-200 transition-all active:scale-95 ${
            repeatMode !== 'off'
              ? 'border-emerald-500/40 bg-emerald-950/60 text-emerald-400'
              : 'border-zinc-700 bg-zinc-800/90 hover:bg-zinc-700'
          }`}
          title="Repetir"
          aria-label="Repetir"
        >
          {repeatMode === 'one' ? <Repeat1 size={21} /> : <Repeat size={21} />}
        </button>
      </div>

      {/* Main Track Display (Center) */}
      <div className="aurora-car-track relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-2">
        {/* Giant Artwork */}
        <div className="relative mb-6 flex aspect-square max-h-[36vh] w-auto items-center justify-center overflow-hidden rounded-2xl border-2 border-zinc-700/80 bg-zinc-900 shadow-2xl sm:max-h-[44vh]">
          {artwork?.url ? (
            <img
              src={artwork.url}
              alt={currentTrack?.title ?? 'Artwork'}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-zinc-600">
              <Music size={80} />
            </div>
          )}
        </div>

        {/* Track Title & Artist */}
        <div className="w-full max-w-lg space-y-1.5 px-4 text-center">
          <h1 className="truncate text-2xl font-extrabold tracking-tight text-white drop-shadow-md sm:text-4xl">
            {currentTrack?.title ?? 'Sin reproducción'}
          </h1>
          <p className="truncate text-lg font-semibold text-zinc-300 sm:text-2xl">
            {currentTrack?.artists?.[0]?.name ?? 'Aurora'}
          </p>
        </div>
      </div>

      {/* Bottom Controls Area */}
      <div className="aurora-car-player relative z-10 mx-auto flex w-full max-w-2xl flex-col gap-4 border-t border-zinc-800/80 bg-zinc-900 px-6 pt-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        {/* Scrubber / Progress Bar */}
        <div className="w-full space-y-1">
          <div className="relative flex items-center">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={effectiveTime}
              onChange={(e) => setSeekingValue(Number(e.target.value))}
              onMouseUp={() => {
                if (seekingValue !== null) {
                  seekTo(seekingValue);
                  setSeekingValue(null);
                }
              }}
              onTouchEnd={() => {
                if (seekingValue !== null) {
                  seekTo(seekingValue);
                  setSeekingValue(null);
                }
              }}
              className="h-3 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-emerald-500"
            />
          </div>
          <div className="flex justify-between px-0.5 text-sm font-bold text-zinc-400">
            <span>{formatSeconds(effectiveTime)}</span>
            <span>{formatSeconds(duration)}</span>
          </div>
        </div>

        {/* Giant Primary Buttons */}
        <div className="aurora-car-controls flex flex-col items-center gap-3 px-2 sm:px-6">
          <div className="flex w-full items-center justify-center gap-4">
            <button
            onClick={goToPrevious}
            className="flex size-16 items-center justify-center rounded-full border border-zinc-700/80 bg-zinc-800 text-white shadow-lg transition-transform hover:bg-zinc-700 active:scale-90 sm:size-18"
            title="Anterior"
          >
            <SkipBack size={32} />
            </button>

          {/* Play / Pause - HUGE */}
            <button
            onClick={playbackManager.toggle}
            className="flex size-20 items-center justify-center rounded-full bg-emerald-500 font-bold text-zinc-950 shadow-2xl shadow-emerald-500/30 transition-all hover:bg-emerald-400 active:scale-95 sm:size-24"
            title={isPlaying ? 'Pausa' : 'Reproducir'}
          >
            {isPlaying ? (
              <Pause size={44} className="fill-current" />
            ) : (
              <Play size={44} className="translate-x-0.5 fill-current" />
            )}
            </button>

          {/* Next Track */}
            <button
            onClick={goToNext}
            className="flex size-16 items-center justify-center rounded-full border border-zinc-700/80 bg-zinc-800 text-white shadow-lg transition-transform hover:bg-zinc-700 active:scale-90 sm:size-18"
            title="Siguiente"
          >
            <SkipForward size={32} />
            </button>
          </div>

          <div className="flex w-full items-center justify-center gap-5">
            <button
            onClick={handleToggleFavorite}
            className={`rounded-full p-3 transition-all active:scale-90 ${
              isFav
                ? 'border border-red-500/40 bg-red-950/60 text-red-500'
                : 'bg-zinc-800/60 text-zinc-400 hover:text-white'
            }`}
            title="Favorito"
          >
            <Heart size={24} className={isFav ? 'fill-current' : ''} />
            </button>

            <button
              onClick={() => setShuffleEnabled(!shuffleEnabled)}
              className={`rounded-full p-3 transition-all active:scale-90 ${
                shuffleEnabled
                  ? 'border border-emerald-500/40 bg-emerald-950/60 text-emerald-400'
                  : 'bg-zinc-800/60 text-zinc-400 hover:text-white'
              }`}
              title="Aleatorio"
            >
              <Shuffle size={24} />
            </button>

            <button
            onClick={handleDislike}
            className="rounded-full bg-zinc-800/60 p-3 text-zinc-400 transition-all hover:text-red-400 active:scale-90"
            title="No me gusta"
            aria-label="No me gusta esta canción"
            data-testid="car-mode-dislike-button"
          >
            <ThumbsDown size={24} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
