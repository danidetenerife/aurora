import type { Track } from '@aurora/model';

import {
  getIntelligentAutoplayTracks,
  isTrackInSet,
  registerTrackInSet,
  resetDiscoverySession,
} from '../../services/discoveryService';
import { Logger } from '../../services/logger';
import { metadataHost } from '../../services/metadataHost';
import { personalizationEngine } from '../../services/personalizationEngine';
import { playbackManager } from '../../services/playback';
import { useQueueStore } from '../../stores/queueStore';
import { useSoundStore } from '../../stores/soundStore';

const MIN_REMAINING_THRESHOLD = 5;
const TARGET_FETCH_LIMIT = 25;
const MAX_BATCH_ADD = 15;
const SEARCH_PER_QUERY_LIMIT = 12;
const COOLDOWN_MS = 8_000;
const URGENT_REMAINING_THRESHOLD = 1;

let isReplenishing = false;
let lastReplenishTime = 0;

const sessionPlayedIds = new Set<string>();

const buildPersonalizedQueries = async (
  currentTrack: Track | undefined,
): Promise<string[]> => {
  const queries: string[] = [];

  try {
    const [topArtists, topGenres, blacklist] = await Promise.all([
      personalizationEngine.getTopArtists(),
      personalizationEngine.getTopGenres(5),
      personalizationEngine.getBlacklist(),
    ]);

    const blacklistedArtists = new Set(
      blacklist.artists.map((artist) => artist.toLowerCase().trim()),
    );

    const currentArtist = currentTrack?.artists?.[0]?.name?.trim();

    if (currentArtist && !blacklistedArtists.has(currentArtist.toLowerCase())) {
      queries.push(`${currentArtist} radio`);

      const relatedArtists = topArtists
        .filter(
          (artist) =>
            artist.name.toLowerCase() !== currentArtist.toLowerCase() &&
            !blacklistedArtists.has(artist.name.toLowerCase()),
        )
        .slice(0, 2);

      for (const related of relatedArtists) {
        queries.push(`${related.name} best songs`);
      }
    }

    for (const genreScore of topGenres.slice(0, 3)) {
      queries.push(`${genreScore.genre} hits`);
    }

    if (topArtists.length > 0) {
      const nonBlacklisted = topArtists.filter(
        (artist) => !blacklistedArtists.has(artist.name.toLowerCase()),
      );
      if (nonBlacklisted.length > 0) {
        const randomIndex = Math.floor(
          Math.random() * Math.min(nonBlacklisted.length, 8),
        );
        const randomArtist = nonBlacklisted[randomIndex];
        if (randomArtist) {
          queries.push(`${randomArtist.name} mix`);
        }
      }
    }
  } catch {
    Logger.streaming.warn(
      'TvInfiniteQueue: Failed to build personalized queries, using fallback',
    );
  }

  if (queries.length === 0) {
    queries.push("Today's Top Hits", 'Top 50 Global', 'Billboard Hot 100');
  }

  return queries;
};

const searchForFreshTracks = async (
  queries: string[],
  existingKeys: Set<string>,
): Promise<Track[]> => {
  const discoveredTracks: Track[] = [];
  const searchDiscoveredKeys = new Set<string>();

  for (const query of queries) {
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
          if (
            !isTrackInSet(track, existingKeys) &&
            !isTrackInSet(track, sessionPlayedIds) &&
            !isTrackInSet(track, searchDiscoveredKeys)
          ) {
            registerTrackInSet(track, searchDiscoveredKeys);
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

  return discoveredTracks;
};

export const replenishTvQueue = async (urgent = false): Promise<Track[]> => {
  const now = Date.now();
  const timeSinceLastReplenish = now - lastReplenishTime;
  const cooldownActive = timeSinceLastReplenish < COOLDOWN_MS;

  if (isReplenishing) {
    return [];
  }

  if (cooldownActive && !urgent) {
    return [];
  }

  isReplenishing = true;
  lastReplenishTime = now;
  try {
    const queueState = useQueueStore.getState();
    const existingItems = queueState.items;
    const currentIndex = queueState.currentIndex;

    const existingKeys = new Set<string>();
    for (const item of existingItems) {
      registerTrackInSet(item.track, existingKeys);
      registerTrackInSet(item.track, sessionPlayedIds);
    }

    const currentTrack =
      existingItems[currentIndex]?.track ??
      existingItems[existingItems.length - 1]?.track;

    const contextTracks = existingItems
      .slice(Math.max(0, currentIndex - 10), currentIndex + 1)
      .map((item) => item.track);

    let recommended: Track[] = [];

    try {
      recommended = await getIntelligentAutoplayTracks(
        contextTracks,
        existingKeys,
        MAX_BATCH_ADD,
      );

      recommended = recommended.filter(
        (track) => !isTrackInSet(track, sessionPlayedIds),
      );
    } catch (error) {
      Logger.streaming.warn(
        `TvInfiniteQueue: Intelligent autoplay failed: ${error}`,
      );
    }

    if (recommended.length < 5) {
      try {
        const blacklist = await personalizationEngine.getBlacklist();
        const blacklistedArtists = new Set(
          blacklist.artists.map((artist) => artist.toLowerCase().trim()),
        );
        const blacklistedTrackIds = new Set(blacklist.tracks);

        const queries = await buildPersonalizedQueries(currentTrack);
        const searchResults = await searchForFreshTracks(queries, existingKeys);

        const filteredSearch = searchResults.filter((track) => {
          const artistName = (track.artists?.[0]?.name ?? '')
            .toLowerCase()
            .trim();
          const trackSourceId = track.source?.id ?? '';

          if (blacklistedArtists.has(artistName)) {
            return false;
          }
          if (trackSourceId && blacklistedTrackIds.has(trackSourceId)) {
            return false;
          }
          if (isTrackInSet(track, existingKeys)) {
            return false;
          }
          return true;
        });

        recommended = [...recommended, ...filteredSearch].slice(
          0,
          MAX_BATCH_ADD,
        );
      } catch (searchFallbackError) {
        Logger.streaming.warn(
          `TvInfiniteQueue: Search fallback failed: ${searchFallbackError}`,
        );
      }
    }

    if (recommended.length > 0) {
      for (const track of recommended) {
        registerTrackInSet(track, sessionPlayedIds);
      }

      useQueueStore.getState().addToQueue(recommended);
      Logger.streaming.info(
        `TvInfiniteQueue: Replenished queue with ${recommended.length} fresh tracks (total: ${useQueueStore.getState().items.length})`,
      );
      return recommended;
    }

    Logger.streaming.warn(
      'TvInfiniteQueue: No fresh tracks found. Queue will stop naturally instead of recycling.',
    );
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
  if (remainingAhead <= URGENT_REMAINING_THRESHOLD) {
    void replenishTvQueue(true);
  } else if (remainingAhead <= MIN_REMAINING_THRESHOLD) {
    void replenishTvQueue();
  }
};

export const playNextInInfiniteQueue = async (): Promise<void> => {
  const { items, currentIndex } = useQueueStore.getState();
  if (currentIndex >= items.length - 1) {
    await replenishTvQueue(true);
  }
  await playbackManager.finishTrack();
};

export const resetTvSession = (): void => {
  sessionPlayedIds.clear();
  resetDiscoverySession();
  lastReplenishTime = 0;
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
    resetTvSession();
  };
};
