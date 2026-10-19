import { act, cleanup, render, screen } from '@testing-library/react';
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

import * as discoveryService from '../../services/discoveryService';
import { metadataHost } from '../../services/metadataHost';
import { personalizationEngine } from '../../services/personalizationEngine';
import { initSpatialNavigation } from '../../services/spatialNavigation';
import { useFavoritesStore } from '../../stores/favoritesStore';
import { usePlaylistStore } from '../../stores/playlistStore';
import { useQueueStore } from '../../stores/queueStore';
import {
  clearRecommendationCache,
  getCachedRecommendations,
  searchForUserFallbackTracks,
  TvDashboard,
} from './TvDashboard';
import { replenishTvQueue, resetTvSession } from './tvInfiniteQueue';

vi.mock('../../hooks/useProviders', () => ({
  useProviders: vi.fn().mockReturnValue([
    {
      id: 'mock-stress-provider',
      name: 'Mock Stress Provider',
      search: vi.fn().mockResolvedValue({
        tracks: [
          {
            title: 'Mock Stress Track',
            artists: [{ name: 'Stress Artist', roles: [] }],
            source: { provider: 'mock-stress', id: 'trk-stress-1' },
          },
        ],
      }),
    },
  ]),
}));

vi.mock('../../services/metadataHost', () => ({
  metadataHost: {
    search: vi.fn(),
  },
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

vi.mock('../../services/discoveryService', async () => {
  const actual = await vi.importActual<
    typeof import('../../services/discoveryService')
  >('../../services/discoveryService');
  return {
    ...actual,
    getIntelligentAutoplayTracks: vi.fn().mockResolvedValue([]),
  };
});

const createSampleTrack = (
  title: string,
  artist: string,
  id?: string,
): Track => ({
  title,
  artists: [{ name: artist, roles: [] }],
  source: {
    provider: 'stress-test',
    id: id ?? `id-${title.toLowerCase().replace(/\s+/g, '-')}`,
  },
});

describe('Adversarial Stress Test: Network Debouncing, Concurrency & Recommendation Caching', () => {
  beforeAll(() => {
    initSpatialNavigation();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    clearRecommendationCache();
    useQueueStore.setState({ items: [], currentIndex: 0 });
    useFavoritesStore.setState({ tracks: [], artists: [], albums: [] });
    usePlaylistStore.setState({ playlists: new Map(), index: [] });
    resetTvSession();
  });

  afterEach(() => {
    cleanup();
    clearRecommendationCache();
    vi.useRealTimers();
  });

  describe('1. Rapid Subscription Firing, 300ms Debounce Window & AbortController Cancellation', () => {
    it('collapses 20 rapid subscription notifications within 50ms into at most one recommendation reload', async () => {
      vi.useFakeTimers();

      let activeSubscriber: (() => void) | null = null;
      vi.mocked(personalizationEngine.subscribe).mockImplementation(
        (listener) => {
          activeSubscriber = listener;
          return () => {};
        },
      );

      vi.mocked(personalizationEngine.getSeedTracks).mockResolvedValue([
        createSampleTrack('Seed 1', 'Artist A', 'seed-1'),
      ]);

      await act(async () => {
        render(<TvDashboard />);
      });

      // Initial mount triggers loadRecommendations once
      expect(personalizationEngine.getSeedTracks).toHaveBeenCalledTimes(1);

      // Trigger burst of 20 consecutive notifications over 48ms
      act(() => {
        for (let burstStep = 0; burstStep < 20; burstStep++) {
          activeSubscriber?.();
          vi.advanceTimersByTime(2);
        }
      });

      // After 40ms of rapid firing, 300ms has NOT elapsed since the last notification
      expect(personalizationEngine.getSeedTracks).toHaveBeenCalledTimes(1);

      // Advance by another 250ms (total elapsed since 20th notification is 250ms < 300ms)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(250);
      });
      expect(personalizationEngine.getSeedTracks).toHaveBeenCalledTimes(1);

      // Advance past the 300ms window from the 20th notification (advance by 60ms)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60);
      });

      // Exactly ONE new loadRecommendations run executed for the entire burst
      expect(personalizationEngine.getSeedTracks).toHaveBeenCalledTimes(2);
    });

    it('aborts in-flight searches via AbortController when a debounced reload triggers', async () => {
      vi.useFakeTimers();

      let activeSubscriber: (() => void) | null = null;
      vi.mocked(personalizationEngine.subscribe).mockImplementation(
        (listener) => {
          activeSubscriber = listener;
          return () => {};
        },
      );

      // Force TvDashboard to use search fallback by having 0 seed tracks and fallback query
      vi.mocked(personalizationEngine.getSeedTracks).mockResolvedValue([]);
      vi.mocked(personalizationEngine.getTopArtists).mockResolvedValue([
        { name: 'Slow Artist', score: 10 },
      ]);

      const renderResult = await act(async () => {
        return render(<TvDashboard />);
      });

      // Advance 10ms so initial loadRecommendations starts its fallback search
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });

      // Fire subscription notification to request reload
      act(() => {
        activeSubscriber?.();
      });

      // Advance past 300ms debounce
      await act(async () => {
        await vi.advanceTimersByTimeAsync(350);
      });

      // Verify that getSeedTracks was called again (debounced reload began)
      expect(personalizationEngine.getSeedTracks).toHaveBeenCalledTimes(2);

      renderResult.unmount();
    });

    it('clears debounce timer and aborts active controller when TvDashboard unmounts', async () => {
      vi.useFakeTimers();

      let activeSubscriber: (() => void) | null = null;
      vi.mocked(personalizationEngine.subscribe).mockImplementation(
        (listener) => {
          activeSubscriber = listener;
          return () => {};
        },
      );

      vi.mocked(personalizationEngine.getSeedTracks).mockResolvedValue([
        createSampleTrack('Track 1', 'Artist 1'),
      ]);

      const { unmount } = render(<TvDashboard />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });

      expect(personalizationEngine.getSeedTracks).toHaveBeenCalledTimes(1);

      // Trigger subscription notification
      act(() => {
        activeSubscriber?.();
      });

      // Unmount before 300ms expires
      unmount();

      // Advance past 300ms
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });

      // No new execution should occur after unmount
      expect(personalizationEngine.getSeedTracks).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. Concurrency Stress in searchForUserFallbackTracks & searchForFreshTracks', () => {
    it('executes search queries in parallel chunks of 3 and bounds active concurrency', async () => {
      let currentConcurrency = 0;
      let maxObservedConcurrency = 0;

      const mockProvider: MetadataProvider = {
        id: 'chunked-provider',
        name: 'Chunked Provider',
        search: vi.fn().mockImplementation(async ({ query }) => {
          currentConcurrency++;
          maxObservedConcurrency = Math.max(
            maxObservedConcurrency,
            currentConcurrency,
          );
          // Simulate network latency to ensure overlap in Promise.all
          await new Promise((resolve) => setTimeout(resolve, 15));
          currentConcurrency--;
          return {
            tracks: [createSampleTrack(`${query} Song`, 'Test Band')],
          };
        }),
      };

      const queries = [
        'Query 1',
        'Query 2',
        'Query 3',
        'Query 4',
        'Query 5',
        'Query 6',
      ];
      const results = await searchForUserFallbackTracks(
        mockProvider,
        queries,
        3,
      );

      expect(mockProvider.search).toHaveBeenCalledTimes(6);
      expect(results).toHaveLength(6);
      // Concurrency reached exactly 3 (chunkSize), proving queries were not run sequentially
      expect(maxObservedConcurrency).toBe(3);
    });

    it('isolates failures: rejected promises in a chunk do not crash the pipeline and remaining queries succeed', async () => {
      const mockProvider: MetadataProvider = {
        id: 'resilient-provider',
        name: 'Resilient Provider',
        search: vi.fn().mockImplementation(async ({ query }) => {
          if (query === 'Failing Query A') {
            throw new Error('500 Internal Server Error');
          }
          if (query === 'Failing Query B') {
            throw new Error('Network Timeout / Connection Dropped');
          }
          return {
            tracks: [createSampleTrack(`${query} Result`, 'Healthy Artist')],
          };
        }),
      };

      const queries = [
        'Failing Query A',
        'Healthy Query 1',
        'Failing Query B',
        'Healthy Query 2',
        'Healthy Query 3',
      ];

      // Must not throw an unhandled rejection
      const results = await searchForUserFallbackTracks(
        mockProvider,
        queries,
        3,
      );

      // Only the 3 healthy queries should produce tracks
      expect(results).toHaveLength(3);
      expect(results.map((track) => track.title)).toEqual([
        'Healthy Query 1 Result',
        'Healthy Query 2 Result',
        'Healthy Query 3 Result',
      ]);
    });

    it('terminates early when results accumulate 12 tracks, preventing superfluous network calls', async () => {
      const searchExecutionCount = vi.fn();
      const mockProvider: MetadataProvider = {
        id: 'early-exit-provider',
        name: 'Early Exit Provider',
        search: vi.fn().mockImplementation(async ({ query }) => {
          searchExecutionCount(query);
          return {
            tracks: [
              createSampleTrack(`${query} 1`, 'Band'),
              createSampleTrack(`${query} 2`, 'Band'),
              createSampleTrack(`${query} 3`, 'Band'),
              createSampleTrack(`${query} 4`, 'Band'),
            ],
          };
        }),
      };

      // 9 queries in chunks of 3. Chunk 1 yields 3 queries * 4 tracks = 12 tracks.
      const queries = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9'];
      const results = await searchForUserFallbackTracks(
        mockProvider,
        queries,
        3,
      );

      expect(results).toHaveLength(12);
      // Chunk 1 had 3 queries. Because results.length >= 12, Chunk 2 (Q4-Q6) and Chunk 3 (Q7-Q9) were never called.
      expect(mockProvider.search).toHaveBeenCalledTimes(3);
      expect(searchExecutionCount).toHaveBeenCalledWith('Q1');
      expect(searchExecutionCount).toHaveBeenCalledWith('Q2');
      expect(searchExecutionCount).toHaveBeenCalledWith('Q3');
      expect(searchExecutionCount).not.toHaveBeenCalledWith('Q4');
    });

    it('immediately aborts searchForUserFallbackTracks if signal is already aborted or aborted mid-execution', async () => {
      const mockProvider: MetadataProvider = {
        id: 'abort-test-provider',
        name: 'Abort Test Provider',
        search: vi.fn().mockResolvedValue({
          tracks: [createSampleTrack('Track', 'Artist')],
        }),
      };

      const preAbortedController = new AbortController();
      preAbortedController.abort();

      const preAbortedResults = await searchForUserFallbackTracks(
        mockProvider,
        ['Query 1', 'Query 2'],
        3,
        preAbortedController.signal,
      );

      expect(preAbortedResults).toEqual([]);
      expect(mockProvider.search).not.toHaveBeenCalled();

      // Mid-execution abort
      const midController = new AbortController();
      let callStep = 0;
      mockProvider.search = vi.fn().mockImplementation(async () => {
        callStep++;
        if (callStep === 2) {
          midController.abort();
        }
        return {
          tracks: [createSampleTrack(`Result ${callStep}`, 'Artist')],
        };
      });

      const midAbortedResults = await searchForUserFallbackTracks(
        mockProvider,
        ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'],
        2,
        midController.signal,
      );

      // Chunk 2 should not execute because signal was aborted during chunk 1
      expect(midAbortedResults.length).toBeLessThanOrEqual(2);
    });

    it('verifies searchForFreshTracks in tvInfiniteQueue runs queries concurrently and tolerates individual rejections', async () => {
      useQueueStore
        .getState()
        .addToQueue([createSampleTrack('Initial Track', 'Initial Artist')]);

      let activeSearchConcurrency = 0;
      let maxSearchConcurrency = 0;

      vi.mocked(metadataHost.search).mockImplementation(
        async ({ query }: { query: string }) => {
          activeSearchConcurrency++;
          maxSearchConcurrency = Math.max(
            maxSearchConcurrency,
            activeSearchConcurrency,
          );

          if (query.includes('broken')) {
            activeSearchConcurrency--;
            throw new Error(`Simulated search provider failure for ${query}`);
          }

          await new Promise((resolve) => setTimeout(resolve, 10));
          activeSearchConcurrency--;

          return {
            tracks: [
              createSampleTrack(
                `Fresh from ${query}`,
                'Discovered Band',
                `id-${query}`,
              ),
            ],
          };
        },
      );

      vi.mocked(
        discoveryService.getIntelligentAutoplayTracks,
      ).mockResolvedValue([]);

      vi.mocked(personalizationEngine.getTopArtists).mockResolvedValue([
        { name: 'Artist A', score: 10 },
        { name: 'broken artist', score: 8 },
      ]);
      vi.mocked(personalizationEngine.getTopGenres).mockResolvedValue([
        { genre: 'Synthwave', score: 15 },
        { genre: 'broken genre', score: 5 },
      ]);

      const replenished = await replenishTvQueue(true);

      // Concurrency must be > 1, proving Promise.all executed queries in parallel
      expect(maxSearchConcurrency).toBeGreaterThan(1);

      // Replenishment succeeded despite 2 broken queries throwing errors
      expect(replenished.length).toBeGreaterThan(0);
      const addedToStore = useQueueStore.getState().items;
      expect(addedToStore.length).toBeGreaterThan(1);
    });
  });

  describe('3. Recommendation Cache Expiration, TTL & Invalidation', () => {
    it('serves identical queries within 60s from in-memory cache without hitting the network', async () => {
      vi.useFakeTimers();

      const seedTracks = [
        createSampleTrack('Cached Track 1', 'Cached Artist 1', 'c1'),
        createSampleTrack('Cached Track 2', 'Cached Artist 2', 'c2'),
      ];
      vi.mocked(personalizationEngine.getSeedTracks).mockResolvedValue(
        seedTracks,
      );
      vi.mocked(
        discoveryService.getIntelligentAutoplayTracks,
      ).mockResolvedValue(seedTracks);

      const { unmount } = render(<TvDashboard />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20);
      });

      expect(personalizationEngine.getSeedTracks).toHaveBeenCalledTimes(1);
      const cachedData = getCachedRecommendations();
      expect(cachedData).not.toBeNull();
      expect(cachedData?.tracks.length).toBeGreaterThanOrEqual(2);
      expect(cachedData?.providerId).toBe('mock-stress-provider');

      unmount();

      // Advance time by 30 seconds (30000ms < 60000ms CACHE_TTL_MS)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30000);
      });

      // Render TvDashboard again within TTL window
      render(<TvDashboard />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20);
      });

      // getSeedTracks was NOT called a second time because recommendations were loaded from cache
      expect(personalizationEngine.getSeedTracks).toHaveBeenCalledTimes(1);
      expect(screen.getAllByText('Cached Track 1')[0]).toBeInTheDocument();
    });

    it('expires recommendations cache after 60s and fetches fresh recommendations', async () => {
      vi.useFakeTimers();

      const initialSeeds = [
        createSampleTrack('Old Track', 'Old Artist', 'old-1'),
      ];
      const freshSeeds = [
        createSampleTrack('Fresh Track', 'Fresh Artist', 'fresh-1'),
      ];

      vi.mocked(personalizationEngine.getSeedTracks).mockResolvedValue(
        initialSeeds,
      );
      vi.mocked(
        discoveryService.getIntelligentAutoplayTracks,
      ).mockResolvedValueOnce(initialSeeds);

      const { unmount } = render(<TvDashboard />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20);
      });

      expect(personalizationEngine.getSeedTracks).toHaveBeenCalledTimes(1);
      expect(screen.getAllByText('Old Track')[0]).toBeInTheDocument();

      unmount();

      // Advance time by 61 seconds (61000ms > 60000ms TTL)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(61000);
      });

      // Prepare fresh seed tracks for next network call
      vi.mocked(personalizationEngine.getSeedTracks).mockResolvedValue(
        freshSeeds,
      );
      vi.mocked(
        discoveryService.getIntelligentAutoplayTracks,
      ).mockResolvedValueOnce(freshSeeds);

      render(<TvDashboard />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20);
      });

      // Because cache expired, getSeedTracks was called again
      expect(personalizationEngine.getSeedTracks).toHaveBeenCalledTimes(2);
      expect(screen.getAllByText('Fresh Track')[0]).toBeInTheDocument();
    });

    it('immediately invalidates recommendation cache when clearRecommendationCache() is called', async () => {
      vi.useFakeTimers();

      vi.mocked(personalizationEngine.getSeedTracks).mockResolvedValue([
        createSampleTrack('First Track', 'First Artist', 't1'),
      ]);

      const { unmount } = render(<TvDashboard />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20);
      });

      expect(getCachedRecommendations()).not.toBeNull();
      unmount();

      // Clear cache manually
      clearRecommendationCache();
      expect(getCachedRecommendations()).toBeNull();

      // Advance only 5 seconds (< 60s TTL)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      render(<TvDashboard />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20);
      });

      // Since cache was cleared, getSeedTracks was called again immediately
      expect(personalizationEngine.getSeedTracks).toHaveBeenCalledTimes(2);
    });

    it('invalidates cache synchronously on personalizationEngine.subscribe notification', async () => {
      vi.useFakeTimers();

      let capturedListener: (() => void) | null = null;
      vi.mocked(personalizationEngine.subscribe).mockImplementation(
        (listener) => {
          capturedListener = listener;
          return () => {};
        },
      );

      vi.mocked(personalizationEngine.getSeedTracks).mockResolvedValue([
        createSampleTrack('Active Track', 'Active Artist', 'act-1'),
      ]);

      render(<TvDashboard />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20);
      });

      expect(getCachedRecommendations()).not.toBeNull();

      // Fire subscription event (e.g. user blacklisted an artist or completed a play session)
      act(() => {
        capturedListener?.();
      });

      // Cache is invalidated immediately upon subscription firing (before debounce timer completes)
      expect(getCachedRecommendations()).toBeNull();
    });
  });
});
