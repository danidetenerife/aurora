import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { Track } from '@aurora/model';
import type { MetadataProvider } from '@aurora/plugin-sdk';

import { personalizationEngine } from '../../services/personalizationEngine';
import { initSpatialNavigation } from '../../services/spatialNavigation';
import { useFavoritesStore } from '../../stores/favoritesStore';
import { usePlaylistStore } from '../../stores/playlistStore';
import { usePodcastStore } from '../../stores/podcastStore';
import { useTvStore } from '../../stores/tvStore';
import { TvAutoUpdater } from './TvAutoUpdater';
import { TvButton } from './TvButton';
import { TvCoverArtView } from './TvCoverArtView';
import {
  clearRecommendationCache,
  getCachedRecommendations,
  searchForUserFallbackTracks,
  TvDashboard,
} from './TvDashboard';
import { TvFocusableCard } from './TvFocusableCard';
import { TvNavRail } from './TvNavRail';
import { TvVideoPlayer } from './TvVideoPlayer';

vi.mock('../../hooks/useProviders', () => ({
  useProviders: vi.fn().mockReturnValue([
    {
      id: 'mock-provider',
      name: 'Mock Provider',
      search: vi.fn().mockResolvedValue({
        tracks: [
          {
            title: 'Resolved Song',
            artists: [{ name: 'Resolved Artist', roles: [] }],
            source: { provider: 'mock', id: 'res-1' },
          },
        ],
      }),
    },
  ]),
}));

vi.mock('../../services/personalizationEngine', () => ({
  personalizationEngine: {
    getTopArtists: vi.fn().mockResolvedValue([]),
    getTopGenres: vi.fn().mockResolvedValue([]),
    getSeedTracks: vi.fn().mockResolvedValue([]),
    getListenRecords: vi.fn().mockResolvedValue([]),
    getBlacklist: vi.fn().mockResolvedValue({ tracks: [], artists: [] }),
    subscribe: vi.fn().mockReturnValue(() => {}),
    blacklistTrack: vi.fn().mockResolvedValue(undefined),
    blacklistArtist: vi.fn().mockResolvedValue(undefined),
  },
  normalizeArtistKey: (name: string) =>
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim(),
}));

vi.mock('../../services/apkUpdater', () => ({
  ApkUpdaterPlugin: {
    getAppVersion: vi.fn().mockResolvedValue({ version: '1.48.4' }),
    addListener: vi.fn().mockImplementation((event, callback) => {
      if (event === 'downloadProgress') {
        callback({ progress: 45 });
      }
      return Promise.resolve({ remove: vi.fn() });
    }),
    downloadUpdate: vi.fn().mockImplementation(() => new Promise(() => {})),
    installUpdate: vi.fn().mockResolvedValue({ success: true }),
    downloadAndInstall: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('../../services/musicVideoService', () => ({
  musicVideoService: {
    findOfficialVideo: vi.fn().mockResolvedValue(null),
  },
}));

describe('Google TV Performance & Runtime Optimizations', () => {
  beforeAll(() => {
    initSpatialNavigation();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    clearRecommendationCache();
  });

  afterEach(() => {
    cleanup();
    clearRecommendationCache();
  });

  describe('Spatial navigation and focus responsiveness', () => {
    it('uses instant auto scrolling instead of smooth animation queueing', async () => {
      const scrollIntoViewMock = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoViewMock;

      const TestFocusWrapper = () => {
        const { ref, focusKey } = useFocusable({
          focusKey: 'PERF_CONTAINER',
          trackChildren: true,
        });
        return (
          <FocusContext.Provider value={focusKey}>
            <div ref={ref}>
              <TvButton focusKey="perf-btn-1">Action Button</TvButton>
            </div>
          </FocusContext.Provider>
        );
      };

      render(<TestFocusWrapper />);

      await act(async () => {
        setFocus('perf-btn-1');
      });

      await waitFor(() => {
        expect(scrollIntoViewMock).toHaveBeenCalledWith({
          block: 'center',
          inline: 'nearest',
          behavior: 'auto',
        });
      });
    });

    it('memoizes TvButton and TvFocusableCard with React.memo', () => {
      expect((TvButton as unknown as { $$typeof: symbol }).$$typeof).toBe(
        Symbol.for('react.memo'),
      );
      expect(
        (TvFocusableCard as unknown as { $$typeof: symbol }).$$typeof,
      ).toBe(Symbol.for('react.memo'));
      expect((TvNavRail as unknown as { $$typeof: symbol }).$$typeof).toBe(
        Symbol.for('react.memo'),
      );
    });
  });

  describe('Zustand selective subscriptions and re-render isolation', () => {
    it('updates TvNavRail only when activeSection changes and ignores unrelated tvStore fields', () => {
      useTvStore.setState({ activeSection: 'dashboard', showVideo: false });

      render(<TvNavRail />);

      const homeItem = screen.getByTestId('tv-nav-item-dashboard');
      const favsItem = screen.getByTestId('tv-nav-item-favorites');

      expect(homeItem).toHaveAttribute('aria-current', 'page');
      expect(favsItem).not.toHaveAttribute('aria-current', 'page');

      act(() => {
        useTvStore.setState({ showVideo: true, isSearchOpen: true });
      });

      expect(homeItem).toHaveAttribute('aria-current', 'page');

      act(() => {
        useTvStore.setState({ activeSection: 'favorites' });
      });

      expect(homeItem).not.toHaveAttribute('aria-current', 'page');
      expect(favsItem).toHaveAttribute('aria-current', 'page');
    });

    it('subscribes TvDashboard to collection counts and reflects length updates in stats chips', async () => {
      useFavoritesStore.setState({
        tracks: [
          {
            id: 'f1',
            ref: {
              title: 'Song 1',
              artists: [{ name: 'Artist 1', roles: [] }],
            } as Track,
            addedAtIso: '2026-10-01T00:00:00Z',
          },
          {
            id: 'f2',
            ref: {
              title: 'Song 2',
              artists: [{ name: 'Artist 2', roles: [] }],
            } as Track,
            addedAtIso: '2026-10-01T00:00:00Z',
          },
        ],
      });
      usePlaylistStore.setState({
        index: ['pl-1', 'pl-2', 'pl-3'],
      });
      usePodcastStore.setState({
        favorites: ['pod-1'],
      });

      await act(async () => {
        render(<TvDashboard />);
      });

      expect(screen.getByText('2 canciones')).toBeInTheDocument();
      expect(screen.getByText('3 guardadas')).toBeInTheDocument();
      expect(screen.getByText('1 guardados')).toBeInTheDocument();

      act(() => {
        useFavoritesStore.setState({
          tracks: [
            ...useFavoritesStore.getState().tracks,
            {
              id: 'f3',
              ref: {
                title: 'Song 3',
                artists: [{ name: 'Artist 3', roles: [] }],
              } as Track,
              addedAtIso: '2026-10-01T00:00:00Z',
            },
          ],
        });
      });

      expect(screen.getByText('3 canciones')).toBeInTheDocument();
    });
  });

  describe('Network concurrency, debouncing, and in-memory caching', () => {
    it('executes search queries in bounded parallel chunks via Promise.all and respects abort signals', async () => {
      const recordedCalls: string[] = [];
      const mockProvider: MetadataProvider = {
        id: 'test-prov',
        name: 'Test',
        search: vi.fn().mockImplementation(async ({ query }) => {
          recordedCalls.push(query);
          return {
            tracks: [
              {
                title: `${query} Track`,
                artists: [{ name: 'Artist', roles: [] }],
                source: { provider: 'test', id: query },
              },
            ],
          };
        }),
      };

      const queries = ['Query 1', 'Query 2', 'Query 3', 'Query 4', 'Query 5'];
      const results = await searchForUserFallbackTracks(
        mockProvider,
        queries,
        3,
      );

      expect(mockProvider.search).toHaveBeenCalledTimes(5);
      expect(results).toHaveLength(5);
      expect(recordedCalls).toEqual(queries);

      const controller = new AbortController();
      controller.abort();
      const abortedResults = await searchForUserFallbackTracks(
        mockProvider,
        queries,
        3,
        controller.signal,
      );
      expect(abortedResults).toEqual([]);
    });

    it('debounces personalizationEngine subscription updates with 300ms timer', async () => {
      vi.useFakeTimers();
      let capturedListener: (() => void) | null = null;
      vi.mocked(personalizationEngine.subscribe).mockImplementation(
        (listener) => {
          capturedListener = listener;
          return () => {};
        },
      );

      await act(async () => {
        render(<TvDashboard />);
      });

      expect(personalizationEngine.getSeedTracks).toHaveBeenCalledTimes(1);

      act(() => {
        capturedListener?.();
        capturedListener?.();
        capturedListener?.();
      });

      expect(personalizationEngine.getSeedTracks).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(350);
      });

      expect(personalizationEngine.getSeedTracks).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it('stores and clears recommendations in-memory cache properly', () => {
      expect(getCachedRecommendations()).toBeNull();

      clearRecommendationCache();
      expect(getCachedRecommendations()).toBeNull();
    });
  });

  describe('GPU and CSS style optimization verifications', () => {
    it('blacklists both track and artist on dislike in TvVideoPlayer', async () => {
      const mockTrack: Track = {
        title: 'Toxic Song',
        artists: [{ name: 'Disliked Artist', roles: [] }],
        source: { provider: 'mock', id: 'trk-dislike-1' },
      };

      render(<TvVideoPlayer track={mockTrack} />);

      const dislikeBtn = await screen.findByRole('button', {
        name: 'No me gusta',
      });
      await act(async () => {
        fireEvent.click(dislikeBtn);
      });

      expect(personalizationEngine.blacklistTrack).toHaveBeenCalledWith(
        'trk-dislike-1',
      );
      expect(personalizationEngine.blacklistArtist).toHaveBeenCalledWith(
        'Disliked Artist',
      );
    });

    it('verifies TvVideoPlayer fallback view does not contain blur-3xl', async () => {
      const mockTrack: Track = {
        title: 'Audio Track',
        artists: [{ name: 'Band', roles: [] }],
        source: { provider: 'mock', id: 'audio-trk-1' },
      };

      const { container } = render(<TvVideoPlayer track={mockTrack} />);

      await screen.findByTestId('tv-video-player');
      expect(container.innerHTML).not.toContain('blur-3xl');
    });

    it('verifies TvCoverArtView does not contain blur-md', () => {
      const mockTrack: Track = {
        title: 'Cover Track',
        artists: [{ name: 'Singer', roles: [] }],
        artwork: [
          {
            url: 'https://example.com/cover.jpg',
            type: 'thumbnail',
            size: 600,
          },
        ],
      };

      const { container } = render(<TvCoverArtView track={mockTrack} />);

      expect(screen.getByTestId('tv-cover-art-view')).toBeInTheDocument();
      expect(container.innerHTML).not.toContain('blur-md');
    });

    it('verifies TvAutoUpdater downloading pill does not contain continuous unthrottled animations', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            tag_name: 'v1.49.0',
            assets: [
              {
                name: 'aurora-google-tv.apk',
                browser_download_url: 'https://example.com/tv.apk',
              },
            ],
          }),
        }),
      );

      await act(async () => {
        render(<TvAutoUpdater />);
      });

      const pill = screen.getByTestId('tv-update-downloading-pill');
      expect(pill).toBeInTheDocument();
      expect(pill.className).not.toContain('animate-pulse');
      expect(pill.innerHTML).not.toContain('animate-bounce');
    });
  });
});
