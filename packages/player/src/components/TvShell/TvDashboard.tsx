import {
  FocusContext,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import {
  Coffee,
  Compass,
  Disc,
  Flame,
  Heart,
  ListMusic,
  Mic2,
  Music,
  Play,
  Radio,
  Search,
  Sparkles,
  Video,
} from 'lucide-react';
import { FC, useEffect, useState } from 'react';

import { pickArtwork, type Track } from '@aurora/model';
import type { MetadataProvider } from '@aurora/plugin-sdk';

import { useProviders } from '../../hooks/useProviders';
import { personalizationEngine } from '../../services/personalizationEngine';
import { providersHost } from '../../services/providersHost';
import { useFavoritesStore } from '../../stores/favoritesStore';
import { usePlaylistStore } from '../../stores/playlistStore';
import { usePodcastStore } from '../../stores/podcastStore';
import { useTvStore } from '../../stores/tvStore';
import { TvButton } from './TvButton';
import { TvFocusableCard } from './TvFocusableCard';
import { playTvTracks } from './tvPlayback';

export const POPULAR_TV_PLAYLISTS = [
  {
    id: 'pop_hits',
    title: "Today's Top Hits",
    subtitle: 'Los mayores éxitos mundiales',
    query: 'Pop Hits Top',
    src: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop',
  },
  {
    id: 'viva_latino',
    title: 'Viva Latino',
    subtitle: 'Lo mejor de la música latina',
    query: 'Viva Latino Éxitos',
    src: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop',
  },
  {
    id: 'rock_classics',
    title: 'Rock Classics',
    subtitle: 'Grandes leyendas del rock',
    query: 'Classic Rock Hits',
    src: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=600&auto=format&fit=crop',
  },
  {
    id: 'yt_top',
    title: 'Tendencias Globales',
    subtitle: 'Canciones más escuchadas',
    query: 'Trending Music Global',
    src: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop',
  },
  {
    id: 'relax_chill',
    title: 'Chill & Relax',
    subtitle: 'Sonidos para relajarse',
    query: 'Chill Lo-Fi Beats',
    src: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&auto=format&fit=crop',
  },
];

export const TV_MOOD_CAPSULES = [
  {
    id: 'latino',
    title: 'Latino Urbano',
    desc: 'Reggaeton, Trap & Éxitos',
    query: 'Reggaeton Hits 2026',
    gradient: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
    icon: Flame,
  },
  {
    id: 'pop',
    title: 'Pop & Tendencias',
    desc: 'Los hits mundiales del momento',
    query: 'Top Pop Hits Global',
    gradient: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
    icon: Sparkles,
  },
  {
    id: 'rock',
    title: 'Rock & Leyendas',
    desc: 'Grandes himnos, clásicos e indie',
    query: 'Classic Rock Hits',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)',
    icon: Flame,
  },
  {
    id: 'electronic',
    title: 'Electro & Dance',
    desc: 'Club, House, EDM & Techno',
    query: 'Electronic Dance Music',
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
    icon: Disc,
  },
  {
    id: 'chill',
    title: 'Chill & Lo-Fi',
    desc: 'Sonidos tranquilos para relajarse',
    query: 'Lo-Fi Chill Beats',
    gradient: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
    icon: Coffee,
  },
  {
    id: 'hiphop',
    title: 'Hip-Hop & Urban',
    desc: 'Flow, Beats pesados y Rap',
    query: 'Hip-Hop R&B Hits',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    icon: Mic2,
  },
  {
    id: 'calm',
    title: 'Acústico & Piano',
    desc: 'Melodías suaves y armonía',
    query: 'Acoustic Calm Music',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
    icon: Music,
  },
];

const DEFAULT_HERO_TRACK: Track = {
  title: "Today's Billboard Hits",
  artists: [{ name: 'Artistas Destacados', roles: [] }],
  source: { provider: 'featured', id: 'hero-top-hit' },
  artwork: {
    items: [
      {
        url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop',
        purpose: 'thumbnail',
      },
    ],
  },
};

export const TvDashboard: FC = () => {
  const [recommendedTracks, setRecommendedTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  const favorites = useFavoritesStore((state) => state.tracks);
  const playlists = usePlaylistStore((state) => state.index);
  const podcastFavorites = usePodcastStore((state) => state.favorites);

  const metadataProviders = useProviders('metadata') as MetadataProvider[];
  const activeProviderId =
    providersHost.getActive('metadata') ?? metadataProviders[0]?.id ?? null;
  const metadataProvider =
    metadataProviders.find((provider) => provider.id === activeProviderId) ??
    metadataProviders[0];

  const { ref, focusKey } = useFocusable({
    focusKey: 'TV_DASHBOARD',
    trackChildren: true,
    saveLastFocusedChild: true,
  });

  const rowRecommended = useFocusable({
    focusKey: 'TV_ROW_RECOMMENDED',
    trackChildren: true,
    saveLastFocusedChild: true,
  });

  const rowMoods = useFocusable({
    focusKey: 'TV_ROW_MOODS',
    trackChildren: true,
    saveLastFocusedChild: true,
  });

  const rowPopular = useFocusable({
    focusKey: 'TV_ROW_POPULAR',
    trackChildren: true,
    saveLastFocusedChild: true,
  });

  const rowExplore = useFocusable({
    focusKey: 'TV_ROW_EXPLORE',
    trackChildren: true,
    saveLastFocusedChild: true,
  });

  const loadRecommendations = async () => {
    try {
      const topArtists = await personalizationEngine.getTopArtists();
      const topGenres = await personalizationEngine.getTopGenres(3);

      const queries: string[] = [];
      if (topArtists.length > 0) {
        queries.push(...topArtists.slice(0, 2).map((artist) => artist.name));
      }
      if (topGenres.length > 0) {
        queries.push(
          ...topGenres.slice(0, 2).map((genre) => `${genre.genre} hits`),
        );
      }
      if (queries.length === 0) {
        queries.push('Top Hits 2026', 'Latin Hits');
      }

      if (metadataProvider?.search) {
        const results: Track[] = [];
        for (const query of queries) {
          try {
            const searchRes = await metadataProvider.search({
              query,
              types: ['tracks'],
            });
            if (searchRes.tracks?.length) {
              results.push(...searchRes.tracks.slice(0, 4));
            }
          } catch {}
        }
        if (results.length > 0) {
          const seen = new Set<string>();
          const unique = results.filter((track) => {
            const key = `${track.title}-${track.artists?.[0]?.name}`;
            if (seen.has(key)) {
              return false;
            }
            seen.add(key);
            return true;
          });
          setRecommendedTracks(unique);
        }
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRecommendations();

    const unsubscribe = personalizationEngine.subscribe(() => {
      void loadRecommendations();
    });

    return () => {
      unsubscribe();
    };
  }, [metadataProvider]);

  const handlePlayPlaylist = async (query: string) => {
    if (!metadataProvider?.search) {
      useTvStore.getState().openSearch();
      return;
    }
    try {
      const res = await metadataProvider.search({ query, types: ['tracks'] });
      if (res.tracks?.length) {
        playTvTracks(res.tracks);
      }
    } catch {
      useTvStore.getState().openSearch();
    }
  };

  const heroTrack = recommendedTracks[0] ?? DEFAULT_HERO_TRACK;
  const heroArtUrl =
    pickArtwork(heroTrack.artwork, 'thumbnail', 600)?.url ??
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop';
  const isHeroFavorite = favorites.some(
    (item) =>
      item.ref.title === heroTrack.title &&
      item.ref.artists?.[0]?.name === heroTrack.artists?.[0]?.name,
  );

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} data-testid="tv-dashboard" className="tv-dashboard">
        <div className="tv-hero">
          <div
            className="tv-hero-backdrop"
            style={{ backgroundImage: `url(${heroArtUrl})` }}
          />
          <div className="tv-hero-overlay" />
          <div className="tv-hero-content">
            <div className="tv-hero-badges">
              <span className="tv-hero-badge featured">✨ Destacado para ti</span>
              <span className="tv-hero-badge video">🎬 Modo Videoclip</span>
            </div>
            <h1 className="tv-hero-title">{heroTrack.title}</h1>
            <p className="tv-hero-artist">
              {heroTrack.artists?.map((artist) => artist.name).join(', ') || 'Aurora Music'}
            </p>
            <div className="tv-hero-actions">
              <TvButton
                focusKey="tv-hero-play"
                className="primary"
                destinations={{
                  up: 'tv-nav-dashboard',
                  down: 'tv-stat-favs',
                  right: 'tv-hero-video',
                }}
                onClick={() => playTvTracks([heroTrack])}
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Reproducir ahora</span>
              </TvButton>
              <TvButton
                focusKey="tv-hero-video"
                destinations={{
                  left: 'tv-hero-play',
                  up: 'tv-nav-dashboard',
                  down: 'tv-stat-favs',
                  right: 'tv-hero-fav',
                }}
                onClick={() => {
                  playTvTracks([heroTrack]);
                  useTvStore.getState().setShowVideo(true);
                }}
              >
                <Video className="h-4 w-4" />
                <span>Ver Videoclip</span>
              </TvButton>
              <TvButton
                focusKey="tv-hero-fav"
                destinations={{
                  left: 'tv-hero-video',
                  up: 'tv-nav-dashboard',
                  down: 'tv-stat-favs',
                }}
                onClick={() => {
                  if (isHeroFavorite) {
                    if (heroTrack.source) {
                      void useFavoritesStore.getState().removeTrack(heroTrack.source);
                    }
                  } else {
                    void useFavoritesStore.getState().addTrack(heroTrack);
                  }
                }}
              >
                <Heart
                  className={`h-4 w-4 ${
                    isHeroFavorite ? 'fill-emerald-400 text-emerald-400' : ''
                  }`}
                />
                <span>{isHeroFavorite ? 'Guardado' : 'Favorito'}</span>
              </TvButton>
            </div>
          </div>
          <div className="tv-hero-art-side">
            <div className="tv-hero-art-card">
              <img src={heroArtUrl} alt="" />
            </div>
          </div>
        </div>

        <div className="tv-stats-bar">
          <TvButton
            focusKey="tv-stat-favs"
            className="tv-stat-chip"
            destinations={{
              up: 'tv-hero-play',
              down: 'TV_ROW_RECOMMENDED',
              right: 'tv-stat-playlists',
            }}
            onClick={() => useTvStore.getState().setActiveSection('favorites')}
          >
            <div
              className="tv-stat-chip-icon"
              style={{ background: 'rgba(236, 72, 153, 0.15)', color: '#ec4899' }}
            >
              <Heart className="h-4 w-4 fill-current" />
            </div>
            <div>
              <div className="tv-stat-chip-title">Tus Favoritos</div>
              <div className="tv-stat-chip-value">{favorites.length} canciones</div>
            </div>
          </TvButton>

          <TvButton
            focusKey="tv-stat-playlists"
            className="tv-stat-chip"
            destinations={{
              left: 'tv-stat-favs',
              up: 'tv-hero-play',
              down: 'TV_ROW_RECOMMENDED',
              right: 'tv-stat-podcasts',
            }}
            onClick={() => useTvStore.getState().setActiveSection('playlists')}
          >
            <div
              className="tv-stat-chip-icon"
              style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}
            >
              <ListMusic className="h-4 w-4" />
            </div>
            <div>
              <div className="tv-stat-chip-title">Tus Listas</div>
              <div className="tv-stat-chip-value">{playlists.length} guardadas</div>
            </div>
          </TvButton>

          <TvButton
            focusKey="tv-stat-podcasts"
            className="tv-stat-chip"
            destinations={{
              left: 'tv-stat-playlists',
              up: 'tv-hero-play',
              down: 'TV_ROW_RECOMMENDED',
              right: 'tv-stat-sync',
            }}
            onClick={() => useTvStore.getState().setActiveSection('podcasts')}
          >
            <div
              className="tv-stat-chip-icon"
              style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}
            >
              <Radio className="h-4 w-4" />
            </div>
            <div>
              <div className="tv-stat-chip-title">Podcasts</div>
              <div className="tv-stat-chip-value">
                {podcastFavorites.length} guardados
              </div>
            </div>
          </TvButton>

          <TvButton
            focusKey="tv-stat-sync"
            className="tv-stat-chip"
            destinations={{
              left: 'tv-stat-podcasts',
              up: 'tv-hero-play',
              down: 'TV_ROW_RECOMMENDED',
            }}
            onClick={() => useTvStore.getState().setActiveSection('settings')}
          >
            <div
              className="tv-stat-chip-icon"
              style={{ background: 'rgba(98, 226, 189, 0.15)', color: '#62e2bd' }}
            >
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="tv-stat-chip-title">Sincronización</div>
              <div className="tv-stat-chip-value">GitHub</div>
            </div>
          </TvButton>
        </div>

        <section className="tv-section">
          <header className="tv-section-header">
            <div className="tv-section-icon recommended">
              <Sparkles />
            </div>
            <h2 className="tv-section-title">Música recomendada para ti</h2>
            <span className="tv-section-badge">Personalizado</span>
          </header>

          <FocusContext.Provider value={rowRecommended.focusKey}>
            <div ref={rowRecommended.ref} className="tv-row-scroller">
              {recommendedTracks.length > 0
                ? recommendedTracks.map((track, index) => (
                    <TvFocusableCard
                      key={`rec-${track.source?.provider}-${track.source?.id}-${index}`}
                      title={track.title || ''}
                      subtitle={track.artists
                        ?.map((artist) => artist.name)
                        .join(', ')}
                      src={pickArtwork(track.artwork, 'thumbnail', 300)?.url}
                      focusKey={`tv-dash-rec-${index}`}
                      destinations={{
                        up: 'tv-stat-favs',
                        down: 'TV_ROW_MOODS',
                      }}
                      onClick={() => playTvTracks(recommendedTracks, index)}
                    >
                      <Music />
                    </TvFocusableCard>
                  ))
                : loading && (
                    <p className="tv-empty" role="status">
                      Cargando recomendaciones personalizadas…
                    </p>
                  )}

              <TvFocusableCard
                title="Buscar más música"
                subtitle="Explora artistas y canciones"
                focusKey="tv-dash-search-card"
                destinations={{
                  up: 'tv-stat-favs',
                  down: 'TV_ROW_MOODS',
                }}
                onClick={() => useTvStore.getState().openSearch()}
              >
                <Search />
              </TvFocusableCard>
            </div>
          </FocusContext.Provider>
        </section>

        <section className="tv-section">
          <header className="tv-section-header">
            <div className="tv-section-icon explore">
              <Compass />
            </div>
            <h2 className="tv-section-title">Explora por Estado de Ánimo & Géneros</h2>
            <span className="tv-section-badge">7 Estilos</span>
          </header>

          <FocusContext.Provider value={rowMoods.focusKey}>
            <div ref={rowMoods.ref} className="tv-row-scroller">
              {TV_MOOD_CAPSULES.map((mood, index) => {
                const Icon = mood.icon;
                return (
                  <TvButton
                    key={mood.id}
                    focusKey={`tv-dash-mood-${index}`}
                    className="tv-mood-card"
                    style={{ background: mood.gradient }}
                    destinations={{
                      up: 'TV_ROW_RECOMMENDED',
                      down: 'TV_ROW_POPULAR',
                    }}
                    onClick={() => void handlePlayPlaylist(mood.query)}
                  >
                    <div className="tv-mood-watermark">
                      <Icon />
                    </div>
                    <div>
                      <h3 className="tv-mood-title">{mood.title}</h3>
                      <p className="tv-mood-desc">{mood.desc}</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white/90">
                      <Play className="h-3 w-3 fill-current" />
                      <span>Escuchar mix</span>
                    </div>
                  </TvButton>
                );
              })}
            </div>
          </FocusContext.Provider>
        </section>

        <section className="tv-section">
          <header className="tv-section-header">
            <div className="tv-section-icon trending">
              <Flame />
            </div>
            <h2 className="tv-section-title">Listas Populares y Tendencias</h2>
            <span className="tv-section-badge">Top 5</span>
          </header>

          <FocusContext.Provider value={rowPopular.focusKey}>
            <div ref={rowPopular.ref} className="tv-row-scroller">
              {POPULAR_TV_PLAYLISTS.map((playlist, index) => (
                <TvFocusableCard
                  key={playlist.id}
                  title={playlist.title}
                  subtitle={playlist.subtitle}
                  src={playlist.src}
                  focusKey={`tv-dash-popular-${index}`}
                  destinations={{
                    up: 'TV_ROW_MOODS',
                    down: 'TV_ROW_EXPLORE',
                  }}
                  onClick={() => void handlePlayPlaylist(playlist.query)}
                >
                  <ListMusic />
                </TvFocusableCard>
              ))}
            </div>
          </FocusContext.Provider>
        </section>

        <section className="tv-section">
          <header className="tv-section-header">
            <div className="tv-section-icon explore">
              <Compass />
            </div>
            <h2 className="tv-section-title">Explorar y Accesos Rápidos</h2>
            <span className="tv-section-badge">Biblioteca</span>
          </header>

          <FocusContext.Provider value={rowExplore.focusKey}>
            <div ref={rowExplore.ref} className="tv-row-scroller">
              <TvFocusableCard
                className="tv-card-quick"
                title="Mis Favoritos"
                subtitle="Tus canciones guardadas"
                focusKey="tv-dash-quick-favs"
                destinations={{
                  up: 'TV_ROW_POPULAR',
                  down: 'tv-control-play',
                }}
                onClick={() =>
                  useTvStore.getState().setActiveSection('favorites')
                }
              >
                <Heart />
              </TvFocusableCard>

              <TvFocusableCard
                className="tv-card-quick"
                title="Mis Listas"
                subtitle="Tus playlists creadas"
                focusKey="tv-dash-quick-lists"
                destinations={{
                  up: 'TV_ROW_POPULAR',
                  down: 'tv-control-play',
                }}
                onClick={() =>
                  useTvStore.getState().setActiveSection('playlists')
                }
              >
                <ListMusic />
              </TvFocusableCard>

              <TvFocusableCard
                className="tv-card-quick"
                title="Podcasts"
                subtitle="Programas y episodios"
                focusKey="tv-dash-quick-podcasts"
                destinations={{
                  up: 'TV_ROW_POPULAR',
                  down: 'tv-control-play',
                }}
                onClick={() =>
                  useTvStore.getState().setActiveSection('podcasts')
                }
              >
                <Radio />
              </TvFocusableCard>

              <TvFocusableCard
                className="tv-card-quick"
                title="Sincronizar GitHub"
                subtitle="Conectar cuenta y favoritos"
                focusKey="tv-dash-quick-sync"
                destinations={{
                  up: 'TV_ROW_POPULAR',
                  down: 'tv-control-play',
                }}
                onClick={() =>
                  useTvStore.getState().setActiveSection('settings')
                }
              >
                <Sparkles />
              </TvFocusableCard>
            </div>
          </FocusContext.Provider>
        </section>
      </div>
    </FocusContext.Provider>
  );
};
