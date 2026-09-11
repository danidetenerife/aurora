import type { Track } from '@aurora/model';

export const createMockTrack = (title: string): Track => ({
  title,
  artists: [{ name: 'Test Artist', roles: ['primary'] }],
  source: { provider: 'test', id: title.toLowerCase() },
});
