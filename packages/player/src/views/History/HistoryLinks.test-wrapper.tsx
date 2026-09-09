import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { providersHost } from '../../services/providersHost';
import { useQueueStore } from '../../stores/queueStore';
import { MetadataProviderBuilder } from '../../test/builders/MetadataProviderBuilder';
import { HistoryArtistLinks, HistoryLink } from './components/HistoryLink';

export const HistoryLinksWrapper = {
  async mount() {
    useQueueStore.setState({ items: [], currentIndex: 0 });
    providersHost.register(
      new MetadataProviderBuilder()
        .withSearchCapabilities(['unified'])
        .withSearch(async () => ({
          artists: [
            {
              name: 'Ilegales',
              source: { provider: 'test-metadata-provider', id: 'artist-id' },
            },
          ],
          albums: [
            {
              title: 'Singles',
              artists: [{ name: 'Ilegales' }],
              source: { provider: 'test-metadata-provider', id: 'album-id' },
            },
          ],
          tracks: [
            {
              title: 'Amor Total',
              artists: [{ name: 'Ilegales', roles: [] }],
              source: { provider: 'test-metadata-provider', id: 'track-id' },
            },
          ],
        }))
        .build(),
    );
    const root = createRootRoute();
    const home = createRoute({
      getParentRoute: () => root,
      path: '/',
      component: () => (
        <>
          <HistoryLink kind="track" name="Amor Total" artists={['Ilegales']} />
          <HistoryLink kind="album" name="Singles" artists={['Ilegales']} />
          <HistoryArtistLinks artists={['Ilegales', 'Emmanuel']} />
        </>
      ),
    });
    const artist = createRoute({
      getParentRoute: () => root,
      path: '/artist/$providerId/$artistId',
      component: () => <div>Artist page</div>,
    });
    const album = createRoute({
      getParentRoute: () => root,
      path: '/album/$providerId/$albumId',
      component: () => <div>Album page</div>,
    });
    const router = createRouter({
      routeTree: root.addChildren([home, artist, album]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
    });
    render(<RouterProvider router={router} />);
    await screen.findByRole('button', { name: 'Amor Total' });
    return router;
  },
  async click(name: string) {
    await userEvent.click(screen.getByRole('button', { name }));
  },
  get currentTrack() {
    return useQueueStore.getState().getCurrentItem()?.track;
  },
  get artistPage() {
    return screen.findByText('Artist page');
  },
  get albumPage() {
    return screen.findByText('Album page');
  },
};
