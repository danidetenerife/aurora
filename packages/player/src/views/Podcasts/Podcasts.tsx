import { Heart, Mic2 } from 'lucide-react';
import { FC, useEffect, useState } from 'react';

import type { PodcastRef } from '@aurora/model';
import { Button, Card, CardGrid, ViewShell } from '@aurora/ui';

import { usePodcastStore } from '../../stores/podcastStore';

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

export const Podcasts: FC = () => {
  const [artwork, setArtwork] = useState<Record<string, string>>({});
  const favorites = usePodcastStore((state) => state.favorites);
  const loaded = usePodcastStore((state) => state.loaded);
  const load = usePodcastStore((state) => state.load);
  const toggleFavorite = usePodcastStore((state) => state.toggleFavorite);
  useEffect(() => {
    if (!loaded) {
      void load();
    }
  }, [load, loaded]);
  useEffect(() => {
    let cancelled = false;
    const loadArtwork = async () => {
      const entries = await Promise.all(
        PODCASTS.map(async (podcast) => {
          try {
            const response = await fetch(
              `https://itunes.apple.com/search?term=${encodeURIComponent(podcast.name)}&entity=podcast&limit=1`,
            );
            const data = (await response.json()) as {
              results?: Array<{ artworkUrl600?: string; artworkUrl100?: string }>;
            };
            const image = data.results?.[0]?.artworkUrl600 ?? data.results?.[0]?.artworkUrl100;
            return image ? [podcast.id, image] as const : null;
          } catch {
            return null;
          }
        }),
      );
      if (!cancelled) {
        setArtwork(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry !== null)));
      }
    };
    void loadArtwork();
    return () => { cancelled = true; };
  }, []);
  return (
    <ViewShell>
      <section className="space-y-4">
        <h2 className="text-xl font-bold">Podcasts disponibles</h2>
        <CardGrid>
          {PODCASTS.map((podcast) => {
            const favorite = favorites.some((item) => item.id === podcast.id);
            return (
              <Card
                key={podcast.id}
                title={podcast.name}
                subtitle={podcast.publisher}
                src={artwork[podcast.id]}
                image={!artwork[podcast.id] ? <Mic2 className="m-auto size-16 opacity-60" /> : undefined}
                action={
                  <Button
                    size="icon"
                    variant="noShadow"
                    aria-label={
                      favorite ? 'Quitar de favoritos' : 'Añadir a favoritos'
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      void toggleFavorite(podcast);
                    }}
                  >
                    <Heart fill={favorite ? 'currentColor' : 'none'} />
                  </Button>
                }
                onClick={() =>
                  window.open(
                    podcast.sourceUrl,
                    '_blank',
                    'noopener,noreferrer',
                  )
                }
              />
            );
          })}
        </CardGrid>
        {favorites.length > 0 && (
          <>
            <h2 className="text-xl font-bold">Podcasts favoritos</h2>
            <CardGrid>
              {favorites.map((podcast) => (
                <Card
                  key={podcast.id}
                  title={podcast.name}
                  subtitle={podcast.publisher}
                  src={artwork[podcast.id]}
                  onClick={() =>
                    window.open(
                      podcast.sourceUrl,
                      '_blank',
                      'noopener,noreferrer',
                    )
                  }
                />
              ))}
            </CardGrid>
          </>
        )}
      </section>
    </ViewShell>
  );
};
