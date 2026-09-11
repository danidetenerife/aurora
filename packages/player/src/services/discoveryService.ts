import { i18n } from '@aurora/i18n';
import type { Track, TrackRef } from '@aurora/model';
import type { MetadataProvider } from '@aurora/plugin-sdk';

import { useQueueStore } from '../stores/queueStore';
import { useSettingsStore } from '../stores/settingsStore';
import { reportError } from '../utils/logging';
import { discoveryHost } from './discoveryHost';
import { eventBus } from './eventBus';
import { personalizationEngine } from './personalizationEngine';
import { providersHost } from './providersHost';

const CONTEXT_SIZE = 10;
const RECOMMENDATION_LIMIT = 5;

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

/**
 * Intelligent Autoplay Fallback when dedicated discovery provider is absent or returns empty.
 * Uses the user's learned profile, top genres and current seed track.
 */
const getIntelligentAutoplayTracks = async (
  seedTrack: Track,
  existingQueueIds: Set<string>,
  limit = RECOMMENDATION_LIMIT,
): Promise<Track[]> => {
  try {
    const [topArtists, topGenres, blacklist] = await Promise.all([
      personalizationEngine.getTopArtists(),
      personalizationEngine.getTopGenres(5),
      personalizationEngine.getBlacklist(),
    ]);

    const candidates: Track[] = [];
    const metadataProviders = providersHost.list(
      'metadata',
    ) as MetadataProvider[];
    const activeMetaId = providersHost.getActive('metadata');
    const provider =
      metadataProviders.find((p) => p.id === activeMetaId) ??
      metadataProviders[0];

    // 1. Try related artists from seed track's artist
    const seedArtistName = seedTrack.artists?.[0]?.name;
    if (seedArtistName && provider) {
      try {
        const resolved =
          await personalizationEngine.resolveArtistMetadata(seedArtistName);
        if (
          resolved.spotifyUri &&
          provider.fetchArtistRelatedArtists &&
          provider.fetchArtistTopTracks
        ) {
          const related = await provider.fetchArtistRelatedArtists(
            resolved.spotifyUri,
          );
          for (const rel of related.slice(0, 3)) {
            if (rel.source?.id) {
              const tracks = await provider.fetchArtistTopTracks(rel.source.id);
              for (const tr of tracks.slice(0, 2)) {
                candidates.push(trackRefToTrack(tr));
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }

    // 2. Try top genres search if we need more candidates
    if (candidates.length < limit && provider?.search && topGenres.length > 0) {
      for (const genreScore of topGenres.slice(0, 2)) {
        try {
          const res = await provider.search({
            query: `${genreScore.genre} mix`,
            types: ['tracks'],
            limit: 5,
          });
          if (res.tracks) {
            candidates.push(...res.tracks);
          }
        } catch {
          // ignore
        }
      }
    }

    // 3. Try top artists tracks
    if (candidates.length < limit && provider?.fetchArtistTopTracks) {
      for (const topArt of topArtists.slice(0, 3)) {
        if (topArt.spotifyUri) {
          try {
            const tracks = await provider.fetchArtistTopTracks(
              topArt.spotifyUri,
            );
            for (const tr of tracks.slice(0, 3)) {
              candidates.push(trackRefToTrack(tr));
            }
          } catch {
            // ignore
          }
        }
      }
    }

    // Filter out blacklisted and existing queue tracks
    const filtered = candidates.filter((track) => {
      const trackId =
        track.source?.id || `${track.artists?.[0]?.name}-${track.title}`;
      if (existingQueueIds.has(trackId)) {
        return false;
      }
      if (blacklist.tracks.includes(trackId)) {
        return false;
      }
      const artist = (track.artists?.[0]?.name || '').toLowerCase().trim();
      if (blacklist.artists.includes(artist)) {
        return false;
      }
      existingQueueIds.add(trackId);
      return true;
    });

    return filtered.slice(0, limit);
  } catch {
    return [];
  }
};

export const initDiscoveryService = () => {
  return eventBus.on('trackStarted', async () => {
    const isEnabled = useSettingsStore
      .getState()
      .getValue('core.playback.discovery');
    if (!isEnabled) {
      return;
    }

    const { items, currentIndex } = useQueueStore.getState();
    const isLastTrack = currentIndex >= items.length - 1;
    if (!isLastTrack) {
      return;
    }

    const variety =
      (useSettingsStore
        .getState()
        .getValue('core.playback.discoveryVariety') as number) ?? 0.5;

    const contextTracks: Track[] = items
      .slice(-CONTEXT_SIZE)
      .map((item) => item.track);

    const activeDiscoveryId = providersHost.getActive('discovery');
    const hasActiveDiscovery = Boolean(
      activeDiscoveryId && providersHost.get(activeDiscoveryId, 'discovery'),
    );

    const existingQueueIds = new Set(
      items.map(
        (it) =>
          it.track.source?.id ||
          `${it.track.artists?.[0]?.name}-${it.track.title}`,
      ),
    );

    let recommended: Track[] = [];

    if (hasActiveDiscovery) {
      try {
        recommended = await discoveryHost.getRecommendations(contextTracks, {
          variety,
          limit: RECOMMENDATION_LIMIT,
        });
      } catch (error) {
        reportError('discovery', {
          userMessage: i18n.t('discovery:recommendationError'),
          error,
        });
      }
    }

    // If no discovery provider or it produced no results, activate intelligent fallback
    if (recommended.length === 0 && contextTracks.length > 0) {
      const seedTrack = contextTracks[contextTracks.length - 1];
      recommended = await getIntelligentAutoplayTracks(
        seedTrack,
        existingQueueIds,
        RECOMMENDATION_LIMIT,
      );
    }

    if (recommended.length > 0) {
      useQueueStore.getState().addToQueue(recommended);
    }
  });
};
