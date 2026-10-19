import {
  FocusContext,
  getCurrentFocusKey,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import { act, cleanup, render, screen } from '@testing-library/react';
import { Profiler, useState, type ReactNode } from 'react';
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

import { personalizationEngine } from '../../services/personalizationEngine';
import { initSpatialNavigation } from '../../services/spatialNavigation';
import { useFavoritesStore } from '../../stores/favoritesStore';
import { usePlaylistStore } from '../../stores/playlistStore';
import { usePodcastStore } from '../../stores/podcastStore';
import { useQueueStore } from '../../stores/queueStore';
import { useSoundStore } from '../../stores/soundStore';
import { useTvStore } from '../../stores/tvStore';
import { TvButton } from './TvButton';
import { clearRecommendationCache, TvDashboard } from './TvDashboard';
import { TvFocusableCard } from './TvFocusableCard';
import { TvNavRail } from './TvNavRail';

vi.mock('../../hooks/useProviders', () => ({
  useProviders: vi.fn().mockReturnValue([
    {
      id: 'stress-meta-provider',
      name: 'Stress Metadata Provider',
      search: vi.fn().mockResolvedValue({
        tracks: [
          {
            title: 'Mock Recommended Track',
            artists: [{ name: 'Mock Artist', roles: [] }],
            source: { provider: 'mock', id: 'mock-rec-1' },
          },
        ],
      }),
    },
  ]),
}));

vi.mock('../../services/personalizationEngine', () => {
  let subscriber: (() => void) | null = null;
  return {
    personalizationEngine: {
      getTopArtists: vi.fn().mockResolvedValue([]),
      getTopGenres: vi.fn().mockResolvedValue([]),
      getSeedTracks: vi.fn().mockResolvedValue([]),
      getListenRecords: vi.fn().mockResolvedValue([]),
      getBlacklist: vi.fn().mockResolvedValue({ tracks: [], artists: [] }),
      subscribe: vi.fn().mockImplementation((cb) => {
        subscriber = cb;
        return () => {
          if (subscriber === cb) {
            subscriber = null;
          }
        };
      }),
      blacklistTrack: vi.fn().mockResolvedValue(undefined),
      blacklistArtist: vi.fn().mockResolvedValue(undefined),
      __emitSubscribe: () => {
        subscriber?.();
      },
    },
    normalizeArtistKey: (name: string) =>
      name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim(),
  };
});

describe('Adversarial Stress Test: Spatial Navigation, Memoization & Re-render Isolation', () => {
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

  describe('1. Spatial Navigation & Rapid D-Pad Traversal (50+ simulated steps)', () => {
    it('executes 50 rapid D-pad focus steps across TvButton and TvFocusableCard, strictly verifying behavior: "auto" with zero smooth scrolling', async () => {
      const scrollIntoViewMock = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoViewMock;

      // Construct a 4x4 spatial navigation grid + nav rail simulation
      // Nodes: btn-0-0 to btn-3-3, mixing TvButton and TvFocusableCard
      const NavigationGrid = () => {
        const { ref, focusKey } = useFocusable({
          focusKey: 'STRESS_GRID',
          trackChildren: true,
        });

        return (
          <FocusContext.Provider value={focusKey}>
            <div ref={ref} data-testid="stress-grid">
              {Array.from({ length: 4 }).map((_, r) => (
                <div key={`row-${r}`} className="flex">
                  {Array.from({ length: 4 }).map((_, c) => {
                    const id = `node-${r}-${c}`;
                    const up = r > 0 ? `node-${r - 1}-${c}` : undefined;
                    const down = r < 3 ? `node-${r + 1}-${c}` : undefined;
                    const left = c > 0 ? `node-${r}-${c - 1}` : undefined;
                    const right = c < 3 ? `node-${r}-${c + 1}` : undefined;
                    const destinations = { up, down, left, right };

                    if ((r + c) % 2 === 0) {
                      return (
                        <TvButton
                          key={id}
                          focusKey={id}
                          destinations={destinations}
                        >
                          Btn {r},{c}
                        </TvButton>
                      );
                    }
                    return (
                      <TvFocusableCard
                        key={id}
                        focusKey={id}
                        title={`Card ${r},${c}`}
                        destinations={destinations}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </FocusContext.Provider>
        );
      };

      render(<NavigationGrid />);

      // Initial focus
      await act(async () => {
        setFocus('node-0-0');
      });

      expect(getCurrentFocusKey()).toBe('node-0-0');
      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        block: 'center',
        inline: 'nearest',
        behavior: 'auto',
      });
      scrollIntoViewMock.mockClear();

      // Define a 50-step traversal path (a deterministic serpentine and loop sequence)
      const targetPath: string[] = [];
      let curR = 0;
      let curC = 0;
      const directions: ('down' | 'right' | 'up' | 'left')[] = [
        'down',
        'down',
        'down',
        'right',
        'up',
        'up',
        'up',
        'right',
        'down',
        'down',
        'down',
        'right',
        'up',
        'up',
        'up',
        'left',
        'left',
        'left',
      ];

      for (let i = 0; i < 50; i++) {
        const dir = directions[i % directions.length];
        if (dir === 'down' && curR < 3) {
          curR++;
        } else if (dir === 'up' && curR > 0) {
          curR--;
        } else if (dir === 'right' && curC < 3) {
          curC++;
        } else if (dir === 'left' && curC > 0) {
          curC--;
        }
        targetPath.push(`node-${curR}-${curC}`);
      }

      expect(targetPath.length).toBe(50);

      // Execute 50 rapid sequential transitions without any artificial latency
      for (let i = 0; i < targetPath.length; i++) {
        const nextNode = targetPath[i];
        await act(async () => {
          setFocus(nextNode);
        });
        expect(getCurrentFocusKey()).toBe(nextNode);
      }

      // Verify scrollIntoView was called for all 50 transitions (100 times due to programmatic setFocus + native focus event)
      expect(scrollIntoViewMock.mock.calls.length).toBeGreaterThanOrEqual(50);

      // Verify EVERY SINGLE call strictly used behavior: 'auto'
      for (const callArgs of scrollIntoViewMock.mock.calls) {
        expect(callArgs[0]).toEqual({
          block: 'center',
          inline: 'nearest',
          behavior: 'auto',
        });
        expect(callArgs[0].behavior).not.toBe('smooth');
      }

      // Verify zero unhandled exceptions and active focus remained accurate
      expect(getCurrentFocusKey()).toBe(targetPath[targetPath.length - 1]);
    });

    it('handles high-frequency keyboard Arrow key events and repeat keydown without stalls', async () => {
      const scrollIntoViewMock = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoViewMock;

      const NavContainer = () => {
        const { ref, focusKey } = useFocusable({
          focusKey: 'KEY_TEST_CONTAINER',
          trackChildren: true,
        });
        return (
          <FocusContext.Provider value={focusKey}>
            <div ref={ref}>
              <TvButton
                focusKey="k-btn-1"
                destinations={{ right: 'k-btn-2', down: 'k-btn-2' }}
              >
                Button 1
              </TvButton>
              <TvButton
                focusKey="k-btn-2"
                destinations={{ left: 'k-btn-1', up: 'k-btn-1' }}
              >
                Button 2
              </TvButton>
            </div>
          </FocusContext.Provider>
        );
      };

      render(<NavContainer />);

      await act(async () => {
        setFocus('k-btn-1');
      });

      const btn1 = screen.getByRole('button', { name: 'Button 1' });

      // Simulate rapid repeat arrow key events on the focused button
      for (let i = 0; i < 20; i++) {
        const arrowEvent = new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          bubbles: true,
          cancelable: true,
          repeat: true,
        });
        btn1.dispatchEvent(arrowEvent);
        expect(arrowEvent.defaultPrevented).toBe(true);
      }

      // Simulate repeated Enter / Space presses (remote hold) and verify preventDefault suppresses repeat storm
      const repeatEnter = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
        repeat: true,
      });
      btn1.dispatchEvent(repeatEnter);
      expect(repeatEnter.defaultPrevented).toBe(true);

      const repeatSpace = new KeyboardEvent('keydown', {
        key: ' ',
        bubbles: true,
        cancelable: true,
        repeat: true,
      });
      btn1.dispatchEvent(repeatSpace);
      expect(repeatSpace.defaultPrevented).toBe(true);

      // Verify regular non-repeat Enter is NOT prevented
      const regularEnter = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
        repeat: false,
      });
      btn1.dispatchEvent(regularEnter);
      expect(regularEnter.defaultPrevented).toBe(false);
    });

    it('safely handles missing scrollIntoView implementation or unmounted ref without throwing', async () => {
      const BrokenContainer = () => {
        const { ref, focusKey } = useFocusable({
          focusKey: 'BROKEN_CONTAINER',
          trackChildren: true,
        });
        return (
          <FocusContext.Provider value={focusKey}>
            <div ref={ref}>
              <TvButton focusKey="btn-safe">Safe Button</TvButton>
            </div>
          </FocusContext.Provider>
        );
      };

      const { unmount } = render(<BrokenContainer />);

      // Delete scrollIntoView to simulate environment limitation or edge layout detachment
      const originalScroll = Element.prototype.scrollIntoView;
      // @ts-expect-error simulating missing method
      delete Element.prototype.scrollIntoView;

      expect(async () => {
        await act(async () => {
          setFocus('btn-safe');
        });
      }).not.toThrow();

      // Restore
      Element.prototype.scrollIntoView = originalScroll;
      unmount();
    });
  });

  describe('2. Component Memoization & Render Immunity Under Rapid State Storm', () => {
    it('verifies TvNavRail is completely immune to rapid unrelated tvStore and soundStore updates', async () => {
      useTvStore.setState({
        activeSection: 'dashboard',
        showVideo: false,
        isSearchOpen: false,
      });
      useSoundStore.setState({ volume: 0.5 });
      useQueueStore.setState({ currentIndex: 0 });

      let navRailRenderCount = 0;
      const onRenderNavRail = () => {
        navRailRenderCount++;
      };

      render(
        <Profiler id="TvNavRailProfiler" onRender={onRenderNavRail}>
          <TvNavRail />
        </Profiler>,
      );

      // Initial mount produces exactly 1 render
      expect(navRailRenderCount).toBe(1);

      // Rapidly fire 30 unrelated updates across tvStore and soundStore
      act(() => {
        for (let i = 0; i < 15; i++) {
          useTvStore.setState({
            showVideo: i % 2 === 0,
            isSearchOpen: i % 3 === 0,
          });
          useSoundStore.setState({
            volume: i / 20,
          });
          useQueueStore.setState({
            currentIndex: i,
          });
        }
      });

      // TvNavRail must NOT have re-rendered at all during this 30-update storm!
      expect(navRailRenderCount).toBe(1);

      // Now update the relevant field (activeSection) and verify it re-renders exactly once
      act(() => {
        useTvStore.setState({ activeSection: 'favorites' });
      });

      expect(navRailRenderCount).toBe(2);
      expect(screen.getByTestId('tv-nav-item-favorites')).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(screen.getByTestId('tv-nav-item-dashboard')).not.toHaveAttribute(
        'aria-current',
        'page',
      );
    });

    it('verifies TvButton and TvFocusableCard do NOT re-render when parent state updates rapidly', async () => {
      // Intercept the inner function component of the memoized object
      const originalButtonType = (
        TvButton as unknown as { type: (props: unknown) => ReactNode }
      ).type;
      const originalCardType = (
        TvFocusableCard as unknown as { type: (props: unknown) => ReactNode }
      ).type;

      const buttonRenderSpy = vi.fn((props: unknown) =>
        originalButtonType(props),
      );
      const cardRenderSpy = vi.fn((props: unknown) => originalCardType(props));

      (TvButton as unknown as { type: (props: unknown) => ReactNode }).type =
        buttonRenderSpy;
      (
        TvFocusableCard as unknown as { type: (props: unknown) => ReactNode }
      ).type = cardRenderSpy;

      const ParentHarness = () => {
        const [counter, setCounter] = useState(0);

        return (
          <div>
            <button
              data-testid="parent-bump"
              onClick={() => setCounter((c) => c + 1)}
            >
              Counter: {counter}
            </button>
            <TvButton focusKey="stable-btn">Click Me</TvButton>
            <TvFocusableCard
              focusKey="stable-card"
              title="Stable Title"
              subtitle="Stable Subtitle"
            />
          </div>
        );
      };

      try {
        render(<ParentHarness />);

        // Initial mount executes standalone TvButton once, and TvFocusableCard once (which internally renders a second TvButton)
        expect(buttonRenderSpy).toHaveBeenCalledTimes(2);
        expect(cardRenderSpy).toHaveBeenCalledTimes(1);

        const bumpBtn = screen.getByTestId('parent-bump');

        // Trigger 20 rapid parent state updates
        for (let i = 1; i <= 20; i++) {
          act(() => {
            bumpBtn.click();
          });
        }

        expect(screen.getByText('Counter: 20')).toBeInTheDocument();

        // TvButton and TvFocusableCard must NOT re-render at all because their props are shallow-equal
        // Proves that React.memo successfully bailed out of all 20 parent re-render cycles!
        expect(buttonRenderSpy).toHaveBeenCalledTimes(2);
        expect(cardRenderSpy).toHaveBeenCalledTimes(1);
      } finally {
        // Restore original functions
        (TvButton as unknown as { type: (props: unknown) => ReactNode }).type =
          originalButtonType;
        (
          TvFocusableCard as unknown as { type: (props: unknown) => ReactNode }
        ).type = originalCardType;
      }
    });

    it('verifies TvButton and TvFocusableCard do NOT re-render when volume or isVideoPlaying update rapidly in parent', async () => {
      const originalButtonType = (
        TvButton as unknown as { type: (props: unknown) => ReactNode }
      ).type;
      const originalCardType = (
        TvFocusableCard as unknown as { type: (props: unknown) => ReactNode }
      ).type;

      const buttonRenderSpy = vi.fn((props: unknown) =>
        originalButtonType(props),
      );
      const cardRenderSpy = vi.fn((props: unknown) => originalCardType(props));

      (TvButton as unknown as { type: (props: unknown) => ReactNode }).type =
        buttonRenderSpy;
      (
        TvFocusableCard as unknown as { type: (props: unknown) => ReactNode }
      ).type = cardRenderSpy;

      const PlaybackStateConsumer = () => {
        const volume = useSoundStore((s) => s.volume);
        const showVideo = useTvStore((s) => s.showVideo);

        return (
          <div>
            <div data-testid="playback-info">
              {volume}-{String(showVideo)}
            </div>
            <TvButton focusKey="playback-btn">Playback Action</TvButton>
            <TvFocusableCard focusKey="playback-card" title="Playback Card" />
          </div>
        );
      };

      try {
        render(<PlaybackStateConsumer />);

        expect(buttonRenderSpy).toHaveBeenCalledTimes(2);
        expect(cardRenderSpy).toHaveBeenCalledTimes(1);

        // Rapidly change volume and video display state 20 times
        act(() => {
          for (let i = 0; i < 20; i++) {
            useSoundStore.setState({ volume: i / 20 });
            useTvStore.setState({ showVideo: i % 2 === 0 });
          }
        });

        // Even though PlaybackStateConsumer re-rendered 20 times,
        // TvButton and TvFocusableCard bailed out completely!
        expect(buttonRenderSpy).toHaveBeenCalledTimes(2);
        expect(cardRenderSpy).toHaveBeenCalledTimes(1);
      } finally {
        (TvButton as unknown as { type: (props: unknown) => ReactNode }).type =
          originalButtonType;
        (
          TvFocusableCard as unknown as { type: (props: unknown) => ReactNode }
        ).type = originalCardType;
      }
    });
  });

  describe('3. Granular Selector Isolation & Focus Stability in TvDashboard', () => {
    it('does NOT re-render TvDashboard when modifying favorite track metadata in-place without length change', async () => {
      const initialFavorites = [
        {
          id: 'f1',
          ref: {
            title: 'Initial Favorite 1',
            artists: [{ name: 'Artist 1', roles: [] }],
          } as Track,
          addedAtIso: '2026-10-01T00:00:00Z',
        },
        {
          id: 'f2',
          ref: {
            title: 'Initial Favorite 2',
            artists: [{ name: 'Artist 2', roles: [] }],
          } as Track,
          addedAtIso: '2026-10-02T00:00:00Z',
        },
      ];

      useFavoritesStore.setState({ tracks: initialFavorites });
      usePlaylistStore.setState({ index: ['pl-1', 'pl-2'] });
      usePodcastStore.setState({ favorites: [] });

      let dashboardRenders = 0;
      const onRenderDashboard = () => {
        dashboardRenders++;
      };

      await act(async () => {
        render(
          <Profiler id="DashboardProfiler" onRender={onRenderDashboard}>
            <TvDashboard />
          </Profiler>,
        );
      });

      const initialDashboardRenderCount = dashboardRenders;
      expect(screen.getByText('2 canciones')).toBeInTheDocument();

      // Mutate track 1 in-place (changing its addedAtIso and title, keeping tracks.length === 2)
      act(() => {
        const mutated = [
          {
            ...initialFavorites[0],
            addedAtIso: '2026-10-19T12:00:00Z',
            ref: {
              ...initialFavorites[0].ref,
              title: 'Updated Favorite 1 Title',
            },
          },
          initialFavorites[1],
        ];
        useFavoritesStore.setState({ tracks: mutated });
      });

      // Because useFavoritesStore((state) => state.tracks.length) returned 2 before and 2 now,
      // the selector is identical and TvDashboard does NOT re-render!
      expect(dashboardRenders).toBe(initialDashboardRenderCount);
      expect(screen.getByText('2 canciones')).toBeInTheDocument();
    });

    it('maintains active focus on the stats chip when tracks are added and updates the chip count without focus loss', async () => {
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
        ],
      });
      usePlaylistStore.setState({ index: ['pl-1'] });
      usePodcastStore.setState({ favorites: [] });

      await act(async () => {
        render(<TvDashboard />);
      });

      expect(screen.getByText('1 canciones')).toBeInTheDocument();

      // Set focus to the favorites stat chip
      await act(async () => {
        setFocus('tv-stat-favs');
      });

      expect(getCurrentFocusKey()).toBe('tv-stat-favs');
      const favChip = screen.getByText('1 canciones').closest('button');
      expect(favChip).toHaveAttribute('data-focused', 'true');

      // Now simulate rapid additions of 5 new tracks to favoritesStore
      act(() => {
        for (let i = 2; i <= 6; i++) {
          useFavoritesStore.setState({
            tracks: [
              ...useFavoritesStore.getState().tracks,
              {
                id: `f${i}`,
                ref: {
                  title: `Song ${i}`,
                  artists: [{ name: `Artist ${i}`, roles: [] }],
                } as Track,
                addedAtIso: '2026-10-19T00:00:00Z',
              },
            ],
          });
        }
      });

      // The count must update to 6
      expect(screen.getByText('6 canciones')).toBeInTheDocument();

      // The focus key MUST STILL BE 'tv-stat-favs' - NO focus loss or reset to dashboard root!
      expect(getCurrentFocusKey()).toBe('tv-stat-favs');
      expect(screen.getByText('6 canciones').closest('button')).toHaveAttribute(
        'data-focused',
        'true',
      );
    });

    it('maintains active focus on hero action buttons across playlist collection updates', async () => {
      useFavoritesStore.setState({ tracks: [] });
      usePlaylistStore.setState({ index: ['pl-1', 'pl-2'] });
      usePodcastStore.setState({ favorites: [] });

      await act(async () => {
        render(<TvDashboard />);
      });

      expect(screen.getByText('2 guardadas')).toBeInTheDocument();

      // Focus on hero play button
      await act(async () => {
        setFocus('tv-hero-play');
      });

      expect(getCurrentFocusKey()).toBe('tv-hero-play');

      // Add 3 playlists in rapid succession
      act(() => {
        usePlaylistStore.setState({
          index: ['pl-1', 'pl-2', 'pl-3', 'pl-4', 'pl-5'],
        });
      });

      expect(screen.getByText('5 guardadas')).toBeInTheDocument();

      // Focus must remain on hero play button
      expect(getCurrentFocusKey()).toBe('tv-hero-play');
    });

    it('preserves focus on mood capsule shelf cards when background favorites are added', async () => {
      useFavoritesStore.setState({ tracks: [] });
      usePlaylistStore.setState({ index: [] });
      usePodcastStore.setState({ favorites: [] });

      await act(async () => {
        render(<TvDashboard />);
      });

      // Focus on mood capsule 'tv-mood-latino'
      await act(async () => {
        setFocus('tv-mood-latino');
      });

      expect(getCurrentFocusKey()).toBe('tv-mood-latino');

      // Add 10 tracks to favorites in the background
      act(() => {
        const newTracks = Array.from({ length: 10 }).map((_, i) => ({
          id: `fav-bg-${i}`,
          ref: {
            title: `Background Track ${i}`,
            artists: [{ name: 'Artist', roles: [] }],
          } as Track,
          addedAtIso: '2026-10-19T00:00:00Z',
        }));
        useFavoritesStore.setState({ tracks: newTracks });
      });

      // Verify stats chip updated
      expect(screen.getByText('10 canciones')).toBeInTheDocument();

      // Verify active focus is still on the mood card and has not reset
      expect(getCurrentFocusKey()).toBe('tv-mood-latino');
    });
  });

  describe('4. Sustained Event Storm & Debounce Coalescing', () => {
    it('coalesces a burst of 50 subscribe events in 50ms into exactly ONE delayed network fetch', async () => {
      vi.useFakeTimers();

      let seedFetchCount = 0;
      vi.mocked(personalizationEngine.getSeedTracks).mockImplementation(
        async () => {
          seedFetchCount++;
          return [];
        },
      );

      await act(async () => {
        render(<TvDashboard />);
      });

      // Initial mount triggers 1 fetch
      expect(seedFetchCount).toBe(1);

      // Fire a rapid burst of 50 subscription events (e.g. rapid session saves or skips)
      act(() => {
        for (let i = 0; i < 50; i++) {
          (
            personalizationEngine as unknown as { __emitSubscribe: () => void }
          ).__emitSubscribe();
        }
      });

      // Immediately after burst, still exactly 1 fetch (debouncing active)
      expect(seedFetchCount).toBe(1);

      // Advance 150ms (halfway through debounce)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(150);
      });
      expect(seedFetchCount).toBe(1);

      // Fire another event at 150ms to reset debounce timer
      act(() => {
        (
          personalizationEngine as unknown as { __emitSubscribe: () => void }
        ).__emitSubscribe();
      });

      // Advance 200ms (350ms total, but only 200ms since last event)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });
      expect(seedFetchCount).toBe(1);

      // Advance remaining 150ms (now 350ms since last event)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(150);
      });

      // Now exactly 2 fetches total! (1 initial + 1 coalesced from the entire storm)
      expect(seedFetchCount).toBe(2);

      vi.useRealTimers();
    });
  });
});
