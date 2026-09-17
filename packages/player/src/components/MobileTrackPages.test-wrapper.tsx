import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render, RenderResult, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import type { Track } from '@aurora/model';

import { useQueueStore } from '../stores/queueStore';
import { MobileTrackPages } from './MobileTrackPages';

const getUser = () =>
  vi.isFakeTimers()
    ? userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    : userEvent.setup();

const createFakeTouchEvent = (
  type: string,
  clientX: number,
  clientY: number,
) => {
  const event = new CustomEvent(type, {
    bubbles: true,
    cancelable: true,
  }) as unknown as TouchEvent;
  const touch = { clientX, clientY, identifier: 0 };
  Object.defineProperty(event, 'touches', { value: [touch] });
  Object.defineProperty(event, 'changedTouches', { value: [touch] });
  return event;
};

export const MobileTrackPagesWrapper = {
  async mount(tracks: Track[], initialCapacity = 3): Promise<RenderResult> {
    const root = createRootRoute();
    const home = createRoute({
      getParentRoute: () => root,
      path: '/',
      component: () => (
        <MobileTrackPages tracks={tracks} initialCapacity={initialCapacity} />
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

    const rendered = render(<RouterProvider router={router} />);
    await screen.findByTestId('mobile-track-pages');
    return rendered;
  },

  setPlayingTrack(track: Track, index = 0) {
    act(() => {
      useQueueStore.setState({
        items: [
          {
            id: `item-${index}`,
            track,
            status: 'idle',
            addedAtIso: new Date().toISOString(),
          },
        ],
        currentIndex: index,
      });
    });
  },

  setQueue(tracks: Track[], currentIndex = 0) {
    act(() => {
      useQueueStore.setState({
        items: tracks.map((track, i) => ({
          id: `queue-${i}`,
          track,
          status: 'idle',
          addedAtIso: new Date().toISOString(),
        })),
        currentIndex,
      });
    });
  },

  advanceQueue(newIndex: number) {
    act(() => {
      useQueueStore.setState({ currentIndex: newIndex });
    });
  },

  get container() {
    return screen.getByTestId('mobile-track-pages');
  },

  get rowsContainer() {
    return screen.getByTestId('mobile-track-rows-container');
  },

  get indicator() {
    return screen.getByTestId('pagination-indicator');
  },

  get indicatorText() {
    return this.indicator.textContent ?? '';
  },

  get trackRows() {
    return screen.getAllByTestId('track-row');
  },

  get activeTrackRow() {
    const rows = screen.getAllByTestId('track-row');
    return rows.find((row) => row.getAttribute('data-active-track') === 'true');
  },

  prevButton: {
    get element() {
      return screen.getByTestId('pagination-prev-button');
    },
    get isDisabled() {
      return this.element.hasAttribute('disabled');
    },
    async click() {
      await getUser().click(this.element);
    },
  },

  nextButton: {
    get element() {
      return screen.getByTestId('pagination-next-button');
    },
    get isDisabled() {
      return this.element.hasAttribute('disabled');
    },
    async click() {
      await getUser().click(this.element);
    },
  },

  syncButton: {
    get element() {
      return screen.getByTestId('sync-now-playing-button');
    },
    async click() {
      await getUser().click(this.element);
    },
  },

  swipeLeft() {
    const container = this.rowsContainer;
    act(() => {
      container.dispatchEvent(createFakeTouchEvent('touchstart', 200, 100));
      container.dispatchEvent(createFakeTouchEvent('touchend', 50, 100));
    });
  },

  swipeRight() {
    const container = this.rowsContainer;
    act(() => {
      container.dispatchEvent(createFakeTouchEvent('touchstart', 50, 100));
      container.dispatchEvent(createFakeTouchEvent('touchend', 200, 100));
    });
  },
};
