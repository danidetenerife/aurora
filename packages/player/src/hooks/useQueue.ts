import { useShallow } from 'zustand/react/shallow';

import type { Queue } from '@aurora/model';

import { useQueueStore } from '../stores/queueStore';

export const useQueue = (): Queue => {
  return useQueueStore(
    useShallow((state) => ({
      items: state.items,
      currentIndex: state.currentIndex,
    })),
  );
};
