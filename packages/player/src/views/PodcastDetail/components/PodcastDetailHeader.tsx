import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Heart, Mic2, Play } from 'lucide-react';
import type { FC } from 'react';

import { useTranslation } from '@aurora/i18n';
import { Button, StatChip } from '@aurora/ui';

import { playbackManager } from '../../../services/playback';
import type { PodcastDetail } from '../../../services/podcastService';
import { usePodcastStore } from '../../../stores/podcastStore';
import { useQueueStore } from '../../../stores/queueStore';

type PodcastDetailHeaderProps = {
  podcast: PodcastDetail;
};

export const PodcastDetailHeader: FC<PodcastDetailHeaderProps> = ({ podcast }) => {
  const { t } = useTranslation(['podcastBrowser', 'common']);
  const navigate = useNavigate();
  const { favorites, toggleFavorite } = usePodcastStore();

  const isFavorite = favorites.some((item) => item.id === podcast.id);

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
    const firstEpisode = podcast.episodes[0];
    if (!firstEpisode) return;

    const queue = useQueueStore.getState();
    queue.clearQueue();
    queue.addToQueue(podcast.episodes);
    queue.goToIndex(0);
    playbackManager.play();
  };

  return (
    <div className="border-border bg-primary shadow-shadow relative mx-4 mt-4 flex flex-col gap-6 rounded-xl border-(length:--border-width) p-6 sm:mx-6 sm:mt-6 md:flex-row">
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
        className="bg-background border-border hover:bg-background/80 absolute top-4 left-4 z-10 flex size-9 cursor-pointer items-center justify-center rounded-lg border-(length:--border-width) transition-colors"
        aria-label={t('podcastBrowser:back')}
      >
        <ArrowLeft size={18} />
      </button>

      <button
        type="button"
        data-testid="podcast-favorite-button"
        onClick={handleToggleFavorite}
        className="bg-background border-border hover:bg-background/80 absolute top-4 right-4 z-10 flex size-9 cursor-pointer items-center justify-center rounded-lg border-(length:--border-width) transition-colors"
        aria-label={t(isFavorite ? 'podcastBrowser:removeFavorite' : 'podcastBrowser:addFavorite')}
      >
        <Heart
          size={18}
          className={isFavorite ? 'text-accent-red fill-accent-red' : ''}
        />
      </button>

      <div className="flex shrink-0 justify-center pt-8 md:pt-0">
        {podcast.artwork ? (
          <img
            src={podcast.artwork}
            alt={podcast.title}
            className="border-border shadow-shadow size-48 rounded-xl border-(length:--border-width) object-cover sm:size-56"
          />
        ) : (
          <div className="border-border bg-background shadow-shadow flex size-48 items-center justify-center rounded-xl border-(length:--border-width) sm:size-56">
            <Mic2 size={64} className="opacity-40" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold tracking-wider uppercase opacity-70">
            {podcast.source === 'youtube-music' ? 'YouTube Music Podcast' : 'Podcast'}
          </span>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
            {podcast.title}
          </h1>
          <p className="text-base font-medium opacity-80 sm:text-lg">
            {podcast.publisher}
          </p>
          {podcast.description && (
            <p className="line-clamp-3 text-xs opacity-75 sm:text-sm">
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
              <span>{t('podcastBrowser:play', { name: podcast.episodes[0]?.title ?? '' })}</span>
            </Button>
          )}

          <StatChip
            value={podcast.episodes.length}
            label={t('common:misc.episodes', { defaultValue: 'Episodios' })}
          />
        </div>
      </div>
    </div>
  );
};
