import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { httpHost } from '../../services/httpHost';
import { useQueueStore } from '../../stores/queueStore';
import { Podcasts } from './Podcasts';

vi.mock('../../services/httpHost', () => ({ httpHost: { fetch: vi.fn() } }));

it('opens episodes inside Aurora and queues their audio', async () => {
  vi.mocked(httpHost.fetch).mockImplementation(async (url) => ({
    status: 200,
    headers: {},
    body: JSON.stringify({
      results: url.includes('/lookup')
        ? [
            {
              kind: 'podcast-episode',
              trackId: 2,
              trackName: 'Episodio de prueba',
              episodeUrl: 'https://example.com/episode.mp3',
              trackTimeMillis: 60000,
            },
          ]
        : [{ collectionId: 1, collectionName: 'Todopoderosos' }],
    }),
  }));
  render(<Podcasts />);
  await userEvent.click(
    screen.getByRole('button', { name: /Open Todopoderosos/ }),
  );
  await userEvent.click(
    await screen.findByRole('button', {
      name: /Play Episodio de prueba/,
    }),
  );
  expect(useQueueStore.getState().getCurrentItem()?.track.source.url).toBe(
    'https://example.com/episode.mp3',
  );
  expect(screen.getByRole('button', { name: /Back to podcasts/ })).toBeInTheDocument();
});
