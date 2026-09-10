import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Video,
  VideoOff,
} from 'lucide-react';
import { FC } from 'react';

import { useTranslation } from '@nuclearplayer/i18n';

import { playbackManager } from '../../services/playback';
import { useQueueStore } from '../../stores/queueStore';
import { useSoundStore } from '../../stores/soundStore';
import { useTvStore } from '../../stores/tvStore';
import { TvButton } from './TvButton';

export const TvNowPlayingBar: FC = () => {
  const { t } = useTranslation('tv');
  const current = useQueueStore((state) => state.getCurrentItem());
  const status = useSoundStore((state) => state.status);
  const showVideo = useTvStore((state) => state.showVideo);
  const setShowVideo = useTvStore((state) => state.setShowVideo);
  const playing = status === 'playing';
  const controls = [
    {
      id: 'prev',
      label: t('previous'),
      icon: <SkipBack />,
      action: () => useQueueStore.getState().goToPrevious(),
    },
    {
      id: 'play',
      label: t(playing ? 'pause' : 'play'),
      icon: playing ? <Pause /> : <Play />,
      action: () => {
        if (!current) {
          useTvStore.getState().openSearch();
          return;
        }
        playbackManager.toggle();
      },
    },
    {
      id: 'next',
      label: t('next'),
      icon: <SkipForward />,
      action: () => useQueueStore.getState().goToNext(),
    },
    {
      id: 'video',
      label: t(showVideo ? 'disableVideo' : 'enableVideo'),
      icon: showVideo ? <VideoOff /> : <Video />,
      action: () => setShowVideo(!showVideo),
    },
  ];
  return (
    <footer data-testid="tv-now-playing-bar" className="tv-player">
      <div className="tv-track-info">
        <strong>{current?.track.title ?? t('nothingPlaying')}</strong>
        <span>
          {current?.track.artists?.map((artist) => artist.name).join(', ')}
        </span>
        {current?.status === 'error' && (
          <span role="alert">{t('playbackError')}</span>
        )}
      </div>
      <div className="tv-controls">
        {controls.map((control, index) => (
          <TvButton
            key={control.id}
            focusKey={`tv-control-${control.id}`}
            onClick={control.action}
            aria-label={control.label}
            aria-pressed={
              control.id === 'video' ? Boolean(showVideo) : undefined
            }
            destinations={{
              left: `tv-control-${controls[Math.max(0, index - 1)].id}`,
              right: `tv-control-${controls[Math.min(controls.length - 1, index + 1)].id}`,
              up: 'TV_CONTENT',
              down: 'tv-nav-dashboard',
            }}
          >
            {control.icon}
            <span>{control.label}</span>
          </TvButton>
        ))}
      </div>
    </footer>
  );
};
