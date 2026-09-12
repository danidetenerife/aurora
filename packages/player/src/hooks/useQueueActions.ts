import { useCallback } from 'react';

import type { Track } from '@aurora/model';

import { useQueueStore } from '../stores/queueStore';

// You can't replace this with lodash pick because it causes infinite re-renders
export const useQueueActions = () => {
  const {
    addToQueue,
    playTracks,
    addNext,
    addAt,
    removeByIds,
    removeByIndices,
    clearQueue,
    reorder,
    updateItemState,
    selectCandidate,
    goToNext,
    goToPrevious,
    goToIndex,
    goToId,
  } = useQueueStore();

  const playNow = useCallback(
    (track: Track) => {
      playTracks([track], 0);
    },
    [playTracks],
  );

  return {
    addToQueue,
    playTracks,
    addNext,
    addAt,
    removeByIds,
    removeByIndices,
    clearQueue,
    reorder,
    updateItemState,
    selectCandidate,
    goToNext,
    goToPrevious,
    goToIndex,
    goToId,
    playNow,
  };
};
