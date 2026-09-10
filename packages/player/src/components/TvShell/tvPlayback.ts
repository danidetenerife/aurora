import type { Track } from '@nuclearplayer/model';

import { playbackManager } from '../../services/playback';
import { streamResolution } from '../../services/streamResolution';
import { useQueueStore } from '../../stores/queueStore';

export const playTvTracks = (tracks: Track[], startIndex = 0) => {
  if (!tracks.length) {
    return;
  }
  const queue = useQueueStore.getState();
  queue.clearQueue();
  queue.addToQueue(tracks);
  if (startIndex > 0 && startIndex < tracks.length) {
    queue.goToIndex(startIndex);
  }
  const currentItem = useQueueStore.getState().getCurrentItem();
  if (currentItem) {
    void streamResolution.resolve(currentItem, { autoPlay: true });
  } else {
    playbackManager.play();
  }
};
