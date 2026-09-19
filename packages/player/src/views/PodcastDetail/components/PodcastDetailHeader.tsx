import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Heart, Mic2, Play } from 'lucide-react';
import { useState, type FC } from 'react';

import { useTranslation } from '@aurora/i18n';
import { Button, StatChip } from '@aurora/ui';

import type { PodcastDetail } from '../../../services/podcastService';
import { usePodcastStore } from '../../../stores/podcastStore';
import { useQueueStore } from '../../../stores/queueStore';

type PodcastDetailHeaderProps = {
  podcast: PodcastDetail;
};

export const PodcastDetailHeader: FC<PodcastDetailHeaderProps> = ({
  podcast,
}) => {
  const { t } = useTranslation(['podcastBrowser', 'common']);
  const navigate = useNavigate();
  const { favorites, toggleFavorite } = usePodcastStore();

  const isFavorite = favorites.some((item) => item.id === podcast.id);
  const [failedUrls, setFailedUrls] = useState<Record<string, boolean>>({});
  const primaryUrl = podcast.artwork;
  const episodeFallback = podcast.episodes?.[0]?.artwork?.items?.[0]?.url;
  const coverUrl =
    primaryUrl && !failedUrls[primaryUrl]
      ? primaryUrl
      : episodeFallback && !failedUrls[episodeFallback]
        ? episodeFallback
        : null;

  const handleToggleFavorite = () => {
    void toggleFavorite({
      id: podcast.id,
      name: podcast.title,
      publisher: podcast.publisher,
      sourceUrl: podcast.id,
      artworkUrl: podcast.artwork,
    });
  };

  const handlePlayLatest = () => {
    if (podcast.episodes.length === 0) {
      return;
    }
    useQueueStore.getState().playTracks(podcast.episodes, 0);
  };

  return (
    <div className="border-border bg-primary shadow-shadow relative mx-3 mt-3 flex flex-col gap-4 rounded-xl border-(length:--border-width) p-4 text-black sm:mx-6 sm:mt-6 sm:gap-6 sm:p-6 md:flex-row">
      <button
        type="button"
        data-testid="podcast-back-button"
        onClick={() => {
          if (window.history.length > 1) {
            window.history.back();
          } else {
            void navigate({ to: '/podcasts' });
          }
        }}
        className="bg-background border-border hover:bg-background/80 absolute top-4 left-4 z-10 flex size-9 cursor-pointer items-center justify-center rounded-lg border-(length:--border-width) text-white transition-colors"
        aria-label={t('podcastBrowser:back')}
      >
        <ArrowLeft size={18} className="text-white" />
      </button>

      <button
        type="button"
        data-testid="podcast-favorite-button"
        onClick={handleToggleFavorite}
        className="bg-background border-border hover:bg-background/80 absolute top-4 right-4 z-10 flex size-9 cursor-pointer items-center justify-center rounded-lg border-(length:--border-width) text-white transition-colors"
        aria-label={t(
          isFavorite
            ? 'podcastBrowser:removeFavorite'
            : 'podcastBrowser:addFavorite',
        )}
      >
        <Heart
          size={18}
          className={
            isFavorite ? 'text-accent-red fill-accent-red' : 'text-white'
          }
        />
      </button>

      <div className="flex shrink-0 justify-center pt-8 sm:pt-0">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={podcast.title}
            referrerPolicy="no-referrer"
            onError={() => {
              setFailedUrls((prev) => ({ ...prev, [coverUrl]: true }));
            }}
            className="border-border shadow-shadow size-28 rounded-xl border-(length:--border-width) object-cover sm:size-48 md:size-56"
          />
        ) : (
          <div className="border-border bg-background text-foreground shadow-shadow flex size-28 items-center justify-center rounded-xl border-(length:--border-width) sm:size-48 md:size-56">
            <Mic2 size={40} className="text-foreground/40" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-extrabold tracking-wider !text-black uppercase">
            {podcast.source === 'youtube-music'
              ? 'YouTube Music Podcast'
              : 'Podcast'}
          </span>
          <h1 className="font-heading text-xl font-black tracking-tight break-words !text-black sm:text-4xl md:text-5xl">
            {podcast.title}
          </h1>
          <p className="text-sm font-bold break-words !text-neutral-950 sm:text-base">
            {podcast.publisher}
          </p>
          {podcast.description && (
            <p className="text-xs leading-relaxed font-semibold break-words whitespace-pre-line !text-neutral-950 sm:text-sm">
              {podcast.description}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {podcast.episodes.length > 0 && (
            <Button
              type="button"
              variant="default"
              data-testid="podcast-play-button"
              className="bg-background text-foreground hover:bg-background/90 flex cursor-pointer items-center gap-2 font-bold"
              onClick={handlePlayLatest}
            >
              <Play size={18} fill="currentColor" />
              <span>{t('podcastBrowser:playLatest')}</span>
            </Button>
          )}

          <StatChip
            className="border-border bg-background shadow-shadow text-white"
            value={
              <span className="font-extrabold text-white">
                {podcast.episodes.length}
              </span>
            }
            label={t('common:misc.episodes', { defaultValue: 'Episodios' })}
          />
        </div>
      </div>
    </div>
  );
};
