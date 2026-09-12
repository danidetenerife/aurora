import { createFileRoute } from '@tanstack/react-router';

import { Podcasts } from '../views/Podcasts/Podcasts';

export const Route = createFileRoute('/podcasts')({ component: Podcasts });
