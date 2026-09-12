import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Mic2 } from 'lucide-react';
import { type FC, useState } from 'react';


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
import { metadataHost } from '../../services/metadataHost';
import {
  podcastService,
  type PodcastSearchResult,
} from '../../services/podcastService';
import { SearchEmptyState } from './SearchEmptyState';

const PodcastSearchRow: FC<{
  podcast: PodcastSearchResult;
  onSelect: () => void;
}> = ({ podcast, onSelect }) => {
  const [hasError, setHasError] = useState(false);

  return (
    <button
      type="button"
      className="border-border bg-background-secondary hover:bg-primary/10 flex min-w-0 cursor-pointer items-center gap-3 rounded-xl border p-2 text-left transition-colors"
      onClick={onSelect}
    >
      {podcast.artwork && !hasError ? (
        <img
          src={podcast.artwork}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
          className="size-12 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="bg-background border-border flex size-12 shrink-0 items-center justify-center rounded-lg border">
          <Mic2 className="size-6 text-foreground/40" />
        </div>
      )}
      <span className="min-w-0 flex-1 text-sm font-semibold break-words">
        {podcast.name}
        <small className="block text-xs font-normal break-words opacity-60">
          {podcast.publisher}{' '}
          {podcast.source === 'youtube-music' ? '• YouTube Music' : ''}
        </small>
      </span>
    </button>
  );
};

const SearchContent: FC<{

  query: string;
  provider: MetadataProvider | undefined;
  isLoading: boolean;
  isError: boolean;
  results: SearchResults | undefined;
  refetch: () => void;
  podcasts: PodcastSearchResult[];
}> = ({ query, provider, isLoading, isError, results, refetch, podcasts }) => {
  const { t } = useTranslation(['search', 'common']);
  const navigate = useNavigate();
  const providerId = provider?.id ?? '';

  if (!provider && podcasts.length === 0) {
    return (
      <>
        <span className="sr-only">Query: &quot;{query}&quot;</span>
        <SearchEmptyState />
      </>
    );
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
    podcasts.length > 0 && {
      id: 'podcasts',
      label: t('search:results.podcasts'),
      content: (
        <div className="flex min-w-0 flex-col gap-2">
          {podcasts.map((podcast) => (
            <PodcastSearchRow
              key={podcast.id}
              podcast={podcast}
              onSelect={() => {
                void navigate({
                  to: '/podcast/$podcastId',
                  params: { podcastId: podcast.id },
                });
              }}
            />
          ))}
        </div>
      ),
    },
  ].filter(Boolean);


  return (
    <>
      <span className="sr-only">Query: &quot;{query}&quot;</span>
      <Tabs items={tabsItems as TabsItem[]} className="flex-1" />
    </>
  );
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
    queryFn: () => podcastService.searchPodcasts(q),
    enabled: Boolean(q),
    staleTime: 300000,
  });

  return (
    <ViewShell
      data-testid="search-view"
      classes={{ root: 'aurora-compact-view-shell' }}
    >
      <SearchContent
        query={q}
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
