import { useQuery } from '@tanstack/react-query';

import { type PodcastDetail, podcastService } from '../../../services/podcastService';

export const usePodcastDetail = (podcastId: string) => {
  return useQuery<PodcastDetail | null>({
    queryKey: ['podcast-detail', podcastId],
    queryFn: () => podcastService.getPodcastDetails(podcastId),
    enabled: Boolean(podcastId),
    staleTime: 300000,
  });
};
