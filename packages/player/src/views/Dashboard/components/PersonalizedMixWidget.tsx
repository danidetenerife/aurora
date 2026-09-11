import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SparklesIcon } from 'lucide-react';
import { FC, useEffect, useState } from 'react';

import { useTranslation } from '@nuclearplayer/i18n';
import type { Track, TrackRef } from '@nuclearplayer/model';
import type { MetadataProvider } from '@nuclearplayer/plugin-sdk';
import { Badge, Loader } from '@nuclearplayer/ui';

import { ConnectedTrackTable } from '../../../components/ConnectedTrackTable';
import { useProviders } from '../../../hooks/useProviders';
import { discoveryHost } from '../../../services/discoveryHost';
import {
  personalizationEngine,
  type ArtistScore,
  type GenreScore,
} from '../../../services/personalizationEngine';
import { providersHost } from '../../../services/providersHost';

type TaggedCandidate = {
  track: Track;
  source: 'topTracks' | 'related' | 'radio' | 'search';
};

const PERSONALIZED_MIX_QUERY_KEY = ['dashboard', 'personalized-mix-v2'];

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

const fetchTopTracksForArtists = async (
  provider: MetadataProvider,
  artists: ArtistScore[],
  limit: number,
): Promise<TaggedCandidate[]> => {
  const candidates: TaggedCandidate[] = [];

  for (const artist of artists.slice(0, limit)) {
    try {
      const artistUri = artist.spotifyUri;
      if (!artistUri || !provider.fetchArtistTopTracks) {
        continue;
      }

      const topTracks = await provider.fetchArtistTopTracks(artistUri);
      for (const trackRef of topTracks.slice(0, 5)) {
        candidates.push({
          track: trackRefToTrack(trackRef),
          source: 'topTracks',
        });
      }
    } catch {
      // ignore
    }
  }

  return candidates;
};

const fetchRelatedArtistTracks = async (
  provider: MetadataProvider,
  artists: ArtistScore[],
  limit: number,
): Promise<TaggedCandidate[]> => {
  const candidates: TaggedCandidate[] = [];
  const seenArtistUris = new Set<string>();

  for (const artist of artists.slice(0, limit)) {
    try {
      const artistUri = artist.spotifyUri;
      if (
        !artistUri ||
        !provider.fetchArtistRelatedArtists ||
        !provider.fetchArtistTopTracks
      ) {
        continue;
      }

      const relatedArtists =
        await provider.fetchArtistRelatedArtists(artistUri);

      for (const relatedArtist of relatedArtists.slice(0, 3)) {
        const relatedUri = relatedArtist.source?.id;
        if (!relatedUri || seenArtistUris.has(relatedUri)) {
          continue;
        }
        seenArtistUris.add(relatedUri);

        try {
          const topTracks = await provider.fetchArtistTopTracks(relatedUri);
          for (const trackRef of topTracks.slice(0, 3)) {
            candidates.push({
              track: trackRefToTrack(trackRef),
              source: 'related',
            });
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }

  return candidates;
};

const fetchRadioRecommendations = async (
  seedTracks: Track[],
): Promise<TaggedCandidate[]> => {
  try {
    const activeDiscoveryId = providersHost.getActive('discovery');
    if (!activeDiscoveryId) {
      return [];
    }

    const recommendations = await discoveryHost.getRecommendations(
      seedTracks.slice(0, 5),
      { variety: 0.7, limit: 20 },
    );

    return recommendations.map((track) => ({
      track,
      source: 'radio' as const,
    }));
  } catch {
    return [];
  }
};

const fetchSearchFallback = async (
  provider: MetadataProvider,
  topArtists: ArtistScore[],
  topGenres: GenreScore[],
): Promise<TaggedCandidate[]> => {
  const candidates: TaggedCandidate[] = [];
  const queries: string[] =
    topArtists.length > 0
      ? topArtists.slice(0, 3).map((artist) => artist.name)
      : ['Pop Hits', 'Rock Classics', 'Reggaeton Mix', 'Electronic Music'];

  if (topGenres.length > 0) {
    queries.push(...topGenres.slice(0, 2).map((g) => `${g.genre} mix`));
  }

  for (const query of queries) {
    try {
      if (!provider.search) {
        continue;
      }
      const results = await provider.search({
        query,
        types: ['tracks'],
      });
      if (results.tracks && Array.isArray(results.tracks)) {
        for (const track of results.tracks.slice(0, 6)) {
          candidates.push({ track, source: 'search' });
        }
      }
    } catch {
      // ignore
    }
  }

  return candidates;
};

export const PersonalizedMixWidget: FC = () => {
  const { t } = useTranslation('dashboard');
  const queryClient = useQueryClient();
  const [visibleTracks, setVisibleTracks] = useState<Track[]>();
  const [topGenres, setTopGenres] = useState<GenreScore[]>([]);
  const metadataProviders = useProviders('metadata') as MetadataProvider[];
  const discoveryProviders = useProviders('discovery');
  const activeProviderId =
    providersHost.getActive('metadata') ?? metadataProviders[0]?.id ?? null;
  const activeDiscoveryId =
    providersHost.getActive('discovery') ?? discoveryProviders[0]?.id ?? null;
  const metadataProvider =
    metadataProviders.find((provider) => provider.id === activeProviderId) ??
    metadataProviders[0];

  useEffect(
    () =>
      personalizationEngine.subscribe(() => {
        void queryClient.invalidateQueries({
          queryKey: PERSONALIZED_MIX_QUERY_KEY,
          refetchType: 'none',
        });
      }),
    [queryClient],
  );

  const {
    data: tracks,
    isLoading,
    isFetching,
  } = useQuery<Track[]>({
    queryKey: [
      ...PERSONALIZED_MIX_QUERY_KEY,
      activeProviderId,
      activeDiscoveryId,
    ],
    enabled: metadataProviders.length > 0 && visibleTracks === undefined,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      const topArtists = await personalizationEngine.getTopArtists();
      const fetchedGenres = await personalizationEngine.getTopGenres(5);
      setTopGenres(fetchedGenres);
      const seedTracks = await personalizationEngine.getSeedTracks(5);
      const listens = await personalizationEngine.getListenRecords();
      const blacklist = await personalizationEngine.getBlacklist();

      const hasSpotifyCapabilities =
        metadataProvider?.fetchArtistTopTracks &&
        metadataProvider?.fetchArtistRelatedArtists;

      const artistsWithUris = topArtists.filter((artist) => artist.spotifyUri);

      const candidateSources = await Promise.allSettled([
        hasSpotifyCapabilities && artistsWithUris.length > 0
          ? fetchTopTracksForArtists(metadataProvider, artistsWithUris, 6)
          : Promise.resolve([]),

        hasSpotifyCapabilities && artistsWithUris.length > 0
          ? fetchRelatedArtistTracks(metadataProvider, artistsWithUris, 4)
          : Promise.resolve([]),

        seedTracks.length > 0
          ? fetchRadioRecommendations(seedTracks)
          : Promise.resolve([]),

        fetchSearchFallback(metadataProvider, topArtists, fetchedGenres),
      ]);

      const allCandidates: TaggedCandidate[] = candidateSources.flatMap(
        (result) => (result.status === 'fulfilled' ? result.value : []),
      );

      if (allCandidates.length === 0) {
        return [];
      }

      return personalizationEngine.scoreAndRankTracks(
        allCandidates,
        topArtists,
        listens,
        blacklist,
      );
    },
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (tracks !== undefined && !isFetching) {
      setVisibleTracks((current) => current ?? tracks);
    }
  }, [tracks, isFetching]);

  return (
    <div
      data-testid="dashboard-personalized-mix"
      className="flex flex-col gap-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <SparklesIcon className="text-primary size-5" />
          <h2 className="text-lg font-bold">{t('personalizedMix.title')}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {topGenres.slice(0, 3).map((g) => (
            <Badge key={g.genre} variant="pill" className="text-xs capitalize">
              {g.genre}
            </Badge>
          ))}
          <Badge variant="pill" className="text-xs">
            {t('personalizedMix.badge')}
          </Badge>
        </div>
      </div>
      <p className="text-foreground-secondary text-xs">
        {t('personalizedMix.description')}
      </p>

      {visibleTracks === undefined && (isLoading || isFetching) ? (
        <div className="flex items-center justify-center p-8">
          <Loader data-testid="dashboard-personalized-loader" size="lg" />
        </div>
      ) : (
        <ConnectedTrackTable
          tracks={visibleTracks ?? []}
          features={{ filterable: true, playAll: true, addAllToQueue: true }}
          display={{ displayDuration: false }}
        />
      )}
    </div>
  );
};
