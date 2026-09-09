import {
  FocusContext,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import {
  Music,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { FC, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useTranslation } from '@nuclearplayer/i18n';
import { pickArtwork } from '@nuclearplayer/model';
import { RepeatMode } from '@nuclearplayer/plugin-sdk';
import { cn } from '@nuclearplayer/ui';

import { useCoreSetting } from '../../hooks/useCoreSetting';
import { playbackManager } from '../../services/playback';
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

const TvControlButton: FC<{
  icon: React.ReactNode;
  focusKey: string;
  onPress: () => void;
  isActive?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label: string;
}> = ({ icon, focusKey, onPress, isActive = false, size = 'md', label }) => {
  const onEnterPress = useCallback(() => {
    onPress();
  }, [onPress]);

  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress,
  });

  const sizeClasses = {
    sm: 'size-11',
    md: 'size-14',
    lg: 'size-20',
  };

  return (
    <button
      ref={ref}
      onClick={onPress}
      onKeyDown={(event) => {
        if (
          event.key === 'Enter' ||
          event.key === ' ' ||
          event.keyCode === 23 ||
          event.keyCode === 13
        ) {
          event.preventDefault();
          onPress();
        }
      }}
      aria-label={label}
      data-focused={focused}
      className={cn(
        'flex cursor-pointer items-center justify-center rounded-full transition-all duration-150 outline-none',
        sizeClasses[size],
        size === 'lg'
          ? 'bg-primary hover:bg-primary/90 font-bold text-zinc-950 shadow-lg'
          : 'bg-zinc-800 text-white hover:bg-zinc-700',
        isActive && size !== 'lg' && 'text-primary bg-primary/20',
        focused &&
          size === 'lg' &&
          'shadow-primary/50 scale-125 shadow-2xl ring-4 ring-white',
        focused && size !== 'lg' && 'ring-primary scale-115 ring-4',
      )}
    >
      {icon}
    </button>
  );
};

export const TvNowPlayingBar: FC = () => {
  const { t } = useTranslation('tv');
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
  const isPlaying = status === 'playing';

  const [shuffleEnabled, setShuffleEnabled] =
    useCoreSetting<boolean>('playback.shuffle');
  const [repeatMode, setRepeatMode] =
    useCoreSetting<RepeatMode>('playback.repeat');

  const handleToggleRepeat = useCallback(() => {
    const modes: Array<RepeatMode> = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf(repeatMode ?? 'off');
    const nextIndex = (currentIndex + 1) % modes.length;
    setRepeatMode(modes[nextIndex]);
  }, [repeatMode, setRepeatMode]);

  const handleTogglePlay = useCallback(() => {
    const queue = useQueueStore.getState();
    const current = queue.getCurrentItem();
    if (!current && queue.items.length === 0) {
      const favorites = useFavoritesStore.getState().tracks;
      if (favorites.length > 0) {
        queue.addToQueue(favorites.map((fav) => fav.ref));
        playbackManager.play();
        return;
      }
    }
    playbackManager.toggle();
  }, []);

  const { ref, focusKey, focused } = useFocusable({
    focusKey: 'TV_NOW_PLAYING',
    trackChildren: true,
    saveLastFocusedChild: true,
    preferredChildFocusKey: 'tv-control-play',
  });

  const artwork = useMemo(() => {
    if (!currentTrack?.artwork) {
      return undefined;
    }
    return (
      pickArtwork(currentTrack.artwork, 'cover', 300) ??
      pickArtwork(currentTrack.artwork, 'thumbnail', 300)
    );
  }, [currentTrack]);

  const progressPercent =
    duration > 0 ? Math.min((seek / duration) * 100, 100) : 0;

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={ref}
        data-testid="tv-now-playing-bar"
        className={cn(
          'flex shrink-0 items-center justify-between gap-6 border-t border-zinc-800 bg-zinc-900/95 px-6 py-4 backdrop-blur-xl transition-all duration-200 select-none',
          focused && 'border-primary/50 shadow-primary/10 shadow-lg',
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="size-16 shrink-0 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800">
            {artwork?.url ? (
              <img
                src={artwork.url}
                alt={currentTrack?.title ?? ''}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-zinc-600">
                <Music size={28} />
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-base font-bold text-white">
              {currentTrack?.title ?? t('nothingPlaying')}
            </span>
            <span className="truncate text-sm text-zinc-400">
              {currentTrack?.artists?.[0]?.name ?? 'Aurora'}
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center gap-2">
          <div className="flex items-center gap-4">
            <TvControlButton
              icon={<Shuffle size={20} />}
              focusKey="tv-control-shuffle"
              onPress={() => setShuffleEnabled(!shuffleEnabled)}
              isActive={Boolean(shuffleEnabled)}
              size="sm"
              label="Shuffle"
            />
            <TvControlButton
              icon={<SkipBack size={24} />}
              focusKey="tv-control-prev"
              onPress={goToPrevious}
              size="md"
              label="Previous"
            />
            <TvControlButton
              icon={
                isPlaying ? (
                  <Pause size={32} className="fill-current" />
                ) : (
                  <Play size={32} className="translate-x-0.5 fill-current" />
                )
              }
              focusKey="tv-control-play"
              onPress={handleTogglePlay}
              size="lg"
              label={isPlaying ? 'Pause' : 'Play'}
            />
            <TvControlButton
              icon={<SkipForward size={24} />}
              focusKey="tv-control-next"
              onPress={goToNext}
              size="md"
              label="Next"
            />
            <TvControlButton
              icon={
                repeatMode === 'one' ? (
                  <Repeat1 size={20} />
                ) : (
                  <Repeat size={20} />
                )
              }
              focusKey="tv-control-repeat"
              onPress={handleToggleRepeat}
              isActive={repeatMode !== 'off'}
              size="sm"
              label="Repeat"
            />
          </div>

          <div className="flex w-full max-w-lg items-center gap-3">
            <span className="w-12 text-right font-mono text-xs text-zinc-400">
              {formatSeconds(seek)}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="bg-primary h-full rounded-full transition-[width] duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="w-12 font-mono text-xs text-zinc-400">
              {formatSeconds(duration)}
            </span>
          </div>
        </div>

        <div className="flex flex-1 justify-end" />
      </div>
    </FocusContext.Provider>
  );
};
