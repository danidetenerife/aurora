import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, createRouter } from '@tanstack/react-router';
import {
  fireEvent,
  render,
  RenderResult,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { QueueItem, Track } from '@aurora/model';

import App from '../../App';
import { routeTree } from '../../routeTree.gen';
import { useQueueStore } from '../../stores/queueStore';
import { useSettingsStore } from '../../stores/settingsStore';

const user = userEvent.setup();

const defaultTrack: Track = {
  title: 'Test Track',
  artists: [
    {
      name: 'Test Artist',
      roles: [],
      source: { provider: 'test', id: 'a1' },
    },
  ],
  source: { provider: 'test', id: 't1' },
};

class QueueItemBuilder {
  private item: QueueItem;

  constructor() {
    this.item = {
      id: 'qi-1',
      track: { ...defaultTrack },
      status: 'success',
      addedAtIso: new Date().toISOString(),
    };
  }

  withId(id: string) {
    this.item.id = id;
    return this;
  }

  withTrack(track: Track) {
    this.item.track = track;
    return this;
  }

  withTitle(title: string) {
    this.item.track.title = title;
    return this;
  }

  withArtist(name: string) {
    this.item.track.artists = [
      { name, roles: [], source: { provider: 'test', id: 'a1' } },
    ];
    return this;
  }

  withArtistSource(provider: string, id: string) {
    const [artist] = this.item.track.artists;
    this.item.track.artists = [{ ...artist, source: { provider, id } }];
    return this;
  }

  withoutArtistSource() {
    const [artist] = this.item.track.artists;
    this.item.track.artists = [{ name: artist.name, roles: artist.roles }];
    return this;
  }

  withAlbum(title: string, provider: string, id: string) {
    this.item.track.album = {
      title,
      source: { provider, id },
    };
    return this;
  }

  withArtwork(url: string) {
    this.item.track.artwork = {
      items: [{ url }],
    };
    return this;
  }

  withStatus(status: QueueItem['status']) {
    this.item.status = status;
    return this;
  }

  build(): QueueItem {
    return structuredClone(this.item);
  }
}

type MountResult = RenderResult & {
  router: ReturnType<typeof createRouter<typeof routeTree>>;
};

export const ConnectedPlayerBarWrapper = {
  QueueItemBuilder,

  // Explicit return type is required here to avoid the "The inferred type of 'ConnectedPlayerBarWrapper' cannot be named without a reference to" error
  async mount(): Promise<MountResult> {
    const history = createMemoryHistory({ initialEntries: ['/dashboard'] });
    const router = createRouter({ routeTree, history });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const component = render(
      <App routerProp={router} queryClientProp={queryClient} />,
    );
    await screen.findByTestId('dashboard-view');
    return { ...component, router };
  },

  seedQueueItem(item: QueueItem) {
    useQueueStore.setState({
      items: [item],
      currentIndex: 0,
    });
  },

  seedVolume(volume01: number) {
    useSettingsStore.setState({
      values: { 'core.playback.volume': volume01 },
    });
  },

  seedShuffle(enabled: boolean) {
    useSettingsStore.setState({
      values: {
        ...useSettingsStore.getState().values,
        'core.playback.shuffle': enabled,
      },
    });
  },

  seedRepeatMode(mode: 'off' | 'all' | 'one') {
    useSettingsStore.setState({
      values: {
        ...useSettingsStore.getState().values,
        'core.playback.repeat': mode,
      },
    });
  },

  nowPlaying: {
    title(text: string) {
      return within(screen.getByTestId('now-playing-title')).getByText(text);
    },
    artist(text: string) {
      return within(screen.getByTestId('player-now-playing-artist')).getByText(
        text,
      );
    },
    get thumbnail() {
      return screen.queryByTestId('player-now-playing-thumbnail');
    },
    get placeholder() {
      return screen.queryByTestId('player-now-playing-placeholder');
    },
    async clickTitle() {
      await user.click(screen.getByTestId('now-playing-title'));
    },
    async clickArtist() {
      await user.click(screen.getByTestId('player-now-playing-artist'));
    },
    dislikeButton: {
      get element() {
        return screen.getByTestId('now-playing-dislike-button');
      },
      async click() {
        await user.click(this.element);
      },
    },
  },

  controls: {
    get videoButtons() {
      return screen.queryAllByTestId('player-video-button');
    },
    shuffleButton: {
      get element() {
        return screen.getByTestId('player-shuffle-button');
      },
      async click() {
        await user.click(this.element);
      },
    },
    repeatButton: {
      get element() {
        return screen.getByTestId('player-repeat-button');
      },
      async click() {
        await user.click(this.element);
      },
    },
    discoveryButton: {
      get element() {
        return screen.queryByTestId('player-discovery-button');
      },
      async click() {
        if (this.element) {
          await user.click(this.element);
        }
      },
    },
  },

  volume: {
    get slider() {
      return screen.getByTestId('player-volume-slider');
    },
    get rangeInput() {
      return within(this.slider).getByRole('slider');
    },
    async changeValue(value: number) {
      fireEvent.change(this.rangeInput, { target: { value: String(value) } });
    },
  },

  mobileExpanded: {
    get container() {
      return screen.queryByTestId('mobile-expanded-player');
    },
    get ambientBg() {
      return screen.queryByTestId('expanded-player-ambient-bg');
    },
    get drivingToggle() {
      return screen.getByTestId('expanded-player-driving-toggle');
    },
    get drivingDislikeButton() {
      return screen.queryByTestId('driving-dislike-button');
    },
    get drivingFavoriteButton() {
      return screen.queryByTestId('driving-favorite-button');
    },
    get upNextCard() {
      return screen.queryByTestId('expanded-player-up-next');
    },
    get artworkGestureZone() {
      return screen.getByTestId('expanded-player-artwork-gesture-zone');
    },
    get heartBurst() {
      return screen.queryByTestId('expanded-player-heart-burst');
    },
    async clickDrivingToggle() {
      await user.click(this.drivingToggle);
    },
    async clickUpNext() {
      if (this.upNextCard) {
        await user.click(this.upNextCard);
      }
    },
    swipeLeftArtwork() {
      const startX = 220;
      const endX = 80;
      const fixedY = 200;
      fireEvent.touchStart(this.artworkGestureZone, {
        touches: [{ clientX: startX, clientY: fixedY }],
      });
      fireEvent.touchEnd(this.artworkGestureZone, {
        changedTouches: [{ clientX: endX, clientY: fixedY }],
      });
    },
  },
};
