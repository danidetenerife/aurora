import { Airplay, Car } from 'lucide-react';
import { FC } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useTranslation } from '@aurora/i18n';
import { RepeatMode } from '@aurora/plugin-sdk';
import { Button, PlayerBar, Tooltip } from '@aurora/ui';

import { useCoreSetting } from '../../hooks/useCoreSetting';
import { useMediaRouter } from '../../hooks/useMediaRouter';
import { playbackManager } from '../../services/playback';
import { useCarModeStore } from '../../stores/carModeStore';
import { useQueueStore } from '../../stores/queueStore';
import { useSoundStore } from '../../stores/soundStore';

export const ConnectedControls: FC = () => {
  const { t } = useTranslation('playerBar');
  const [shuffleEnabled, setShuffleEnabled] =
    useCoreSetting<boolean>('playback.shuffle');
  const [repeatMode, setRepeatMode] =
    useCoreSetting<RepeatMode>('playback.repeat');
  const { castState, openCastPicker } = useMediaRouter();

  const { goToNext, goToPrevious } = useQueueStore(
    useShallow((state) => ({
      goToNext: state.goToNext,
      goToPrevious: state.goToPrevious,
    })),
  );
  const status = useSoundStore((state) => state.status);

  const handleToggleShuffle = () => {
    setShuffleEnabled(!shuffleEnabled);
  };

  const handleToggleRepeat = () => {
    const modes: Array<RepeatMode> = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf(repeatMode ?? 'off');
    const nextIndex = (currentIndex + 1) % modes.length;
    setRepeatMode(modes[nextIndex]);
  };

  return (
    <div className="aurora-transport flex items-center gap-1">
      <PlayerBar.Controls
        className="aurora-playback-controls"
        isPlaying={status === 'playing'}
        isShuffleActive={Boolean(shuffleEnabled)}
        repeatMode={repeatMode ?? 'off'}
        onPlayPause={playbackManager.toggle}
        onNext={goToNext}
        onPrevious={goToPrevious}
        onShuffleToggle={handleToggleShuffle}
        onRepeatToggle={handleToggleRepeat}
        showDiscovery={false}
        labels={{
          shuffleOn: t('shuffleOn'),
          shuffleOff: t('shuffleOff'),
          repeatOff: t('repeatOff'),
          repeatAll: t('repeatAll'),
          repeatOne: t('repeatOne'),
        }}
      />
      <Tooltip
        wrapperClassName="aurora-cast-control"
        content={
          castState.isConnected
            ? `Cast: ${castState.connectedRouteName}`
            : 'Enviar a altavoz'
        }
        side="top"
      >
        <Button
          size="icon-sm"
          className="sm:size-10"
          variant={castState.isConnected ? 'default' : 'text'}
          onClick={openCastPicker}
          data-testid="player-cast-button"
        >
          <Airplay size={16} />
        </Button>
      </Tooltip>
      <Tooltip
        content="Modo Coche"
        side="top"
        wrapperClassName="aurora-car-control"
      >
        <Button
          size="icon-sm"
          className="sm:size-10"
          variant="text"
          onClick={() => useCarModeStore.getState().toggleCarMode()}
          data-testid="player-car-mode-button"
        >
          <Car size={16} />
        </Button>
      </Tooltip>
    </div>
  );
};
