import { useQuery } from '@tanstack/react-query';

import {
  podcastService,
  type PodcastDetail,
} from '../../../services/podcastService';

export const usePodcastDetail = (podcastId: string) => {
  return useQuery<PodcastDetail | null>({
    queryKey: ['podcast-detail', podcastId],
    queryFn: () => podcastService.getPodcastDetails(podcastId),
    enabled: Boolean(podcastId),
    staleTime: 300000,
  });
};
