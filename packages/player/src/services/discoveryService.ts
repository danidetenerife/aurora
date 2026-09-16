import { i18n } from '@aurora/i18n';
import type { Track, TrackRef } from '@aurora/model';
import type { MetadataProvider } from '@aurora/plugin-sdk';

import { useQueueStore } from '../stores/queueStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSoundStore } from '../stores/soundStore';
import { reportError } from '../utils/logging';
import { discoveryHost } from './discoveryHost';
import { eventBus } from './eventBus';
import { personalizationEngine } from './personalizationEngine';
import { providersHost } from './providersHost';

const CONTEXT_SIZE = 10;
const RECOMMENDATION_LIMIT = 5;

const sessionTrackIds = new Set<string>();
let isFetching = false;
let activeFetchPromise: Promise<Track[]> | null = null;

export const registerTrackInSet = (
  track: Track,
  targetSet: Set<string>,
): void => {
  if (track.source?.id) {
    targetSet.add(track.source.id.toLowerCase().trim());
  }
  const artist = (track.artists?.[0]?.name ?? '').toLowerCase().trim();
  const title = (track.title ?? '').toLowerCase().trim();
  if (title) {
    targetSet.add(`${artist}-${title}`);
  }
};

export const isTrackInSet = (
  track: Track,
  targetSet: Set<string>,
): boolean => {
  if (track.source?.id && targetSet.has(track.source.id.toLowerCase().trim())) {
    return true;
  }
  const artist = (track.artists?.[0]?.name ?? '').toLowerCase().trim();
  const title = (track.title ?? '').toLowerCase().trim();
  if (title && targetSet.has(`${artist}-${title}`)) {
    return true;
  }
  return false;
};

export const resetDiscoverySession = (): void => {
  sessionTrackIds.clear();
};

const trackRefToTrack = (ref: TrackRef): Track => ({
  title: ref.title,
  artists: ref.artists.map((artist) => ({
    name: artist.name,
    roles: [],
    source: artist.source,
  })),
  artwork: ref.artwork,
  source: ref.source,
});

type TaggedCandidate = {
  track: Track;
  source: 'topTracks' | 'related' | 'radio' | 'search';
};

export const getIntelligentAutoplayTracks = async (
  contextTracks: Track[],
  existingQueueIds: Set<string>,
  limit = RECOMMENDATION_LIMIT,
): Promise<Track[]> => {
  try {
    const [topArtists, topGenres, blacklist, seedTracks, listens] =
      await Promise.all([
        personalizationEngine.getTopArtists(),
        personalizationEngine.getTopGenres(5),
        personalizationEngine.getBlacklist(),
        personalizationEngine.getSeedTracks(5),
        personalizationEngine.getListenRecords(),
      ]);

    const metadataProviders = providersHost.list(
      'metadata',
    ) as MetadataProvider[];
    const activeMetaId = providersHost.getActive('metadata');
    const provider =
      metadataProviders.find(
        (providerItem) => providerItem.id === activeMetaId,
      ) ?? metadataProviders[0];

    if (!provider) {
      return [];
    }

    const candidates: TaggedCandidate[] = [];

    const recentArtistNames = Array.from(
      new Set(
        contextTracks
          .map((trackItem) => trackItem.artists?.[0]?.name)
          .filter((name): name is string => Boolean(name && name.trim())),
      ),
    ).slice(-3);

    for (const artistName of recentArtistNames) {
      try {
        const resolved =
          await personalizationEngine.resolveArtistMetadata(artistName);

        if (
          resolved.spotifyUri &&
          provider.fetchArtistRelatedArtists &&
          provider.fetchArtistTopTracks
        ) {
          const related = await provider.fetchArtistRelatedArtists(
            resolved.spotifyUri,
          );
          for (const relatedArtist of related.slice(0, 3)) {
            if (relatedArtist.source?.id) {
              const tracks = await provider.fetchArtistTopTracks(
                relatedArtist.source.id,
              );
              for (const trackRef of tracks.slice(0, 2)) {
                candidates.push({
                  track: trackRefToTrack(trackRef),
                  source: 'related',
                });
              }
            }
          }
        }

        if (resolved.spotifyUri && provider.fetchArtistTopTracks) {
          const tracks = await provider.fetchArtistTopTracks(
            resolved.spotifyUri,
          );
          for (const trackRef of tracks.slice(0, 3)) {
            candidates.push({
              track: trackRefToTrack(trackRef),
              source: 'topTracks',
            });
          }
        }
      } catch {
        // ignore
      }
    }

    if (provider.fetchArtistTopTracks) {
      for (const topArtist of topArtists.slice(0, 3)) {
        if (topArtist.spotifyUri) {
          try {
            const tracks = await provider.fetchArtistTopTracks(
              topArtist.spotifyUri,
            );
            for (const trackRef of tracks.slice(0, 3)) {
              candidates.push({
                track: trackRefToTrack(trackRef),
                source: 'topTracks',
              });
            }
          } catch {
            // ignore
          }
        }
      }
    }

    if (provider.search) {
      const searchQueries: string[] = [];

      for (const genreScore of topGenres.slice(0, 2)) {
        searchQueries.push(`${genreScore.genre} mix`);
      }

      const latestArtist =
        contextTracks[contextTracks.length - 1]?.artists?.[0]?.name;
      if (latestArtist) {
        searchQueries.push(`${latestArtist} radio`);
      }

      for (const seedTrack of seedTracks.slice(0, 2)) {
        searchQueries.push(
          `${seedTrack.title} ${seedTrack.artists?.[0]?.name ?? ''}`.trim(),
        );
      }

      if (searchQueries.length === 0) {
        searchQueries.push('Pop Hits', 'Trending Music');
      }

      for (const query of searchQueries.slice(0, 4)) {
        try {
          const searchResult = await provider.search({
            query,
            types: ['tracks'],
            limit: 6,
          });
          if (searchResult.tracks && Array.isArray(searchResult.tracks)) {
            for (const trackItem of searchResult.tracks) {
              candidates.push({ track: trackItem, source: 'search' });
            }
          }
        } catch {
          // ignore
        }
      }
    }

    const filtered = candidates.filter(({ track }) => {
      if (
        isTrackInSet(track, sessionTrackIds) ||
        isTrackInSet(track, existingQueueIds)
      ) {
        return false;
      }
      if (blacklist.tracks.includes(track.source?.id || '')) {
        return false;
      }
      const artist = (track.artists?.[0]?.name || '').toLowerCase().trim();
      if (blacklist.artists.includes(artist)) {
        return false;
      }
      return true;
    });

    const ranked = personalizationEngine.scoreAndRankTracks(
      filtered,
      topArtists,
      listens,
      blacklist,
    );

    const chosen = ranked.slice(0, limit);
    for (const trackItem of chosen) {
      registerTrackInSet(trackItem, sessionTrackIds);
      registerTrackInSet(trackItem, existingQueueIds);
    }

    return chosen;
  } catch {
    return [];
  }
};

export const ensureUpcomingTracks = async (
  urgent = false,
): Promise<Track[]> => {
  const isEnabled = useSettingsStore
    .getState()
    .getValue('core.playback.discovery');
  if (!isEnabled) {
    return [];
  }

  const { items, currentIndex } = useQueueStore.getState();
  if (items.length === 0) {
    return [];
  }

  const remainingAhead = items.length - 1 - currentIndex;
  if (!urgent && remainingAhead > 1) {
    return [];
  }

  if (isFetching && activeFetchPromise) {
    return activeFetchPromise;
  }

  isFetching = true;
  activeFetchPromise = (async () => {
    try {
      for (const queueItem of items) {
        registerTrackInSet(queueItem.track, sessionTrackIds);
      }

      const variety =
        (useSettingsStore
          .getState()
          .getValue('core.playback.discoveryVariety') as number) ?? 0.5;

      const playedItems = items.slice(0, currentIndex + 1);
      const contextTracks: Track[] = playedItems
        .slice(-CONTEXT_SIZE)
        .map((item) => item.track);

      const activeDiscoveryId = providersHost.getActive('discovery');
      const hasActiveDiscovery = Boolean(
        activeDiscoveryId && providersHost.get(activeDiscoveryId, 'discovery'),
      );

      const existingQueueIds = new Set<string>();
      for (const queueItem of items) {
        registerTrackInSet(queueItem.track, existingQueueIds);
      }

      let recommended: Track[] = [];

      if (hasActiveDiscovery) {
        try {
          const rawRecommendations = await discoveryHost.getRecommendations(
            contextTracks,
            {
              variety,
              limit: RECOMMENDATION_LIMIT,
            },
          );
          recommended = rawRecommendations.filter((trackItem) => {
            return (
              !isTrackInSet(trackItem, sessionTrackIds) &&
              !isTrackInSet(trackItem, existingQueueIds)
            );
          });
          for (const trackItem of recommended) {
            registerTrackInSet(trackItem, sessionTrackIds);
            registerTrackInSet(trackItem, existingQueueIds);
          }
        } catch (error) {
          reportError('discovery', {
            userMessage: i18n.t('discovery:recommendationError'),
            error,
          });
        }
      }

      if (recommended.length === 0 && contextTracks.length > 0) {
        recommended = await getIntelligentAutoplayTracks(
          contextTracks,
          existingQueueIds,
          RECOMMENDATION_LIMIT,
        );
      }

      if (recommended.length > 0) {
        const previousLength = items.length;
        useQueueStore.getState().addToQueue(recommended);

        const currentSoundStatus = useSoundStore.getState().status;
        const currentQueueState = useQueueStore.getState();
        if (
          currentSoundStatus === 'stopped' &&
          currentQueueState.currentIndex === previousLength - 1
        ) {
          currentQueueState.goToNext();
          useSoundStore.getState().play();
        }
      }

      return recommended;
    } finally {
      isFetching = false;
      activeFetchPromise = null;
    }
  })();

  return activeFetchPromise;
};

export const initDiscoveryService = () => {
  const triggerUpcomingCheck = () => {
    const { items, currentIndex } = useQueueStore.getState();
    if (items.length === 0) {
      return;
    }
    const remainingAhead = items.length - 1 - currentIndex;
    if (remainingAhead <= 1) {
      void ensureUpcomingTracks();
    }
  };

  const unsubTrackStarted = eventBus.on('trackStarted', async () => {
    triggerUpcomingCheck();
  });

  const unsubTrackFinished = eventBus.on('trackFinished', async () => {
    triggerUpcomingCheck();
  });

  const unsubQueue = useQueueStore.subscribe((state, previousState) => {
    if (
      state.currentIndex !== previousState.currentIndex ||
      state.items.length !== previousState.items.length
    ) {
      triggerUpcomingCheck();
    }
  });

  return () => {
    unsubTrackStarted();
    unsubTrackFinished();
    unsubQueue();
    sessionTrackIds.clear();
  };
};
