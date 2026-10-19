import { i18n } from '@aurora/i18n';
import type { Track, TrackRef } from '@aurora/model';
import type { MetadataProvider } from '@aurora/plugin-sdk';

import { useFavoritesStore } from '../stores/favoritesStore';
import { usePlaylistStore } from '../stores/playlistStore';
import { useQueueStore } from '../stores/queueStore';
import { useSettingsStore } from '../stores/settingsStore';
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

const getCanonicalTrackSignature = (track: Track): string => {
  const primaryArtist = (track.artists?.[0]?.name ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  const normalizedTitle = (track.title ?? '')
    .toLowerCase()
    .replace(
      /\s*[([](?:official\s*(?:music\s*)?(?:video|audio|lyric\s*video|visualizer)|lyric\s*video|visualizer|audio|video\s*oficial|hd|hq|4k|remaster(?:ed)?(?:\s*\d{4})?|live(?:\s*at\s*[^)\]]*)?)[)\]]/gi,
      '',
    )
    .replace(/\s*-\s*remaster(?:ed)?(?:\s*\d{4})?\b/gi, '')
    .replace(/\s*[([]?(?:feat\.?|ft\.?)\s+[^)\]]+[)\]]?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return normalizedTitle ? `${primaryArtist}::${normalizedTitle}` : '';
};

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
  const signature = getCanonicalTrackSignature(track);
  if (signature) {
    targetSet.add(signature);
  }
};

export const isTrackInSet = (track: Track, targetSet: Set<string>): boolean => {
  if (track.source?.id && targetSet.has(track.source.id.toLowerCase().trim())) {
    return true;
  }
  const artist = (track.artists?.[0]?.name ?? '').toLowerCase().trim();
  const title = (track.title ?? '').toLowerCase().trim();
  if (title && targetSet.has(`${artist}-${title}`)) {
    return true;
  }
  const signature = getCanonicalTrackSignature(track);
  if (signature && targetSet.has(signature)) {
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
  recordInSession = true,
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
        const artistId = resolved.spotifyUri || artistName;

        if (
          artistId &&
          provider.fetchArtistRelatedArtists &&
          provider.fetchArtistTopTracks
        ) {
          const related = await provider.fetchArtistRelatedArtists(artistId);
          for (const relatedArtist of related.slice(0, 3)) {
            const relatedId = relatedArtist.source?.id || relatedArtist.name;
            if (relatedId) {
              const tracks = await provider.fetchArtistTopTracks(relatedId);
              for (const trackRef of tracks.slice(0, 2)) {
                candidates.push({
                  track: trackRefToTrack(trackRef),
                  source: 'related',
                });
              }
            }
          }
        }

        if (artistId && provider.fetchArtistTopTracks) {
          const tracks = await provider.fetchArtistTopTracks(artistId);
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
        const artistId = topArtist.spotifyUri || topArtist.name;
        if (artistId) {
          try {
            const tracks = await provider.fetchArtistTopTracks(artistId);
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
        for (const topArtist of topArtists.slice(0, 2)) {
          searchQueries.push(`${topArtist.name} radio`);
        }
        const playlists = Array.from(
          usePlaylistStore.getState().playlists.values(),
        );
        for (const playlist of playlists.slice(0, 2)) {
          if (playlist.name) {
            searchQueries.push(playlist.name);
          }
        }
        const favArtists = useFavoritesStore.getState().artists;
        for (const favArtist of favArtists.slice(0, 2)) {
          if (favArtist.ref?.name) {
            searchQueries.push(`${favArtist.ref.name} mix`);
          }
        }
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

    const variety =
      (useSettingsStore
        .getState()
        .getValue('core.playback.discoveryVariety') as number) ?? 0.5;

    const ranked = personalizationEngine.scoreAndRankTracks(
      filtered,
      topArtists,
      listens,
      blacklist,
      variety,
    );

    const chosen = ranked.slice(0, limit);
    if (recordInSession) {
      for (const trackItem of chosen) {
        registerTrackInSet(trackItem, sessionTrackIds);
        registerTrackInSet(trackItem, existingQueueIds);
      }
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
      const rawContextTracks: Track[] = playedItems
        .slice(-CONTEXT_SIZE)
        .map((item) => item.track);
      const unskippedContextTracks = rawContextTracks.filter((trackItem) => {
        const primaryArtist = trackItem.artists?.[0]?.name ?? '';
        return !personalizationEngine.isArtistSkippedInSession(primaryArtist);
      });
      const contextTracks =
        unskippedContextTracks.length > 0
          ? unskippedContextTracks
          : rawContextTracks;

      const activeDiscoveryId = providersHost.getActive('discovery');
      const hasActiveDiscovery = Boolean(
        activeDiscoveryId && providersHost.get(activeDiscoveryId, 'discovery'),
      );

      const existingQueueIds = new Set<string>();
      for (const queueItem of items) {
        registerTrackInSet(queueItem.track, existingQueueIds);
      }

      let recommended: Track[] = [];
      let discoveryProviderFailed = false;

      if (hasActiveDiscovery) {
        try {
          const rawRecommendations = await discoveryHost.getRecommendations(
            contextTracks,
            {
              variety,
              limit: RECOMMENDATION_LIMIT,
            },
          );
          const [topArtists, listens, blacklist] = await Promise.all([
            personalizationEngine.getTopArtists(),
            personalizationEngine.getListenRecords(),
            personalizationEngine.getBlacklist(),
          ]);

          const filteredRaw = rawRecommendations.filter((trackItem) => {
            if (
              isTrackInSet(trackItem, sessionTrackIds) ||
              isTrackInSet(trackItem, existingQueueIds)
            ) {
              return false;
            }
            if (blacklist.tracks.includes(trackItem.source?.id || '')) {
              return false;
            }
            const artist = (trackItem.artists?.[0]?.name || '')
              .toLowerCase()
              .trim();
            if (blacklist.artists.includes(artist)) {
              return false;
            }
            return true;
          });

          if (filteredRaw.length > 0 && topArtists.length > 0) {
            const personalizedTracks = await getIntelligentAutoplayTracks(
              contextTracks,
              existingQueueIds,
              RECOMMENDATION_LIMIT,
              false,
            );
            const combinedCandidates: TaggedCandidate[] = [
              ...personalizedTracks.map((track) => ({
                track,
                source: 'topTracks' as const,
              })),
              ...filteredRaw.map((track) => ({
                track,
                source: 'radio' as const,
              })),
            ];
            recommended = personalizationEngine
              .scoreAndRankTracks(
                combinedCandidates,
                topArtists,
                listens,
                blacklist,
                variety,
              )
              .slice(0, RECOMMENDATION_LIMIT);
          } else {
            recommended = filteredRaw.slice(0, RECOMMENDATION_LIMIT);
          }

          for (const trackItem of recommended) {
            registerTrackInSet(trackItem, sessionTrackIds);
            registerTrackInSet(trackItem, existingQueueIds);
          }
        } catch (error) {
          discoveryProviderFailed = true;
          reportError('discovery', {
            userMessage: i18n.t('discovery:recommendationError'),
            error,
          });
        }
      }

      if (
        recommended.length === 0 &&
        contextTracks.length > 0 &&
        !discoveryProviderFailed
      ) {
        recommended = await getIntelligentAutoplayTracks(
          contextTracks,
          existingQueueIds,
          RECOMMENDATION_LIMIT,
        );
      }

      if (recommended.length > 0) {
        useQueueStore.getState().addToQueue(recommended);
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
