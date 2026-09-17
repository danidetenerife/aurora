import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Heart, Mic2 } from 'lucide-react';
import { FC, useEffect, useState } from 'react';

import { useTranslation } from '@aurora/i18n';
import type { PodcastRef } from '@aurora/model';
import { Button, ViewShell } from '@aurora/ui';

import { podcastService } from '../../services/podcastService';
import { usePodcastStore } from '../../stores/podcastStore';

const PodcastCardSkeleton: FC = () => (
  <div
    data-testid="podcast-card-skeleton"
    className="border-border bg-background-secondary flex min-w-0 animate-pulse items-center gap-3 rounded-xl border p-3"
  >
    <div className="bg-background-tertiary size-16 shrink-0 rounded-lg" />
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="bg-background-tertiary h-4 w-40 rounded" />
      <div className="bg-background-tertiary h-3 w-24 rounded" />
    </div>
  </div>
);

const PodcastCardCover: FC<{ src?: string }> = ({ src }) => {
  const [hasError, setHasError] = useState(false);

  if (src && !hasError) {
    return (
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setHasError(true)}
        className="size-16 shrink-0 rounded-lg object-cover"
      />
    );
  }

  return (
    <div className="bg-background border-border flex size-16 shrink-0 items-center justify-center rounded-lg border">
      <Mic2 className="size-8 opacity-50" />
    </div>
  );
};

export const Podcasts: FC = () => {
  const { t } = useTranslation('podcastBrowser');
  const navigate = useNavigate();
  const { favorites, load, toggleFavorite } = usePodcastStore();

  const {
    data: catalog = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<PodcastRef[]>({
    queryKey: ['featured-podcasts'],
    queryFn: async () => {
      const results = await podcastService.getFeaturedPodcasts();
      return results.map((item) => ({
        id: item.id,
        name: item.name,
        publisher: item.publisher,
        artworkUrl: item.artwork,
        sourceUrl: item.id.startsWith('http')
          ? item.id
          : `https://music.youtube.com/browse/${item.id}`,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    void load();
  }, [load]);

  const handleOpenPodcast = (podcast: PodcastRef) => {
    void navigate({
      to: '/podcast/$podcastId',
      params: { podcastId: podcast.id },
    });
  };

  const renderShow = (podcast: PodcastRef) => {
    const favorite = favorites.some((item) => item.id === podcast.id);
    const coverArt = podcast.artworkUrl;

    return (
      <div
        key={podcast.id}
        data-testid="podcast-card"
        className="border-border bg-background-secondary flex min-w-0 items-center gap-3 rounded-xl border p-3"
      >
        <button
          aria-label={t('open', { name: podcast.name })}
          onClick={() => handleOpenPodcast(podcast)}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
        >
          <PodcastCardCover src={coverArt} />
          <span className="min-w-0 flex-1">
            <strong className="text-foreground block text-sm font-bold break-words whitespace-normal">
              {podcast.name}
            </strong>
            <span className="text-foreground-secondary block text-xs opacity-75 break-words whitespace-normal">
              {podcast.publisher}
            </span>
          </span>
        </button>
        <button
          className="hover:text-accent-red flex size-11 shrink-0 cursor-pointer items-center justify-center"
          aria-label={t(favorite ? 'removeFavorite' : 'addFavorite')}
          onClick={() => void toggleFavorite(podcast)}
        >
          <Heart
            size={20}
            className={favorite ? 'text-accent-red fill-accent-red' : ''}
          />
        </button>
      </div>
    );
  };

  return (
    <ViewShell data-testid="podcasts-view">
      <section className="flex w-full min-w-0 flex-col gap-4">
        {favorites.length > 0 && (
          <>
            <h2 className="text-sm font-semibold">{t('favorites')}</h2>
            <div className="flex flex-col gap-2">
              {favorites.map(renderShow)}
            </div>
          </>
        )}
        <h2 className="text-sm font-semibold">{t('available')}</h2>
        {isLoading && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }, (_, index) => (
              <PodcastCardSkeleton key={`skeleton-${index}`} />
            ))}
          </div>
        )}
        {isError && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center">
            <p className="text-accent-red text-sm font-medium">
              {t('loadError', { defaultValue: 'Unable to load podcasts' })}
            </p>
            <Button variant="default" onClick={() => void refetch()}>
              {t('retry', { defaultValue: 'Retry' })}
            </Button>
          </div>
        )}
        {!isLoading && !isError && catalog.length === 0 && (
          <div
            data-testid="empty-state"
            className="text-foreground-secondary py-12 text-center text-sm"
          >
            {t('empty', { defaultValue: 'No podcasts found' })}
          </div>
        )}
        {!isLoading && !isError && catalog.length > 0 && (
          <div className="flex flex-col gap-2">{catalog.map(renderShow)}</div>
        )}
      </section>
    </ViewShell>
  );
};

