import { FC } from 'react';

import { PlayerBar } from '@aurora/ui';

import { isCapacitorEnvironment } from '../../services/universalStore';

import './mobile-player.css';

import { ConnectedControls } from './ConnectedControls';
import { ConnectedNowPlaying } from './ConnectedNowPlaying';
import { ConnectedSeekBar } from './ConnectedSeekBar';
import { ConnectedVolume } from './ConnectedVolume';

export const ConnectedPlayerBar: FC = () => {
  if (isCapacitorEnvironment()) {
    return (
      <>
        <ConnectedSeekBar />
        <div className="mobile-player-panel">
          <ConnectedNowPlaying hideActions />
          <div className="mobile-player-buttons">
            <ConnectedNowPlaying actionsOnly />
            <ConnectedControls />
          </div>
        </div>
      </>
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
