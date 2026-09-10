import type { Track } from '@nuclearplayer/model';

import { playbackManager } from '../../services/playback';
import { useQueueStore } from '../../stores/queueStore';

export const playTvTracks = (tracks: Track[]) => {
  if (!tracks.length) {
    return;
  }
  const queue = useQueueStore.getState();
  const firstNewIndex = queue.items.length;
  queue.addToQueue(tracks);
  useQueueStore.getState().goToIndex(firstNewIndex);
  playbackManager.play();
};
