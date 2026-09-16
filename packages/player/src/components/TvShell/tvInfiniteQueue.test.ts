import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Track } from '@aurora/model';

import { metadataHost } from '../../services/metadataHost';
import { playbackManager } from '../../services/playback';
import { useQueueStore } from '../../stores/queueStore';
import {
  checkTvQueueThreshold,
  playNextInInfiniteQueue,
  replenishTvQueue,
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

describe('tvInfiniteQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useQueueStore.setState({
      items: [],
      currentIndex: 0,
    });
  });

  it('replenishes queue with fresh tracks from search and filters duplicates', async () => {
    const existingTrack: Track = {
      title: 'Song One',
      artists: [{ name: 'Artist Alpha', roles: [] }],
      source: { provider: 'test', id: 'id-1' },
    };
    useQueueStore.getState().addToQueue([existingTrack]);

    const freshTrack1: Track = {
      title: 'Song Two',
      artists: [{ name: 'Artist Alpha', roles: [] }],
      source: { provider: 'test', id: 'id-2' },
    };
    const duplicateTrack: Track = {
      title: 'Song One',
      artists: [{ name: 'Artist Alpha', roles: [] }],
      source: { provider: 'test', id: 'id-1' },
    };

    vi.mocked(metadataHost.search).mockResolvedValue({
      tracks: [duplicateTrack, freshTrack1],
    });

    const added = await replenishTvQueue();

    expect(added).toHaveLength(1);
    expect(added[0]?.title).toBe('Song Two');
    expect(useQueueStore.getState().items).toHaveLength(2);
  });

  it('triggers replenishment when remaining tracks drop below threshold', async () => {
    const trackList: Track[] = [
      { title: 'T1', artists: [{ name: 'A1', roles: [] }] },
      { title: 'T2', artists: [{ name: 'A1', roles: [] }] },
    ];
    useQueueStore.getState().addToQueue(trackList);
    useQueueStore.setState({ currentIndex: 0 });

    vi.mocked(metadataHost.search).mockResolvedValue({
      tracks: [{ title: 'T3', artists: [{ name: 'A1', roles: [] }], source: { provider: 'test', id: 'id-3' } }],
    });

    checkTvQueueThreshold();

    expect(metadataHost.search).toHaveBeenCalled();
  });

  it('playNextInInfiniteQueue triggers replenishment when at last track', async () => {
    const singleTrack: Track = {
      title: 'Final Song',
      artists: [{ name: 'Solo Artist', roles: [] }],
      source: { provider: 'test', id: 'final-1' },
    };
    useQueueStore.getState().addToQueue([singleTrack]);
    useQueueStore.setState({ currentIndex: 0 });

    vi.mocked(metadataHost.search).mockResolvedValue({
      tracks: [{ title: 'Bonus Song', artists: [{ name: 'Solo Artist', roles: [] }], source: { provider: 'test', id: 'bonus-1' } }],
    });

    await playNextInInfiniteQueue();

    expect(playbackManager.finishTrack).toHaveBeenCalled();
    expect(useQueueStore.getState().items).toHaveLength(2);
  });
});
