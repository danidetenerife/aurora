import type { FC, PropsWithChildren } from 'react';
import { useCallback, useEffect, useMemo } from 'react';

import { LoggerProvider, Sound, SoundError } from '@aurora/hifi';
import type { TFunction } from '@aurora/i18n';
import { useTranslation } from '@aurora/i18n';
import type { Track } from '@aurora/model';

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

const extractYouTubeId = (track?: Track, srcUrl?: string): string | null => {
  if (srcUrl) {
    const match = srcUrl.match(
      /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/,
    );
    if (match?.[1]) {
      return match[1];
    }
  }
  const candidate = track?.streamCandidates?.find(
    (item) =>
      !item.failed && item.source?.id && /^[\w-]{11}$/.test(item.source.id),
  );
  if (candidate?.source?.id) {
    return candidate.source.id;
  }
  if (track?.source?.id && /^[\w-]{11}$/.test(track.source.id)) {
    return track.source.id;
  }
  return null;
};

export const TvSoundProvider: FC<PropsWithChildren> = ({ children }) => {
  const { t } = useTranslation('streaming');
  const { src, status, seek } = useSoundStore();
  const crossfadeMs = 0;
  const showVideo = useTvStore((state) => state.showVideo);
  const setShowVideo = useTvStore((state) => state.setShowVideo);
  const currentTrack = useQueueStore((state) => state.getCurrentItem()?.track);
  const mediaSource = useMemo(() => {
    if (src && /youtube\.com|youtu\.be/.test(src.url)) {
      return src;
    }
    const videoId = extractYouTubeId(currentTrack, src?.url);
    if (videoId) {
      return {
        url: `https://www.youtube.com/watch?v=${videoId}`,
        protocol: 'https' as const,
        startPositionSeconds: useSoundStore.getState().seek,
      };
    }
    return src;
  }, [src, currentTrack]);
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
