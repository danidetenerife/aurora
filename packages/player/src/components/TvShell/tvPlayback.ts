import type { Track } from '@aurora/model';

import { registerTrackInSet } from '../../services/discoveryService';
import { playbackManager } from '../../services/playback';
import { streamResolution } from '../../services/streamResolution';
import { useQueueStore } from '../../stores/queueStore';
import { replenishTvQueue, resetTvSession } from './tvInfiniteQueue';

const AUTO_REPLENISH_THRESHOLD = 5;

export const playTvTracks = (tracks: Track[], startIndex = 0) => {
  if (!tracks.length) {
    return;
  }

  resetTvSession();

  const queue = useQueueStore.getState();
  queue.playTracks(tracks, startIndex);

  const sessionPlayedIds = new Set<string>();
  for (const track of tracks) {
    registerTrackInSet(track, sessionPlayedIds);
  }

  const currentItem = useQueueStore.getState().getCurrentItem();
  if (currentItem) {
    void streamResolution.resolve(currentItem, { autoPlay: true });
  } else {
    playbackManager.play();
  }

  if (tracks.length <= AUTO_REPLENISH_THRESHOLD) {
    void replenishTvQueue();
  }
};
