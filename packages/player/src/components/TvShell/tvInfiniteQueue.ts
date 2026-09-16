import type { Track } from '@aurora/model';

import { Logger } from '../../services/logger';
import { metadataHost } from '../../services/metadataHost';
import { playbackManager } from '../../services/playback';
import { useQueueStore } from '../../stores/queueStore';
import { useSoundStore } from '../../stores/soundStore';
import { POPULAR_TV_PLAYLISTS, TV_MOOD_CAPSULES } from './TvDashboard';

const MIN_REMAINING_THRESHOLD = 3;
const TARGET_FETCH_LIMIT = 15;
const MAX_BATCH_ADD = 10;
const SEARCH_PER_QUERY_LIMIT = 10;

let isReplenishing = false;
let moodCycleIndex = 0;

const createTrackKey = (track: Track): string => {
  const sourceId = track.source?.id?.toLowerCase().trim();
  if (sourceId) {
    return sourceId;
  }
  const artist = (track.artists?.[0]?.name ?? '').toLowerCase().trim();
  const title = (track.title ?? '').toLowerCase().trim();
  return `${artist}:::${title}`;
};

export const replenishTvQueue = async (): Promise<Track[]> => {
  if (isReplenishing) {
    return [];
  }

  isReplenishing = true;
  try {
    const queueState = useQueueStore.getState();
    const existingItems = queueState.items;
    const currentIndex = queueState.currentIndex;

    const existingKeys = new Set<string>();
    for (const item of existingItems) {
      existingKeys.add(createTrackKey(item.track));
    }

    const currentTrack =
      existingItems[currentIndex]?.track ??
      existingItems[existingItems.length - 1]?.track;
    const currentArtist = currentTrack?.artists?.[0]?.name?.trim();
    const currentTitle = currentTrack?.title?.trim();

    const searchQueries: string[] = [];

    if (currentArtist) {
      searchQueries.push(`${currentArtist} radio`);
      searchQueries.push(`${currentArtist} hits`);
    }

    if (currentArtist && currentTitle) {
      searchQueries.push(`${currentArtist} ${currentTitle} mix`);
    }

    const moodFallback =
      TV_MOOD_CAPSULES[moodCycleIndex % TV_MOOD_CAPSULES.length];
    const playlistFallback =
      POPULAR_TV_PLAYLISTS[moodCycleIndex % POPULAR_TV_PLAYLISTS.length];
    moodCycleIndex += 1;

    if (playlistFallback?.query) {
      searchQueries.push(playlistFallback.query);
    }
    if (moodFallback?.query) {
      searchQueries.push(moodFallback.query);
    }
    searchQueries.push('Trending Music Global', 'Top Pop Hits');

    const discoveredTracks: Track[] = [];

    for (const query of searchQueries) {
      if (discoveredTracks.length >= TARGET_FETCH_LIMIT) {
        break;
      }
      try {
        const response = await metadataHost.search({
          query,
          types: ['tracks'],
          limit: SEARCH_PER_QUERY_LIMIT,
        });

        if (response.tracks && Array.isArray(response.tracks)) {
          for (const track of response.tracks) {
            const key = createTrackKey(track);
            if (!existingKeys.has(key)) {
              existingKeys.add(key);
              discoveredTracks.push(track);
            }
          }
        }
      } catch (searchError) {
        Logger.streaming.warn(
          `TvInfiniteQueue: Search query "${query}" failed: ${searchError}`,
        );
      }
    }

    if (discoveredTracks.length > 0) {
      const toAdd = discoveredTracks.slice(0, MAX_BATCH_ADD);
      useQueueStore.getState().addToQueue(toAdd);
      Logger.streaming.info(
        `TvInfiniteQueue: Replenished queue with ${toAdd.length} fresh tracks. Total queue length: ${useQueueStore.getState().items.length}`,
      );
      return toAdd;
    }

    if (existingItems.length > 0) {
      const recycledTracks = existingItems.map((item) => item.track);
      useQueueStore.getState().addToQueue(recycledTracks);
      Logger.streaming.info(
        `TvInfiniteQueue: Recycled ${recycledTracks.length} tracks into queue to preserve infinite playback.`,
      );
      return recycledTracks;
    }

    return [];
  } finally {
    isReplenishing = false;
  }
};

export const checkTvQueueThreshold = (): void => {
  const { items, currentIndex } = useQueueStore.getState();
  if (items.length === 0) {
    return;
  }
  const remainingAhead = items.length - 1 - currentIndex;
  if (remainingAhead <= MIN_REMAINING_THRESHOLD) {
    void replenishTvQueue();
  }
};

export const playNextInInfiniteQueue = async (): Promise<void> => {
  const { items, currentIndex } = useQueueStore.getState();
  if (currentIndex >= items.length - 1) {
    await replenishTvQueue();
  }
  await playbackManager.finishTrack();
};

export const initTvInfiniteQueue = (): (() => void) => {
  const checkUpcoming = () => {
    checkTvQueueThreshold();
  };

  const unsubQueue = useQueueStore.subscribe((state, previousState) => {
    if (
      state.currentIndex !== previousState.currentIndex ||
      state.items.length !== previousState.items.length
    ) {
      checkUpcoming();
    }
  });

  const unsubSound = useSoundStore.subscribe((state, previousState) => {
    if (state.status === 'playing' && previousState.status !== 'playing') {
      checkUpcoming();
    }
  });

  checkUpcoming();

  return () => {
    unsubQueue();
    unsubSound();
  };
};
