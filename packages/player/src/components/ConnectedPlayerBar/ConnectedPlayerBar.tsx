import { FC } from 'react';

import { PlayerBar } from '@aurora/ui';

import { ConnectedControls } from './ConnectedControls';
import { ConnectedNowPlaying } from './ConnectedNowPlaying';
import { ConnectedSeekBar } from './ConnectedSeekBar';
import { ConnectedVolume } from './ConnectedVolume';

export const ConnectedPlayerBar: FC = () => {
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
