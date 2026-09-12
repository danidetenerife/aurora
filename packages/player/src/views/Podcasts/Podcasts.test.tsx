import { createMemoryHistory, createRouter } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../../App';
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

const mountPodcasts = async () => {
  const history = createMemoryHistory({
    initialEntries: ['/podcasts'],
  });
  const router = createRouter({ routeTree, history });
  const component = render(<App routerProp={router} />);
  await screen.findByTestId('podcasts-view');
  return { component, history };
};

describe('Podcasts view', () => {
  beforeEach(() => {
    resetInMemoryTauriStore();
    usePodcastStore.setState({ favorites: [], loaded: true });
    vi.mocked(httpHost.fetch).mockResolvedValue({
      status: 200,
      headers: {},
      body: JSON.stringify({ contents: {} }),
    });
  });

  it('(Snapshot) renders podcasts list', async () => {
    const { component } = await mountPodcasts();
    expect(component.asFragment()).toMatchSnapshot();
  });

  it('renders available podcasts from the catalog', async () => {
    await mountPodcasts();
    expect(await screen.findByText('The Wild Project')).toBeInTheDocument();
    expect(await screen.findByText('Terrores Criminales')).toBeInTheDocument();
  });

  it('navigates to podcast detail when clicking a podcast card', async () => {
    const { history } = await mountPodcasts();
    const podcastButton = screen.getByRole('button', {
      name: /Open The Wild Project/i,
    });
    await user.click(podcastButton);
    expect(history.location.pathname).toBe(
      '/podcast/MPSPPLzuFY9Ixj9Z4G5-eRHblrmwMOY7tLUCHi',
    );
  });

  it('toggles favorite when clicking heart button', async () => {
    await mountPodcasts();
    const favoriteButton = screen.getAllByRole('button', {
      name: /Add to favorites/i,
    })[0];
    await user.click(favoriteButton);
    expect(usePodcastStore.getState().favorites.length).toBe(1);
    expect(usePodcastStore.getState().favorites[0].name).toBe(
      'The Wild Project',
    );
  });
});
