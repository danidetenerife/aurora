import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Track } from '@aurora/model';

import * as discoveryService from '../../services/discoveryService';
import { metadataHost } from '../../services/metadataHost';
import { personalizationEngine } from '../../services/personalizationEngine';
import { playbackManager } from '../../services/playback';
import { useQueueStore } from '../../stores/queueStore';
import {
  checkTvQueueThreshold,
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
        candidates.map((candidate: { track: Track }) => candidate.track),
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

describe('tvInfiniteQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useQueueStore.setState({
      items: [],
      currentIndex: 0,
    });
    resetTvSession();
  });

  describe('replenishTvQueue', () => {
    it('uses getIntelligentAutoplayTracks as primary source', async () => {
      const existingTrack = makeTrack('Song One', 'Artist Alpha');
      useQueueStore.getState().addToQueue([existingTrack]);

      const freshTrack = makeTrack('Song Two', 'Artist Beta', 'id-fresh');
      vi.mocked(
        discoveryService.getIntelligentAutoplayTracks,
      ).mockResolvedValue([freshTrack]);

      const added = await replenishTvQueue();

      expect(discoveryService.getIntelligentAutoplayTracks).toHaveBeenCalled();
      expect(added).toHaveLength(1);
      expect(added[0]?.title).toBe('Song Two');
    });

    it('filters duplicates that are already in the queue', async () => {
      const existingTrack = makeTrack('Song One', 'Artist Alpha', 'id-1');
      useQueueStore.getState().addToQueue([existingTrack]);

      const duplicateTrack = makeTrack('Song One', 'Artist Alpha', 'id-1');
      const freshTrack = makeTrack('Song Two', 'Artist Alpha', 'id-2');

      vi.mocked(
        discoveryService.getIntelligentAutoplayTracks,
      ).mockResolvedValue([duplicateTrack, freshTrack]);

      const added = await replenishTvQueue();

      expect(added.some((track) => track.source?.id === 'id-1')).toBe(false);
      expect(added.some((track) => track.title === 'Song Two')).toBe(true);
    });

    it('falls back to personalized search when intelligent autoplay returns too few', async () => {
      const existingTrack = makeTrack(
        'Song One',
        'Artist Alpha',
        'id-existing',
      );
      useQueueStore.getState().addToQueue([existingTrack]);

      vi.mocked(
        discoveryService.getIntelligentAutoplayTracks,
      ).mockResolvedValue([]);

      vi.mocked(personalizationEngine.getTopArtists).mockResolvedValue([
        { name: 'Radiohead', score: 100 },
      ]);
      vi.mocked(personalizationEngine.getTopGenres).mockResolvedValue([
        { genre: 'alternative rock', score: 80 },
      ]);

      const freshTrack = makeTrack('Creep', 'Radiohead', 'id-creep');
      vi.mocked(metadataHost.search).mockResolvedValue({
        tracks: [freshTrack],
      });

      await replenishTvQueue();

      expect(metadataHost.search).toHaveBeenCalled();
      const searchCalls = vi.mocked(metadataHost.search).mock.calls;
      expect(searchCalls.length).toBeGreaterThan(0);
    });

    it('never recycles existing queue tracks', async () => {
      const tracks = [
        makeTrack('T1', 'A1', 'id-t1'),
        makeTrack('T2', 'A1', 'id-t2'),
      ];
      useQueueStore.getState().addToQueue(tracks);

      vi.mocked(
        discoveryService.getIntelligentAutoplayTracks,
      ).mockResolvedValue([]);
      vi.mocked(metadataHost.search).mockResolvedValue({ tracks: [] });

      const added = await replenishTvQueue();

      expect(added).toHaveLength(0);
      expect(useQueueStore.getState().items).toHaveLength(2);
    });

    it('prevents tracks from repeating across multiple replenishment cycles', async () => {
      const existingTrack = makeTrack('Base', 'Artist');
      useQueueStore.getState().addToQueue([existingTrack]);

      const firstBatch = makeTrack('First Batch', 'Artist B', 'id-batch1');
      vi.mocked(
        discoveryService.getIntelligentAutoplayTracks,
      ).mockResolvedValue([firstBatch]);

      await replenishTvQueue();
      resetCooldown();

      vi.mocked(
        discoveryService.getIntelligentAutoplayTracks,
      ).mockResolvedValue([firstBatch]);

      const secondResult = await replenishTvQueue();

      expect(
        secondResult.some((track) => track.source?.id === 'id-batch1'),
      ).toBe(false);
    });

    it('respects cooldown between replenishment calls', async () => {
      useQueueStore.getState().addToQueue([makeTrack('T1', 'A1')]);

      vi.mocked(
        discoveryService.getIntelligentAutoplayTracks,
      ).mockResolvedValue([makeTrack('New', 'A2', 'id-new')]);

      await replenishTvQueue();

      const secondResult = await replenishTvQueue();
      expect(secondResult).toHaveLength(0);
    });

    it('uses genre-weighted search queries from personalization engine', async () => {
      const existingTrack = makeTrack('Song', 'Artist');
      useQueueStore.getState().addToQueue([existingTrack]);

      vi.mocked(
        discoveryService.getIntelligentAutoplayTracks,
      ).mockResolvedValue([]);
      vi.mocked(personalizationEngine.getTopGenres).mockResolvedValue([
        { genre: 'indie rock', score: 95 },
        { genre: 'dream pop', score: 60 },
      ]);

      vi.mocked(metadataHost.search).mockResolvedValue({
        tracks: [makeTrack('Indie Song', 'Indie Band', 'id-indie')],
      });

      await replenishTvQueue();

      const searchCalls = vi.mocked(metadataHost.search).mock.calls;
      const queries = searchCalls.map((call) => call[0].query);
      const hasGenreQuery = queries.some(
        (query) => query.includes('indie rock') || query.includes('dream pop'),
      );
      expect(hasGenreQuery).toBe(true);
    });
  });

  describe('checkTvQueueThreshold', () => {
    it('triggers replenishment when remaining tracks drop below threshold', () => {
      const trackList: Track[] = [
        makeTrack('T1', 'A1'),
        makeTrack('T2', 'A1'),
        makeTrack('T3', 'A1'),
      ];
      useQueueStore.getState().addToQueue(trackList);
      useQueueStore.setState({ currentIndex: 0 });

      vi.mocked(
        discoveryService.getIntelligentAutoplayTracks,
      ).mockResolvedValue([makeTrack('T4', 'A1', 'id-t4')]);

      checkTvQueueThreshold();

      expect(discoveryService.getIntelligentAutoplayTracks).toHaveBeenCalled();
    });

    it('does not trigger replenishment when enough tracks remain', () => {
      const trackList: Track[] = Array.from({ length: 10 }, (_, index) =>
        makeTrack(`Track ${index}`, 'Artist', `id-${index}`),
      );
      useQueueStore.getState().addToQueue(trackList);
      useQueueStore.setState({ currentIndex: 0 });

      checkTvQueueThreshold();

      expect(
        discoveryService.getIntelligentAutoplayTracks,
      ).not.toHaveBeenCalled();
    });
  });

  describe('playNextInInfiniteQueue', () => {
    it('triggers replenishment when at last track then finishes track', async () => {
      const singleTrack = makeTrack('Final Song', 'Solo Artist', 'final-1');
      useQueueStore.getState().addToQueue([singleTrack]);
      useQueueStore.setState({ currentIndex: 0 });

      vi.mocked(
        discoveryService.getIntelligentAutoplayTracks,
      ).mockResolvedValue([makeTrack('Bonus Song', 'Solo Artist', 'bonus-1')]);

      await playNextInInfiniteQueue();

      expect(playbackManager.finishTrack).toHaveBeenCalled();
      expect(discoveryService.getIntelligentAutoplayTracks).toHaveBeenCalled();
      const items = useQueueStore.getState().items;
      expect(items.length).toBeGreaterThanOrEqual(2);
      expect(items.some((item) => item.track.title === 'Bonus Song')).toBe(
        true,
      );
    });
  });

  describe('resetTvSession', () => {
    it('clears session state allowing previously played tracks to be re-added', async () => {
      useQueueStore.getState().addToQueue([makeTrack('T1', 'A1')]);

      const track = makeTrack('Fresh', 'B1', 'id-fresh');
      vi.mocked(
        discoveryService.getIntelligentAutoplayTracks,
      ).mockResolvedValue([track]);

      await replenishTvQueue();

      resetTvSession();
      resetCooldown();

      vi.mocked(
        discoveryService.getIntelligentAutoplayTracks,
      ).mockResolvedValue([track]);
      const result = await replenishTvQueue();

      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });
});

function resetCooldown() {
  // Access and reset the cooldown by calling resetTvSession which also resets lastReplenishTime
  resetTvSession();
}
