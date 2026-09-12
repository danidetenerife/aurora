import { ArrowLeft, Heart, Mic2, Play } from 'lucide-react';
import { FC, useEffect, useState } from 'react';
import { z } from 'zod';

import { i18n, useTranslation } from '@aurora/i18n';
import type { PodcastRef, Track } from '@aurora/model';
import { ViewShell } from '@aurora/ui';

import { httpHost } from '../../services/httpHost';
import { playbackManager } from '../../services/playback';
import { usePodcastStore } from '../../stores/podcastStore';
import { useQueueStore } from '../../stores/queueStore';

export const PODCASTS: PodcastRef[] = [
  {
    id: 'todopoderosos',
    name: 'Todopoderosos',
    publisher: 'Espacio Fundación Telefónica',
    sourceUrl: 'https://www.ivoox.com/podcast-todopoderosos_sq_f11325_1.html',
  },
  {
    id: 'nude-project',
    name: 'The Nude Project',
    publisher: 'Nude Project',
    sourceUrl: 'https://open.spotify.com/show/3k3d3j3j3j3j3j3j3j3j3j',
  },
  {
    id: 'historia-national',
    name: 'Historia National Geographic',
    publisher: 'National Geographic',
    sourceUrl:
      'https://www.ivoox.com/podcast-historia-national-geographic_sq_f11231_1.html',
  },
  {
    id: 'daily',
    name: 'The Daily',
    publisher: 'The New York Times',
    sourceUrl: 'https://podcasts.apple.com/us/podcast/the-daily/id1200361736',
  },
  {
    id: 'serial',
    name: 'Serial',
    publisher: 'Serial Productions',
    sourceUrl: 'https://serialpodcast.org/',
  },
];

const directorySchema = z.object({
  results: z.array(
    z.object({
      collectionId: z.number().optional(),
      collectionName: z.string().optional(),
      artworkUrl600: z.string().optional(),
      kind: z.string().optional(),
      trackId: z.number().optional(),
      trackName: z.string().optional(),
      episodeUrl: z.string().url().optional(),
      trackTimeMillis: z.number().optional(),
    }),
  ),
});
const requestDirectory = async (path: string) => {
  const response = await httpHost.fetch(`https://itunes.apple.com/${path}`);
  if (response.status !== 200)
    throw new Error(i18n.t('podcastBrowser:loadError'));
  return directorySchema.parse(JSON.parse(response.body)).results;
};
const chartSchema = z.object({
  feed: z.object({
    results: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        artistName: z.string().optional(),
        artworkUrl100: z.string().optional(),
        url: z.string().optional(),
      }),
    ),
  }),
});
export const Podcasts: FC = () => {
  const { t } = useTranslation('podcastBrowser');
  const [selected, setSelected] = useState<PodcastRef | null>(null);
  const [episodes, setEpisodes] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [artwork, setArtwork] = useState<Record<string, string>>({});
  const [catalog, setCatalog] = useState<PodcastRef[]>(PODCASTS);
  const { favorites, load, toggleFavorite } = usePodcastStore();
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    let active = true;
    void httpHost
      .fetch(
        'https://rss.applemarketingtools.com/api/v2/es/podcasts/top/50/podcasts.json',
      )
      .then((response) => {
        if (response.status !== 200) return;
        const results = chartSchema.parse(JSON.parse(response.body)).feed
          .results;
        const podcasts = results.map((item) => ({
          id: `itunes-${item.id}`,
          name: item.name,
          publisher: item.artistName ?? 'Podcast',
          sourceUrl:
            item.url ?? `https://podcasts.apple.com/podcast/id${item.id}`,
        }));
        if (active && podcasts.length > 0) setCatalog(podcasts);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    for (const podcast of catalog) {
      void requestDirectory(
        `search?term=${encodeURIComponent(podcast.name)}&entity=podcast&limit=1`,
      )
        .then((results) => {
          const image = results[0]?.artworkUrl600;
          if (active && image)
            setArtwork((previous) => ({ ...previous, [podcast.id]: image }));
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [catalog]);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    setLoading(true);
    setError('');
    setEpisodes([]);
    const fetchEpisodes = async () => {
      const matches = await requestDirectory(
        `search?term=${encodeURIComponent(selected.name)}&entity=podcast&limit=1`,
      );
      const show = matches[0];
      if (!show?.collectionId) throw new Error(i18n.t('podcastBrowser:empty'));
      const entries = await requestDirectory(
        `lookup?id=${show.collectionId}&entity=podcastEpisode&limit=200`,
      );
      const tracks: Track[] = entries
        .filter((entry) => entry.kind === 'podcast-episode' && entry.episodeUrl)
        .map((entry) => ({
          title: entry.trackName ?? selected.name,
          artists: [{ name: selected.name, roles: ['host'] }],
          source: {
            provider: 'podcast-audio',
            id: String(entry.trackId),
            url: entry.episodeUrl,
          },
          durationMs: entry.trackTimeMillis,
          artwork: {
            items: show.artworkUrl600
              ? [{ url: show.artworkUrl600, purpose: 'thumbnail' }]
              : [],
          },
        }));
      if (active) setEpisodes(tracks);
    };
    void fetchEpisodes()
      .catch((reason: Error) => {
        if (active) setError(reason.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selected]);
  const playEpisode = (track: Track) => {
    const queue = useQueueStore.getState();
    const nextIndex = queue.items.length;
    queue.addToQueue([track]);
    queue.goToIndex(nextIndex);
    playbackManager.play();
  };
  const renderShow = (podcast: PodcastRef) => {
    const favorite = favorites.some((item) => item.id === podcast.id);
    return (
      <div
        key={podcast.id}
        className="border-border bg-background-secondary flex min-w-0 items-center gap-2 rounded-xl border p-2"
      >
        <button
          aria-label={t('open', { name: podcast.name })}
          onClick={() => setSelected(podcast)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          {artwork[podcast.id] ? (
            <img
              src={artwork[podcast.id]}
              alt=""
              className="size-12 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <Mic2 className="size-12 shrink-0" />
          )}
          <span className="min-w-0">
            <strong className="block truncate text-sm">{podcast.name}</strong>
            <span className="block truncate text-xs opacity-60">
              {podcast.publisher}
            </span>
          </span>
        </button>
        <button
          className="flex size-11 shrink-0 items-center justify-center"
          aria-label={t(favorite ? 'removeFavorite' : 'addFavorite')}
          onClick={() => void toggleFavorite(podcast)}
        >
          <Heart size={20} fill={favorite ? 'currentColor' : 'none'} />
        </button>
      </div>
    );
  };
  return (
    <ViewShell>
      <section className="flex w-full min-w-0 flex-col gap-3">
        {selected ? (
          <>
            <button
              onClick={() => setSelected(null)}
              className="flex items-center gap-2 text-sm"
            >
              <ArrowLeft size={18} />
              {t('back')}
            </button>
            <h2 className="text-lg font-bold">{selected.name}</h2>
            {loading && <p role="status">{t('loading')}</p>}
            {error && <p role="alert">{error}</p>}
            {!loading && !error && episodes.length === 0 && <p>{t('empty')}</p>}
            {episodes.map((episode) => (
              <button
                key={episode.source.id}
                aria-label={t('play', { name: episode.title })}
                onClick={() => playEpisode(episode)}
                className="border-border flex min-w-0 items-center gap-3 border-b py-3 text-left"
              >
                <Play size={20} className="text-primary shrink-0" />
                <span className="min-w-0 text-sm">{episode.title}</span>
              </button>
            ))}
          </>
        ) : (
          <>
            {favorites.length > 0 && (
              <>
                <h2 className="text-sm font-semibold">{t('favorites')}</h2>
                {favorites.map(renderShow)}
              </>
            )}
            <h2 className="text-sm font-semibold">{t('available')}</h2>
            {catalog.map(renderShow)}
          </>
        )}
      </section>
    </ViewShell>
  );
};
