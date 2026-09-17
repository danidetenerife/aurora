import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, createRouter } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App, { defaultQueryClient } from '../../App';
import { routeTree } from '../../routeTree.gen';
import { httpHost } from '../../services/httpHost';
import { usePodcastStore } from '../../stores/podcastStore';
import { resetInMemoryTauriStore } from '../../test/utils/inMemoryTauriStore';

vi.mock('../../services/httpHost', () => ({
  httpHost: {
    fetch: vi.fn(),
  },
}));

const user = userEvent.setup();

const mockYtmPodcastPayload = (
  podcasts: Array<{ id: string; name: string; publisher: string }>,
) => ({
  contents: {
    tabbedSearchResultsRenderer: {
      tabs: [
        {
          tabRenderer: {
            content: {
              sectionListRenderer: {
                contents: [
                  {
                    musicShelfRenderer: {
                      contents: podcasts.map((podcast) => ({
                        musicResponsiveListItemRenderer: {
                          navigationEndpoint: {
                            browseEndpoint: { browseId: podcast.id },
                          },
                          flexColumns: [
                            {
                              musicResponsiveListItemFlexColumnRenderer: {
                                text: { runs: [{ text: podcast.name }] },
                              },
                            },
                            {
                              musicResponsiveListItemFlexColumnRenderer: {
                                text: { runs: [{ text: podcast.publisher }] },
                              },
                            },
                          ],
                        },
                      })),
                    },
                  },
                ],
              },
            },
          },
        },
      ],
    },
  },
});

const TEST_PODCASTS = [
  {
    id: 'MPSPPLzuFY9Ixj9Z4G5-eRHblrmwMOY7tLUCHi',
    name: 'The Wild Project',
    publisher: 'Jordi Wild',
  },
  {
    id: 'MPSPPLlDZ74Qz5KgziPV5gTjd5QDsey1znyS_d',
    name: 'Terrores Criminales',
    publisher: 'Terrores Nocturnos Podcast',
  },
];

const mountPodcasts = async () => {
  const history = createMemoryHistory({
    initialEntries: ['/podcasts'],
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createRouter({ routeTree, history });
  const component = render(
    <App queryClientProp={queryClient} routerProp={router} />,
  );
  await screen.findByTestId('podcasts-view');
  return { component, history, queryClient };
};

describe('Podcasts view', () => {
  beforeEach(() => {
    resetInMemoryTauriStore();
    defaultQueryClient.clear();
    usePodcastStore.setState({ favorites: [], loaded: true });
    vi.mocked(httpHost.fetch).mockResolvedValue({
      status: 200,
      headers: {},
      body: JSON.stringify(mockYtmPodcastPayload(TEST_PODCASTS)),
    });
  });

  it('(Snapshot) renders podcasts list', async () => {
    const { component } = await mountPodcasts();
    await screen.findByText('The Wild Project');
    expect(component.asFragment()).toMatchSnapshot();
  });

  it('renders available podcasts from the catalog', async () => {
    await mountPodcasts();
    expect(await screen.findByText('The Wild Project')).toBeInTheDocument();
    expect(await screen.findByText('Terrores Criminales')).toBeInTheDocument();
  });

  it('navigates to podcast detail when clicking a podcast card', async () => {
    const { history } = await mountPodcasts();
    const podcastButton = await screen.findByRole('button', {
      name: /Open The Wild Project/i,
    });
    await user.click(podcastButton);
    expect(history.location.pathname).toBe(
      '/podcast/MPSPPLzuFY9Ixj9Z4G5-eRHblrmwMOY7tLUCHi',
    );
  });

  it('toggles favorite when clicking heart button', async () => {
    await mountPodcasts();
    await screen.findByText('The Wild Project');
    const favoriteButton = screen.getAllByRole('button', {
      name: /Add to favorites/i,
    })[0];
    await user.click(favoriteButton);
    expect(usePodcastStore.getState().favorites.length).toBe(1);
    expect(usePodcastStore.getState().favorites[0].name).toBe(
      'The Wild Project',
    );
  });

  it('renders empty state when no podcasts are returned', async () => {
    vi.mocked(httpHost.fetch).mockResolvedValue({
      status: 200,
      headers: {},
      body: JSON.stringify({ contents: {} }),
    });
    await mountPodcasts();
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
  });
});
