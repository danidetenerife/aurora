import { FC, useEffect, useState } from 'react';

import { PlayerBar } from '@aurora/ui';

import { useCoreSetting } from '../../hooks/useCoreSetting';

export const ConnectedVolume: FC = () => {
  const [volume, setVolume] = useCoreSetting<number>('playback.volume');
  const [localVolume, setLocalVolume] = useState<number | null>(null);

  useEffect(() => {
    setLocalVolume(null);
  }, [volume]);

  const handleVolumeChange = (value: number) => {
    setLocalVolume(value);
    setVolume(value / 100);
  };

  const currentVolume =
    localVolume !== null ? localVolume : Math.round((volume ?? 1) * 100);

  return (
    <PlayerBar.Volume
      value={currentVolume}
      onValueChange={handleVolumeChange}
    />
  );
};
