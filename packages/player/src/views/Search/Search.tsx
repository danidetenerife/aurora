import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import type { FC } from 'react';

import { useTranslation } from '@aurora/i18n';
import { pickArtwork } from '@aurora/model';
import type { MetadataProvider, SearchResults } from '@aurora/plugin-sdk';
import {
  Button,
  Card,
  CardGrid,
  Loader,
  Tabs,
  TabsItem,
  ViewShell,
} from '@aurora/ui';

import { ConnectedTrackTable } from '../../components/ConnectedTrackTable';
import { useActiveProvider } from '../../hooks/useActiveProvider';
import { httpHost } from '../../services/httpHost';
import { metadataHost } from '../../services/metadataHost';
import { SearchEmptyState } from './SearchEmptyState';

const SearchContent: FC<{
  provider: MetadataProvider | undefined;
  isLoading: boolean;
  isError: boolean;
  results: SearchResults | undefined;
  refetch: () => void;
  podcasts: Array<{
    id: string;
    name: string;
    publisher: string;
    artwork?: string;
  }>;
}> = ({ provider, isLoading, isError, results, refetch, podcasts }) => {
  const { t } = useTranslation(['search', 'common']);
  const navigate = useNavigate();
  const providerId = provider?.id ?? '';

  if (!provider && podcasts.length === 0) {
    return <SearchEmptyState />;
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader size="xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-3">
        <div className="text-accent-red">{t('search:failedToLoad')}</div>
        <Button
          onClick={() => {
            void refetch();
          }}
        >
          {t('common:actions.retry')}
        </Button>
      </div>
    );
  }

  const tabsItems = [
    podcasts.length > 0 && {
      id: 'podcasts',
      label: t('search:results.podcasts'),
      content: (
        <div className="flex min-w-0 flex-col gap-2">
          {podcasts.map((podcast) => (
            <div
              key={podcast.id}
              className="border-border bg-background-secondary flex min-w-0 items-center gap-3 rounded-xl border p-2"
            >
              {podcast.artwork ? (
                <img
                  src={podcast.artwork}
                  alt=""
                  className="size-12 shrink-0 rounded-lg object-cover"
                />
              ) : null}
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {podcast.name}
                <small className="block truncate text-xs font-normal opacity-60">
                  {podcast.publisher}
                </small>
              </span>
            </div>
          ))}
        </div>
      ),
    },
    results?.albums && {
      id: 'albums',
      label: t('search:results.albums'),
      content: (
        <CardGrid>
          {results.albums.map((item) => (
            <Card
              key={item.source.id}
              title={item.title}
              src={pickArtwork(item.artwork, 'cover', 300)?.url}
              onClick={() =>
                navigate({ to: `/album/${providerId}/${item.source.id}` })
              }
            />
          ))}
        </CardGrid>
      ),
    },
    results?.artists && {
      id: 'artists',
      label: t('search:results.artists'),
      content: (
        <CardGrid>
          {results.artists.map((item) => (
            <Card
              key={item.source.id}
              title={item.name}
              src={pickArtwork(item.artwork, 'cover', 300)?.url}
              onClick={() =>
                navigate({ to: `/artist/${providerId}/${item.source.id}` })
              }
            />
          ))}
        </CardGrid>
      ),
    },
    results?.tracks && {
      id: 'tracks',
      label: t('search:results.tracks'),
      content: (
        <div className="flex flex-col">
          <ConnectedTrackTable
            features={{ playAll: true, addAllToQueue: true }}
            tracks={results.tracks}
          />
        </div>
      ),
    },
    results?.playlists && {
      id: 'playlists',
      label: t('search:results.playlists'),
      content: (
        <CardGrid>
          {results.playlists.map((item) => (
            <Card
              key={item.source.id}
              title={item.name}
              src={pickArtwork(item.artwork, 'cover', 300)?.url}
              onClick={() => {
                if (item.source.url) {
                  navigate({
                    to: '/playlists/import/$providerId',
                    params: {
                      providerId: `${item.source.provider}-playlists`,
                    },
                    search: { url: encodeURIComponent(item.source.url) },
                  });
                }
              }}
            />
          ))}
        </CardGrid>
      ),
    },
  ].filter(Boolean);

  return <Tabs items={tabsItems as TabsItem[]} className="flex-1" />;
};

export const Search: FC = () => {
  const { q } = useSearch({ from: '/search' });

  const provider = useActiveProvider('metadata') as
    | MetadataProvider
    | undefined;

  const {
    data: results,
    isLoading,
    isError,
    refetch,
  } = useQuery<SearchResults>({
    queryKey: ['metadata-search', provider?.id, q],
    queryFn: () =>
      metadataHost.search({
        query: q,
      }),
    enabled: Boolean(provider && q),
  });
  const { data: podcastResults = [] } = useQuery({
    queryKey: ['podcast-search', q],
    queryFn: async () => {
      const response = await httpHost.fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=podcast&limit=25`,
      );
      if (response.status !== 200) return [];
      const payload = JSON.parse(response.body) as {
        results?: Array<{
          collectionId?: number;
          collectionName?: string;
          artistName?: string;
          artworkUrl600?: string;
          artworkUrl100?: string;
        }>;
      };
      return (payload.results ?? [])
        .filter((item) => item.collectionId && item.collectionName)
        .map((item) => ({
          id: String(item.collectionId),
          name: item.collectionName!,
          publisher: item.artistName ?? 'Podcast',
          artwork: item.artworkUrl600 ?? item.artworkUrl100,
        }));
    },
    enabled: Boolean(q),
    staleTime: 300000,
  });

  return (
    <ViewShell
      data-testid="search-view"
      classes={{ root: 'aurora-compact-view-shell' }}
    >
      <SearchContent
        provider={provider}
        isLoading={isLoading}
        isError={isError}
        results={results}
        refetch={refetch}
        podcasts={podcastResults}
      />
    </ViewShell>
  );
};
