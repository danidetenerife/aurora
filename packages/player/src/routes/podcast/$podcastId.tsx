import { createFileRoute } from '@tanstack/react-router';

import { PodcastDetail } from '../../views/PodcastDetail';

export const Route = createFileRoute('/podcast/$podcastId')({
  component: PodcastDetail,
});
