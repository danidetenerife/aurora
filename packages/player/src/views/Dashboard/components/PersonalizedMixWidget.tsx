import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  RotateCw,
  SparklesIcon,
} from 'lucide-react';
import { FC, useEffect, useMemo, useState } from 'react';

import { useTranslation } from '@aurora/i18n';
import type { Track, TrackRef } from '@aurora/model';
import type { MetadataProvider } from '@aurora/plugin-sdk';
import { Badge, Button, Loader } from '@aurora/ui';

import { ConnectedTrackTable } from '../../../components/ConnectedTrackTable';
import { MobileTrackPages } from '../../../components/MobileTrackPages';
import { useProviders } from '../../../hooks/useProviders';
import { discoveryHost } from '../../../services/discoveryHost';
import {
  personalizationEngine,
  type ArtistScore,
  type GenreScore,
} from '../../../services/personalizationEngine';
import { providersHost } from '../../../services/providersHost';
import { isCapacitorEnvironment } from '../../../services/universalStore';

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
      for (const trackRef of topTracks.slice(0, 10)) {
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

      for (const relatedArtist of relatedArtists.slice(0, 4)) {
        const relatedUri = relatedArtist.source?.id;
        if (!relatedUri || seenArtistUris.has(relatedUri)) {
          continue;
        }
        seenArtistUris.add(relatedUri);

        try {
          const topTracks = await provider.fetchArtistTopTracks(relatedUri);
          for (const trackRef of topTracks.slice(0, 4)) {
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
  provider: MetadataProvider | undefined,
  topArtists: ArtistScore[],
  topGenres: GenreScore[],
): Promise<TaggedCandidate[]> => {
  if (!provider) {
    return [];
  }
  const candidates: TaggedCandidate[] = [];
  const defaultSeeds = [
    'Pop Hits',
    'Rock Classics',
    'Reggaeton Mix',
    'Electronic Music',
    'Top Exitos',
    'Indie Espanol',
  ];
  const queries: string[] = [
    ...topArtists.slice(0, 4).map((artist) => artist.name),
    ...topGenres.slice(0, 3).map((genreScore) => `${genreScore.genre} mix`),
    ...defaultSeeds,
  ].slice(0, 6);

  for (const query of queries) {
    try {
      if (provider.search) {
        const results = await provider.search({
          query,
          types: ['tracks'],
        });
        if (results.tracks && Array.isArray(results.tracks)) {
          for (const track of results.tracks.slice(0, 10)) {
            candidates.push({ track, source: 'search' });
          }
        }
      } else if (provider.searchTracks) {
        const tracks = await provider.searchTracks({ query, limit: 10 });
        if (Array.isArray(tracks)) {
          for (const track of tracks.slice(0, 10)) {
            candidates.push({ track, source: 'search' });
          }
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
  const [refreshNonce, setRefreshNonce] = useState(0);
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
    refetch,
  } = useQuery<Track[]>({
    queryKey: [
      ...PERSONALIZED_MIX_QUERY_KEY,
      activeProviderId,
      activeDiscoveryId,
      refreshNonce,
    ],
    enabled: metadataProviders.length > 0,
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

      let allCandidates: TaggedCandidate[] = candidateSources.flatMap(
        (result) => (result.status === 'fulfilled' ? result.value : []),
      );

      if (allCandidates.length === 0) {
        for (const altProvider of metadataProviders) {
          if (altProvider.id !== metadataProvider?.id) {
            const fallbackResults = await fetchSearchFallback(
              altProvider,
              topArtists,
              fetchedGenres,
            );
            if (fallbackResults.length > 0) {
              allCandidates = fallbackResults;
              break;
            }
          }
        }
      }

      if (allCandidates.length === 0) {
        return [];
      }

      return personalizationEngine.scoreAndRankTracks(
        allCandidates,
        topArtists,
        listens,
        blacklist,
        0.5,
        refreshNonce,
      );
    },
    staleTime: 60 * 1000,
  });

  const [page, setPage] = useState(0);
  const pageSize = 10;
  const totalPages = Math.max(
    1,
    Math.ceil((visibleTracks?.length ?? 0) / pageSize),
  );

  const paginatedTracks = useMemo(() => {
    if (!visibleTracks) {
      return [];
    }
    return visibleTracks.slice(page * pageSize, (page + 1) * pageSize);
  }, [visibleTracks, page]);

  useEffect(() => {
    if (tracks !== undefined && !isFetching) {
      setVisibleTracks(tracks);
    }
  }, [tracks, isFetching]);

  useEffect(() => {
    setVisibleTracks(undefined);
    setPage(0);
  }, [activeProviderId, activeDiscoveryId]);

  const handleRefresh = async () => {
    setPage(0);
    setRefreshNonce((previousNonce) => previousNonce + 1);
    const result = await refetch();
    if (result.data) {
      setVisibleTracks(result.data);
    }
  };

  if (
    visibleTracks !== undefined &&
    visibleTracks.length === 0 &&
    !isLoading &&
    !isFetching
  ) {
    return null;
  }

  return (
    <div
      data-testid="dashboard-personalized-mix"
      className="flex flex-col gap-2.5"
    >
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          {!isCapacitorEnvironment() && (
            <SparklesIcon className="text-primary size-5" />
          )}
          <h2 className="text-2xl font-black tracking-tight text-white select-none">
            {t('personalizedMix.title', 'Recomendado para ti')}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            data-testid="refresh-recommendations-button"
            className="h-7 w-7 rounded-full text-zinc-400 transition-transform hover:text-white active:scale-90"
            aria-label={t('refresh')}
            title={t('refresh')}
            disabled={isFetching}
            onClick={() => void handleRefresh()}
          >
            <RotateCw
              className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`}
            />
          </Button>

          {!isCapacitorEnvironment() && totalPages >= 1 && (
            <div className="border-border/40 bg-background-secondary/60 text-foreground-secondary ml-2 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold backdrop-blur-md">
              <Button
                variant="ghost"
                size="icon"
                data-testid="recommendations-prev-page"
                className="h-5 w-5 rounded-full text-zinc-400 hover:text-white disabled:opacity-30"
                disabled={page === 0}
                onClick={() =>
                  setPage((previousPage) => Math.max(0, previousPage - 1))
                }
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <span className="text-foreground min-w-[3rem] text-center text-xs">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                data-testid="recommendations-next-page"
                className="h-5 w-5 rounded-full text-zinc-400 hover:text-white disabled:opacity-30"
                disabled={page >= totalPages - 1}
                onClick={() =>
                  setPage((previousPage) =>
                    Math.min(totalPages - 1, previousPage + 1),
                  )
                }
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {topGenres.slice(0, 3).map((genreScore) => (
            <Badge
              key={genreScore.genre}
              variant="pill"
              className="text-xs capitalize"
            >
              {genreScore.genre}
            </Badge>
          ))}
          <Badge variant="pill" className="text-xs">
            {t('personalizedMix.badge')}
          </Badge>
        </div>
      </div>

      {!isCapacitorEnvironment() && (
        <p className="text-foreground-secondary text-xs">
          {t('personalizedMix.description')}
        </p>
      )}

      {visibleTracks === undefined && (isLoading || isFetching) ? (
        <div className="flex items-center justify-center p-8">
          <Loader data-testid="dashboard-personalized-loader" size="lg" />
        </div>
      ) : isCapacitorEnvironment() ? (
        <MobileTrackPages
          tracks={visibleTracks ?? []}
          pageSize={10}
          variant="queue"
        />
      ) : (
        <ConnectedTrackTable
          tracks={paginatedTracks}
          playbackTracks={visibleTracks ?? []}
          features={{ filterable: false, playAll: true, addAllToQueue: true }}
          display={{ displayDuration: false }}
        />
      )}
    </div>
  );
};
