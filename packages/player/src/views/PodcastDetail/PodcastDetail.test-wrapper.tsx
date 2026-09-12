import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, createRouter } from '@tanstack/react-router';
import { render, type RenderResult, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../../App';
import { routeTree } from '../../routeTree.gen';

const user = userEvent.setup();

export const PodcastDetailWrapper = {
  async mount(podcastId: string): Promise<RenderResult> {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const history = createMemoryHistory({
      initialEntries: [`/podcast/${podcastId}`],
    });
    const router = createRouter({ routeTree, history });
    const component = render(
      <App queryClientProp={queryClient} routerProp={router} />,
    );
    await screen.findByTestId('podcast-detail-view');
    return component;
  },

  get title() {
    return screen.getByRole('heading', { level: 1 });
  },

  get trackRows() {
    return screen.queryAllByTestId('track-row');
  },

  playButton: {
    get element() {
      return screen.queryByTestId('podcast-play-button');
    },
    async click() {
      const button = screen.getByTestId('podcast-play-button');
      await user.click(button);
    },
  },

  favoriteButton: {
    get element() {
      return screen.getByTestId('podcast-favorite-button');
    },
    async click() {
      const button = screen.getByTestId('podcast-favorite-button');
      await user.click(button);
    },
  },

  backButton: {
    get element() {
      return screen.getByTestId('podcast-back-button');
    },
    async click() {
      const button = screen.getByTestId('podcast-back-button');
      await user.click(button);
    },
  },
};
