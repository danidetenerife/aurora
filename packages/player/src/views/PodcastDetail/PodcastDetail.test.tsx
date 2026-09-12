import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { httpHost } from '../../services/httpHost';
import { usePodcastStore } from '../../stores/podcastStore';
import { useQueueStore } from '../../stores/queueStore';
import { resetInMemoryTauriStore } from '../../test/utils/inMemoryTauriStore';
import { PodcastDetailWrapper } from './PodcastDetail.test-wrapper';

vi.mock('../../services/httpHost', () => ({
  httpHost: {
    fetch: vi.fn(),
  },
}));

describe('PodcastDetail view', () => {
  beforeEach(() => {
    resetInMemoryTauriStore();
    useQueueStore.setState({ items: [], currentIndex: 0 });
    usePodcastStore.setState({ favorites: [], loaded: true });

    vi.mocked(httpHost.fetch).mockImplementation(async (url) => {
      if (String(url).includes('youtubei/v1/browse')) {
        return {
          status: 200,
          headers: {},
          body: JSON.stringify({
            contents: {
              twoColumnBrowseResultsRenderer: {
                tabs: [
                  {
                    tabRenderer: {
                      content: {
                        sectionListRenderer: {
                          contents: [
                            {
                              musicResponsiveHeaderRenderer: {
                                title: { runs: [{ text: 'The Wild Project' }] },
                                straplineTextOne: { runs: [{ text: 'Jordi Wild' }] },
                                description: {
                                  musicDescriptionShelfRenderer: {
                                    description: { runs: [{ text: 'Podcast semanal' }] },
                                  },
                                },
                              },
                            },
                          ],
                        },
                      },
                    },
                  },
                ],
                secondaryContents: {
                  sectionListRenderer: {
                    contents: [
                      {
                        musicShelfRenderer: {
                          contents: [
                            {
                              musicMultiRowListItemRenderer: {
                                title: { runs: [{ text: 'Episodio 1: Bienvenida' }] },
                                subtitle: { runs: [{ text: '1 hora' }] },
                                onTap: {
                                  watchEndpoint: {
                                    videoId: 'video-ep-1',
                                  },
                                },
                              },
                            },
                            {
                              musicMultiRowListItemRenderer: {
                                title: { runs: [{ text: 'Episodio 2: Invitado especial' }] },
                                subtitle: { runs: [{ text: '2 horas' }] },
                                onTap: {
                                  watchEndpoint: {
                                    videoId: 'video-ep-2',
                                  },
                                },
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              },
            },
          }),
        };
      }

      return {
        status: 200,
        headers: {},
        body: JSON.stringify({ results: [] }),
      };
    });
  });

  it('renders podcast detail header and episodes list', async () => {
    await PodcastDetailWrapper.mount('MPSPPLzuFY9Ixj9Z4G5');

    expect(PodcastDetailWrapper.title).toHaveTextContent('The Wild Project');
    expect(screen.getAllByText('Jordi Wild').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Podcast semanal')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Episodio 1: Bienvenida')).toBeInTheDocument();
      expect(screen.getByText('Episodio 2: Invitado especial')).toBeInTheDocument();
    });
  });

  it('toggles favorite status when heart icon is clicked', async () => {
    await PodcastDetailWrapper.mount('MPSPPLzuFY9Ixj9Z4G5');

    expect(usePodcastStore.getState().favorites).toHaveLength(0);

    await PodcastDetailWrapper.favoriteButton.click();

    expect(usePodcastStore.getState().favorites).toHaveLength(1);
    expect(usePodcastStore.getState().favorites[0]?.name).toBe('The Wild Project');

    await PodcastDetailWrapper.favoriteButton.click();

    expect(usePodcastStore.getState().favorites).toHaveLength(0);
  });

  it('queues episodes when play button is clicked', async () => {
    await PodcastDetailWrapper.mount('MPSPPLzuFY9Ixj9Z4G5');

    await waitFor(() => {
      expect(PodcastDetailWrapper.playButton.element).toBeInTheDocument();
    });

    await PodcastDetailWrapper.playButton.click();

    const queueItems = useQueueStore.getState().items;
    expect(queueItems.length).toBeGreaterThan(0);
    expect(queueItems[0]?.track.title).toBe('Episodio 1: Bienvenida');
    expect(queueItems[0]?.track.source.id).toBe('video-ep-1');
  });
});
