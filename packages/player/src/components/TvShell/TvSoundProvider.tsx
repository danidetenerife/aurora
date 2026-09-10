import type { FC, PropsWithChildren } from 'react';
import { useCallback, useEffect, useMemo } from 'react';

import { LoggerProvider, Sound, SoundError } from '@nuclearplayer/hifi';
import type { TFunction } from '@nuclearplayer/i18n';
import { useTranslation } from '@nuclearplayer/i18n';

import { useCoreSetting } from '../../hooks/useCoreSetting';
import { eventBus } from '../../services/eventBus';
import { Logger } from '../../services/logger';
import { playbackManager } from '../../services/playback';
import { useQueueStore } from '../../stores/queueStore';
import { useSoundStore } from '../../stores/soundStore';
import { useTvStore } from '../../stores/tvStore';
import { errorMessage } from '../../utils/errorMessage';

const describePlaybackError = (error: Error, t: TFunction): string => {
  if (error instanceof SoundError) {
    return t(`errors.hifi.${error.code}`, { details: error.details });
  }
  return errorMessage(error);
};

export const TvSoundProvider: FC<PropsWithChildren> = ({ children }) => {
  const { t } = useTranslation('streaming');
  const { src, status, seek } = useSoundStore();
  const crossfadeMs = 0;
  const showVideo = useTvStore((state) => state.showVideo);
  const setShowVideo = useTvStore((state) => state.setShowVideo);
  const currentTrack = useQueueStore((state) => state.getCurrentItem()?.track);
  const mediaSource = useMemo(() => {
    if (!src || !showVideo || /youtube\.com|youtu\.be/.test(src.url)) {
      return src;
    }
    const candidate = currentTrack?.streamCandidates?.find(
      (item) => !item.failed && item.stream,
    );
    const source = candidate?.source ?? currentTrack?.source;
    if (
      !source ||
      !/youtube/i.test(source.provider) ||
      !/^[\w-]{11}$/.test(source.id)
    ) {
      return src;
    }
    return {
      url: `https://www.youtube.com/watch?v=${source.id}`,
      protocol: 'https' as const,
      startPositionSeconds: useSoundStore.getState().seek,
    };
  }, [src, showVideo, currentTrack]);
  const preload: HTMLAudioElement['preload'] = 'auto';
  const crossOrigin = undefined;
  const [volume01] = useCoreSetting<number>('playback.volume');
  const [muted] = useCoreSetting<boolean>('playback.muted');
  const volumePercent = muted ? 0 : Math.round((volume01 ?? 1) * 100);

  useEffect(() => {
    LoggerProvider.init(Logger.streaming);
  }, []);

  useEffect(() => {
    if (crossfadeMs !== undefined) {
      useSoundStore.getState().setCrossfadeMs(crossfadeMs);
    }
  }, [crossfadeMs]);

  const handleTimeUpdate = useCallback(
    ({ position, duration }: { position: number; duration: number }) => {
      useSoundStore.getState().updatePlayback(position, duration);
    },
    [],
  );

  const handleEnd = useCallback(() => {
    playbackManager.finishTrack();
  }, []);

  const handleCanPlay = useCallback(() => {
    const currentItem = useQueueStore.getState().getCurrentItem();
    if (currentItem) {
      useQueueStore
        .getState()
        .updateItemState(currentItem.id, { status: 'success' });
    }
  }, []);

  const handleSourceInvalid = useCallback(() => {
    const currentTrack = useQueueStore.getState().getCurrentItem()?.track;
    if (currentTrack) {
      eventBus.emit('streamSourceInvalid', currentTrack);
    }
  }, []);

  const handleError = useCallback(
    (error: Error) => {
      const message = describePlaybackError(error, t);
      Logger.streaming.error(`Playback error: ${message}`);

      const currentItem = useQueueStore.getState().getCurrentItem();
      if (currentItem) {
        useQueueStore
          .getState()
          .updateItemState(currentItem.id, { status: 'error', error: message });
      }
    },
    [t],
  );

  return (
    <>
      {mediaSource && (
        <Sound
          src={mediaSource}
          status={status}
          seek={seek}
          showVideo={Boolean(showVideo)}
          onCloseVideo={() => setShowVideo(false)}
          volume={volumePercent}
          preload={preload}
          crossOrigin={crossOrigin}
          onTimeUpdate={handleTimeUpdate}
          onEnd={handleEnd}
          onCanPlay={handleCanPlay}
          onError={handleError}
          onSourceInvalid={handleSourceInvalid}
        />
      )}
      {children}
    </>
  );
};
