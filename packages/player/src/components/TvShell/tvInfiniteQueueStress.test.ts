import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Track } from '@aurora/model';

import * as discoveryService from '../../services/discoveryService';
import { metadataHost } from '../../services/metadataHost';
import { personalizationEngine } from '../../services/personalizationEngine';
import { playbackManager } from '../../services/playback';
import { useFavoritesStore } from '../../stores/favoritesStore';
import { usePlaylistStore } from '../../stores/playlistStore';
import { useQueueStore } from '../../stores/queueStore';
import { useSoundStore } from '../../stores/soundStore';
import {
  checkTvQueueThreshold,
  initTvInfiniteQueue,
  playNextInInfiniteQueue,
  replenishTvQueue,
  resetTvSession,
} from './tvInfiniteQueue';

vi.mock('../../services/metadataHost', () => ({
  metadataHost: {
    search: vi.fn(),
  },
}));

vi.mock('../../services/playback', () => ({
  playbackManager: {
    finishTrack: vi.fn(),
  },
}));

vi.mock('../../services/personalizationEngine', () => ({
  personalizationEngine: {
    getTopArtists: vi.fn().mockResolvedValue([]),
    getTopGenres: vi.fn().mockResolvedValue([]),
    getBlacklist: vi.fn().mockResolvedValue({ tracks: [], artists: [] }),
    getSeedTracks: vi.fn().mockResolvedValue([]),
    getListenRecords: vi.fn().mockResolvedValue([]),
    resolveArtistMetadata: vi.fn().mockResolvedValue({ genres: [] }),
    scoreAndRankTracks: vi
      .fn()
      .mockImplementation((candidates) =>
        candidates.map((c: { track: Track }) => c.track),
      ),
  },
}));

vi.mock('../../services/discoveryService', async () => {
  const actual = await vi.importActual<typeof discoveryService>(
    '../../services/discoveryService',
  );
  return {
    ...actual,
    getIntelligentAutoplayTracks: vi.fn().mockResolvedValue([]),
  };
});

const makeTrack = (title: string, artist: string, id?: string): Track => ({
  title,
  artists: [{ name: artist, roles: [] }],
  source: {
    provider: 'test',
    id: id ?? `id-${title.toLowerCase().replace(/\s/g, '-')}`,
  },
});

describe('tvInfiniteQueue - Empirical Stress & Adversarial Challenge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useQueueStore.setState({
      items: [],
      currentIndex: 0,
    });
    useFavoritesStore.setState({ tracks: [], artists: [], albums: [] });
    usePlaylistStore.setState({ playlists: new Map() });
    useSoundStore.setState({ status: 'stopped', seek: 0, duration: 0 });
    resetTvSession();
  });

  describe('1. Fallback Query Isolation (No Generic Chart Fallback When User Signals Exist)', () => {
    let capturedSearchQueries: string[] = [];

    beforeEach(() => {
      capturedSearchQueries = [];
      vi.mocked(metadataHost.search).mockImplementation(
        ({ query }: { query: string }) => {
          capturedSearchQueries.push(query);
          return Promise.resolve({ tracks: [] });
        },
      );
      vi.mocked(
        discoveryService.getIntelligentAutoplayTracks,
      ).mockResolvedValue([]);
    });

    it('NEVER searches generic pop charts when user has playlists', async () => {
      const playlistMap = new Map();
      playlistMap.set('synth-1', {
        id: 'synth-1',
        name: 'Cyberpunk Synthwave 2077',
        items: [
          {
            id: 'item-1',
            track: makeTrack('Resonance', 'HOME'),
          },
        ],
      });
      usePlaylistStore.setState({ playlists: playlistMap });

      // Queue has a track by an artist
      useQueueStore
        .getState()
        .addToQueue([makeTrack('Start Track', 'Initial Artist')]);

      await replenishTvQueue(true);

      expect(capturedSearchQueries.length).toBeGreaterThan(0);
      expect(capturedSearchQueries).not.toContain("Today's Top Hits");
      expect(capturedSearchQueries).not.toContain('Top 50 Global');
      expect(capturedSearchQueries).not.toContain('Billboard Hot 100');
    });

    it('NEVER searches generic pop charts when user has favorite tracks', async () => {
      useFavoritesStore.setState({
        tracks: [
          {
            id: 'fav-1',
            ref: {
              title: 'Paranoid Android',
              artists: [{ name: 'Radiohead', roles: [] }],
              source: { provider: 'test', id: 'radiohead-1' },
            },
            type: 'track',
          },
        ],
        artists: [],
        albums: [],
      });

      useQueueStore
        .getState()
        .addToQueue([makeTrack('Start Track', 'Initial Artist')]);

      await replenishTvQueue(true);

      expect(capturedSearchQueries.length).toBeGreaterThan(0);
      expect(capturedSearchQueries).not.toContain("Today's Top Hits");
      expect(capturedSearchQueries).not.toContain('Top 50 Global');
      expect(capturedSearchQueries).not.toContain('Billboard Hot 100');
    });

    it('NEVER searches generic pop charts when user has favorite artists', async () => {
      useFavoritesStore.setState({
        tracks: [],
        artists: [
          {
            id: 'fav-artist-1',
            ref: {
              name: 'Daft Punk',
              source: { provider: 'test', id: 'daft-punk' },
            },
            type: 'artist',
          },
        ],
        albums: [],
      });

      // Track artist is blacklisted or empty to force fallback query derivation
      vi.mocked(personalizationEngine.getBlacklist).mockResolvedValue({
        tracks: [],
        artists: ['initial artist'],
      });
      useQueueStore
        .getState()
        .addToQueue([makeTrack('Start Track', 'Initial Artist')]);

      await replenishTvQueue(true);

      expect(capturedSearchQueries.length).toBeGreaterThan(0);
      expect(capturedSearchQueries).not.toContain("Today's Top Hits");
      expect(capturedSearchQueries).not.toContain('Top 50 Global');
      expect(capturedSearchQueries).not.toContain('Billboard Hot 100');
      expect(capturedSearchQueries).toContain('Daft Punk radio');
    });

    it('queries generic chart fallbacks ONLY when user profile is completely blank and current artist is blacklisted', async () => {
      useFavoritesStore.setState({ tracks: [], artists: [], albums: [] });
      usePlaylistStore.setState({ playlists: new Map() });
      vi.mocked(personalizationEngine.getTopArtists).mockResolvedValue([]);
      vi.mocked(personalizationEngine.getTopGenres).mockResolvedValue([]);
      vi.mocked(personalizationEngine.getBlacklist).mockResolvedValue({
        tracks: [],
        artists: ['initial artist'],
      });

      useQueueStore
        .getState()
        .addToQueue([makeTrack('Start Track', 'Initial Artist')]);

      await replenishTvQueue(true);

      expect(capturedSearchQueries).toContain("Today's Top Hits");
      expect(capturedSearchQueries).toContain('Top 50 Global');
      expect(capturedSearchQueries).toContain('Billboard Hot 100');
    });
  });

  describe('2. Rapid Playback Skips & Concurrency Stress Test', () => {
    it('handles 20 rapid skips in succession without uncaught errors or deadlocks', async () => {
      const initialTracks = Array.from({ length: 6 }, (_, i) =>
        makeTrack(`Track ${i}`, `Artist ${i}`, `id-${i}`),
      );
      useQueueStore.getState().addToQueue(initialTracks);

      let fetchCallCount = 0;
      vi.mocked(
        discoveryService.getIntelligentAutoplayTracks,
      ).mockImplementation(async () => {
        fetchCallCount++;
        // Simulate async delay
        await new Promise((resolve) => setTimeout(resolve, 5));
        return [
          makeTrack(`Replenished ${fetchCallCount}-A`, 'Replenished Artist'),
          makeTrack(`Replenished ${fetchCallCount}-B`, 'Replenished Artist'),
        ];
      });

      const cleanup = initTvInfiniteQueue();

      // Fire 20 rapid skips in parallel / rapid microtasks
      const skipPromises: Promise<void>[] = [];
      for (let i = 0; i < 20; i++) {
        skipPromises.push(playNextInInfiniteQueue());
        // Also fire threshold checks concurrently
        checkTvQueueThreshold();
      }

      await Promise.all(skipPromises);

      // Give event loop time to settle async replenishments
      await new Promise((resolve) => setTimeout(resolve, 50));

      const finalState = useQueueStore.getState();
      expect(finalState.items.length).toBeGreaterThan(0);
      expect(playbackManager.finishTrack).toHaveBeenCalledTimes(20);

      cleanup();
    });

    it('avoids duplicate concurrent replenishments while an async fetch is in-flight', async () => {
      useQueueStore
        .getState()
        .addToQueue([makeTrack('Solo Track', 'Solo Artist')]);

      let resolveAutoplay: (tracks: Track[]) => void;
      const autoplayPromise = new Promise<Track[]>((resolve) => {
        resolveAutoplay = resolve;
      });

      vi.mocked(discoveryService.getIntelligentAutoplayTracks).mockReturnValue(
        autoplayPromise,
      );

      // Launch 5 concurrent urgent replenishments
      const p1 = replenishTvQueue(true);
      const p2 = replenishTvQueue(true);
      const p3 = replenishTvQueue(true);
      const p4 = replenishTvQueue(true);
      const p5 = replenishTvQueue(true);

      // Resolve the first call, which concurrent callers also await via activeReplenishPromise
      resolveAutoplay!([makeTrack('Added Track', 'Added Artist', 'id-added')]);
      const [r1, r2, r3, r4, r5] = await Promise.all([p1, p2, p3, p4, p5]);

      expect(r1).toHaveLength(1);
      expect(r1[0]?.title).toBe('Added Track');
      expect(r2).toBe(r1);
      expect(r3).toBe(r1);
      expect(r4).toBe(r1);
      expect(r5).toBe(r1);
      expect(
        discoveryService.getIntelligentAutoplayTracks,
      ).toHaveBeenCalledTimes(1);
    });

    it('never adds duplicate tracks across successive rapid replenishments', async () => {
      useQueueStore
        .getState()
        .addToQueue([makeTrack('Track 1', 'Artist 1', 'id-1')]);

      const candidateTrack = makeTrack('Same Track', 'Same Artist', 'id-same');
      vi.mocked(
        discoveryService.getIntelligentAutoplayTracks,
      ).mockResolvedValue([candidateTrack]);

      // First replenish adds it
      const firstBatch = await replenishTvQueue(true);
      expect(firstBatch).toHaveLength(1);

      // Second replenish with same candidate must filter it out because it's now in sessionPlayedIds and queue
      const secondBatch = await replenishTvQueue(true);
      expect(secondBatch).toHaveLength(0);

      // Ensure queue only has Track 1 and Same Track once
      const queueItems = useQueueStore.getState().items;
      const sameTrackCount = queueItems.filter(
        (item) => item.track.source?.id === 'id-same',
      ).length;
      expect(sameTrackCount).toBe(1);
    });
  });

  describe('3. Resilience to Provider Failures in TV Mode', () => {
    it('handles metadataHost.search throwing exception during search fallback', async () => {
      useQueueStore
        .getState()
        .addToQueue([makeTrack('Current Song', 'Current Artist')]);
      vi.mocked(
        discoveryService.getIntelligentAutoplayTracks,
      ).mockRejectedValue(new Error('Autoplay service crashed'));
      vi.mocked(metadataHost.search).mockRejectedValue(
        new Error('Search provider connection refused'),
      );

      // Should not throw
      const result = await replenishTvQueue(true);
      expect(result).toEqual([]);
    });

    it('handles metadataHost.search returning undefined tracks object', async () => {
      useQueueStore
        .getState()
        .addToQueue([makeTrack('Current Song', 'Current Artist')]);
      vi.mocked(
        discoveryService.getIntelligentAutoplayTracks,
      ).mockResolvedValue([]);
      vi.mocked(metadataHost.search).mockResolvedValue({
        tracks: undefined as unknown as Track[],
      });

      // Should not throw TypeError
      await expect(replenishTvQueue(true)).resolves.toEqual([]);
    });
  });

  describe('4. Dislike Blacklisting & Queue Pruning in TV Mode', () => {
    it('dislike correctly prunes upcoming tracks by same artist from queue', () => {
      const track1 = makeTrack('Track 1', 'Annoying Artist', 'id-1');
      const track2 = makeTrack('Track 2', 'Great Artist', 'id-2');
      const track3 = makeTrack('Track 3', 'Annoying Artist', 'id-3');
      const track4 = makeTrack('Track 4', 'Another Artist', 'id-4');

      useQueueStore.getState().addToQueue([track1, track2, track3, track4]);
      useQueueStore.setState({ currentIndex: 0 });

      // Simulate what TvNowPlayingBar dislike handler does:
      const currentTrack = track1;
      const trackId = currentTrack.source.id;
      const artistName = currentTrack.artists[0]?.name;
      const normalizedArtist = artistName
        ? artistName.trim().toLowerCase()
        : '';

      const queueState = useQueueStore.getState();
      const upcomingItems = queueState.items.slice(queueState.currentIndex + 1);
      const idsToRemove = upcomingItems
        .filter((item) => {
          const itemTrackId =
            item.track.source?.id ||
            `${item.track.artists?.[0]?.name}-${item.track.title}`;
          if (itemTrackId === trackId) {
            return true;
          }
          if (
            normalizedArtist &&
            item.track.artists?.some(
              (artist) => artist.name.trim().toLowerCase() === normalizedArtist,
            )
          ) {
            return true;
          }
          return false;
        })
        .map((item) => item.id);

      expect(idsToRemove.length).toBe(1); // Track 3 by Annoying Artist
      queueState.removeByIds(idsToRemove);

      const remainingTitles = useQueueStore
        .getState()
        .items.map((i) => i.track.title);
      expect(remainingTitles).toContain('Track 1'); // Currently playing
      expect(remainingTitles).toContain('Track 2');
      expect(remainingTitles).not.toContain('Track 3'); // Pruned!
      expect(remainingTitles).toContain('Track 4');
    });
  });
});
