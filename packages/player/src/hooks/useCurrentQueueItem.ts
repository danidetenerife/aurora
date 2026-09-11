import type { QueueItem } from '@aurora/model';

import { useQueueStore } from '../stores/queueStore';

export const useCurrentQueueItem = (): QueueItem | undefined => {
  return useQueueStore((state) => state.getCurrentItem());
};
