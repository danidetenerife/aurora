import {
  Music,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  ThumbsDown,
  Video,
  VideoOff,
} from 'lucide-react';
import { FC } from 'react';

import { useTranslation } from '@aurora/i18n';
import { pickArtwork } from '@aurora/model';

import { eventBus } from '../../services/eventBus';
import { personalizationEngine } from '../../services/personalizationEngine';
import { playbackManager } from '../../services/playback';
import { useQueueStore } from '../../stores/queueStore';
import { useSoundStore } from '../../stores/soundStore';
import { useTvStore } from '../../stores/tvStore';
import { TvButton } from './TvButton';
import { playNextInInfiniteQueue } from './tvInfiniteQueue';

export const TvNowPlayingBar: FC = () => {
  const { t } = useTranslation('tv');
  const current = useQueueStore((state) => state.getCurrentItem());
  const status = useSoundStore((state) => state.status);
  const showVideo = useTvStore((state) => state.showVideo);
  const setShowVideo = useTvStore((state) => state.setShowVideo);
  const playing = status === 'playing';
  const artworkUrl = current
    ? pickArtwork(current.track.artwork ?? current.track.album?.artwork, 'thumbnail', 100)?.url
    : undefined;
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
      action: () => {
        const seek = useSoundStore.getState().seek;
        eventBus.emit('playbackSkipped', {
          positionMs: Math.round(seek * 1000),
        });
        void playNextInInfiniteQueue();
      },
    },
    {
      id: 'video',
      label: t(showVideo ? 'disableVideo' : 'enableVideo'),
      icon: showVideo ? <VideoOff /> : <Video />,
      action: () => setShowVideo(!showVideo),
    },
    {
      id: 'dislike',
      label: 'No me gusta',
      icon: <ThumbsDown />,
      action: () => {
        const track = current?.track;
        if (track) {
          const trackId = track.source?.id || `${track.artists?.[0]?.name}-${track.title}`;
          void personalizationEngine.blacklistTrack(trackId);
          void playNextInInfiniteQueue();
        }
      },
    },
  ];
  return (
    <footer data-testid="tv-now-playing-bar" className="tv-player">
      <div className="tv-track-info">
        {artworkUrl ? (
          <img src={artworkUrl} alt="" className="tv-player-art" referrerPolicy="no-referrer" />
        ) : (
          <Music className="tv-player-art" />
        )}
        <div className="tv-track-text">
          <strong>{current?.track.title ?? t('nothingPlaying')}</strong>
          <span>
            {current?.track.artists?.map((artist) => artist.name).join(', ')}
          </span>
          {current?.status === 'error' && (
            <span role="alert">{t('playbackError')}</span>
          )}
        </div>
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
