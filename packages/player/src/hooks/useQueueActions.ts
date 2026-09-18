import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { Track } from '@aurora/model';

import { useQueueStore } from '../stores/queueStore';

export const useQueueActions = () => {
  const actions = useQueueStore(
    useShallow((state) => ({
      addToQueue: state.addToQueue,
      playTracks: state.playTracks,
      addNext: state.addNext,
      addAt: state.addAt,
      removeByIds: state.removeByIds,
      removeByIndices: state.removeByIndices,
      clearQueue: state.clearQueue,
      reorder: state.reorder,
      updateItemState: state.updateItemState,
      selectCandidate: state.selectCandidate,
      goToNext: state.goToNext,
      goToPrevious: state.goToPrevious,
      goToIndex: state.goToIndex,
      goToId: state.goToId,
    })),
  );

  const playNow = useCallback(
    (track: Track) => {
      actions.playTracks([track], 0);
    },
    [actions.playTracks],
  );

  return {
    ...actions,
    playNow,
  };
};
