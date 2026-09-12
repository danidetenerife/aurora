import { useNavigate } from '@tanstack/react-router';
import { Heart, Mic2 } from 'lucide-react';
import { FC, useEffect, useState } from 'react';

import { useTranslation } from '@aurora/i18n';
import type { PodcastRef } from '@aurora/model';
import { ViewShell } from '@aurora/ui';

import { podcastService } from '../../services/podcastService';
import { usePodcastStore } from '../../stores/podcastStore';

export const PODCASTS: PodcastRef[] = [
  {
    id: 'MPSPPLzuFY9Ixj9Z4G5-eRHblrmwMOY7tLUCHi',
    name: 'The Wild Project',
    publisher: 'Jordi Wild',
    sourceUrl:
      'https://music.youtube.com/browse/MPSPPLzuFY9Ixj9Z4G5-eRHblrmwMOY7tLUCHi',
  },
  {
    id: 'MPSPPLlDZ74Qz5KgziPV5gTjd5QDsey1znyS_d',
    name: 'Terrores Criminales',
    publisher: 'Terrores Nocturnos Podcast',
    sourceUrl:
      'https://music.youtube.com/browse/MPSPPLlDZ74Qz5KgziPV5gTjd5QDsey1znyS_d',
  },
  {
    id: 'MPSPPLVYKDE9WjKYQ',
    name: 'Nadie Sabe Nada',
    publisher: 'SER Podcast',
    sourceUrl: 'https://music.youtube.com/browse/MPSPPLVYKDE9WjKYQ',
  },
  {
    id: 'MPSPPL01FNQnUl7YKuI7iD1lwxKz8Ho3J8L8Of',
    name: 'ROCA PROJECT',
    publisher: 'Carlos Roca',
    sourceUrl:
      'https://music.youtube.com/browse/MPSPPL01FNQnUl7YKuI7iD1lwxKz8Ho3J8L8Of',
  },
  {
    id: 'MPSPPLIijRqUddPmhs7b8p_0VxYA3Dvh4629EJ',
    name: 'Extra Anormal Podcast',
    publisher: 'Podcast Extra Anormal',
    sourceUrl:
      'https://music.youtube.com/browse/MPSPPLIijRqUddPmhs7b8p_0VxYA3Dvh4629EJ',
  },
  {
    id: 'MPSPPL0rT9kkqIgDewaqNB7hwUJ1_TxGr4jiCt',
    name: 'Gusgri Podcast',
    publisher: 'Doble G',
    sourceUrl:
      'https://music.youtube.com/browse/MPSPPL0rT9kkqIgDewaqNB7hwUJ1_TxGr4jiCt',
  },
  {
    id: 'todopoderosos',
    name: 'Todopoderosos',
    publisher: 'Espacio Fundación Telefónica',
    sourceUrl: 'https://music.youtube.com/search?q=todopoderosos',
  },
];

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
  const [catalog, setCatalog] = useState<PodcastRef[]>(PODCASTS);
  const [artwork, setArtwork] = useState<Record<string, string>>({});
  const { favorites, load, toggleFavorite } = usePodcastStore();

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let active = true;
    void podcastService
      .getFeaturedPodcasts()
      .then((results) => {
        if (!active || results.length === 0) {
          return;
        }
        const mapped: PodcastRef[] = results.map((item) => ({
          id: item.id,
          name: item.name,
          publisher: item.publisher,
          artworkUrl: item.artwork,
          sourceUrl: `https://music.youtube.com/browse/${item.id}`,
        }));
        setCatalog(mapped);
        const artMap: Record<string, string> = {};
        for (const item of results) {
          if (item.artwork) {
            artMap[item.id] = item.artwork;
          }
        }
        setArtwork((previous) => ({ ...previous, ...artMap }));
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  const handleOpenPodcast = (podcast: PodcastRef) => {
    void navigate({
      to: '/podcast/$podcastId',
      params: { podcastId: podcast.id },
    });
  };

  const renderShow = (podcast: PodcastRef) => {
    const favorite = favorites.some((item) => item.id === podcast.id);
    const coverArt = podcast.artworkUrl || artwork[podcast.id];

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
        <div className="flex flex-col gap-2">{catalog.map(renderShow)}</div>
      </section>
    </ViewShell>
  );
};

