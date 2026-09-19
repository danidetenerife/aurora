import {
  FocusContext,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Heart, Mic2, Play, Radio, RotateCcw } from 'lucide-react';
import { FC, useState } from 'react';

import { useTranslation } from '@aurora/i18n';
import { pickArtwork, type PodcastRef } from '@aurora/model';

import { podcastService } from '../../services/podcastService';
import { usePodcastStore } from '../../stores/podcastStore';
import { TvButton } from './TvButton';
import { playTvTracks } from './tvPlayback';

type TvPodcastDetailProps = {
  podcast: PodcastRef;
  onBack: () => void;
};

const formatDuration = (durationMs?: number): string => {
  if (!durationMs || durationMs <= 0) {
    return '';
  }
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const TvPodcastDetail: FC<TvPodcastDetailProps> = ({
  podcast,
  onBack,
}) => {
  const { t } = useTranslation(['tv', 'common']);
  const favorites = usePodcastStore((state) => state.favorites);
  const toggleFavorite = usePodcastStore((state) => state.toggleFavorite);
  const [imageError, setImageError] = useState(false);

  const isFavorite = favorites.some((item) => item.id === podcast.id);

  const { ref, focusKey } = useFocusable({
    focusKey: 'TV_PODCAST_DETAIL',
    trackChildren: true,
    saveLastFocusedChild: true,
  });

  const {
    data: detail,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['podcast-detail', podcast.id],
    queryFn: () => podcastService.getPodcastDetails(podcast.id),
    staleTime: 300000,
  });

  const handleToggleFavorite = () => {
    void toggleFavorite({
      id: podcast.id,
      name: detail?.title ?? podcast.name,
      publisher: detail?.publisher ?? podcast.publisher,
      artworkUrl: detail?.artwork ?? podcast.artworkUrl,
      sourceUrl: podcast.sourceUrl,
    });
  };

  const handlePlayLatest = () => {
    if (detail?.episodes && detail.episodes.length > 0) {
      playTvTracks(detail.episodes, 0);
    }
  };

  const handlePlayEpisode = (episodeIndex: number) => {
    if (detail?.episodes && detail.episodes.length > 0) {
      playTvTracks(detail.episodes, episodeIndex);
    }
  };

  const artworkUrl = detail?.artwork ?? podcast.artworkUrl;
  const title = detail?.title ?? podcast.name;
  const publisher = detail?.publisher ?? podcast.publisher;
  const description = detail?.description;
  const episodes = detail?.episodes ?? [];

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={ref}
        className="tv-podcast-detail"
        data-testid="tv-podcast-detail"
      >
        <div className="tv-podcast-top-bar">
          <TvButton
            focusKey="tv-podcast-back"
            data-testid="tv-podcast-back-button"
            className="tv-podcast-back-btn"
            onClick={onBack}
          >
            <ArrowLeft className="h-5 w-5" />
            <span>
              {t('tv:backToPodcasts', { defaultValue: 'Volver a podcasts' })}
            </span>
          </TvButton>
        </div>

        <div className="tv-podcast-hero">
          <div className="tv-podcast-hero-art">
            {artworkUrl && !imageError ? (
              <img
                src={artworkUrl}
                alt={title}
                onError={() => setImageError(true)}
              />
            ) : (
              <Mic2 className="h-16 w-16 text-emerald-400 opacity-60" />
            )}
          </div>

          <div className="tv-podcast-hero-info">
            <span className="tv-podcast-badge">
              <Radio className="mr-1 inline h-3.5 w-3.5" />
              PODCAST
            </span>
            <h1 className="tv-podcast-title">{title}</h1>
            <p className="tv-podcast-publisher">{publisher}</p>
            {description && <p className="tv-podcast-desc">{description}</p>}

            <div className="tv-podcast-actions">
              {episodes.length > 0 && (
                <TvButton
                  focusKey="tv-podcast-play-latest"
                  data-testid="tv-podcast-play-latest-btn"
                  className="tv-podcast-action-btn tv-podcast-play-btn"
                  onClick={handlePlayLatest}
                >
                  <Play className="h-5 w-5 fill-current" />
                  <span>
                    {t('tv:playLatest', { defaultValue: 'Reproducir último' })}
                  </span>
                </TvButton>
              )}

              <TvButton
                focusKey="tv-podcast-fav"
                data-testid="tv-podcast-fav-btn"
                className={`tv-podcast-action-btn tv-podcast-fav-btn ${isFavorite ? 'active' : ''}`}
                onClick={handleToggleFavorite}
              >
                <Heart
                  className={`h-5 w-5 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`}
                />
                <span>
                  {isFavorite
                    ? t('tv:inFavorites', { defaultValue: 'En Favoritos' })
                    : t('tv:addFavorite', { defaultValue: 'Guardar favorito' })}
                </span>
              </TvButton>

              <span className="tv-podcast-count-badge">
                {episodes.length}{' '}
                {t('tv:episodesCount', { defaultValue: 'episodios' })}
              </span>
            </div>
          </div>
        </div>

        <div className="tv-podcast-episodes">
          <div className="tv-section-header">
            <h2 className="tv-podcast-episodes-heading">
              {t('tv:podcastEpisodes', {
                defaultValue: 'Capítulos disponibles',
              })}
            </h2>
          </div>

          {isLoading && (
            <div className="tv-podcast-state" role="status">
              <Radio className="h-8 w-8 animate-spin text-emerald-400" />
              <span>{t('tv:loading', { defaultValue: 'Cargando…' })}</span>
            </div>
          )}

          {isError && (
            <div className="tv-podcast-state error" role="alert">
              <span>
                {t('tv:loadErrorPodcasts', {
                  defaultValue: 'No se pudieron cargar los episodios.',
                })}
              </span>
              <TvButton
                focusKey="tv-podcast-retry"
                className="tv-podcast-retry-btn"
                onClick={() => void refetch()}
              >
                <RotateCcw className="h-4 w-4" />
                <span>{t('tv:retry', { defaultValue: 'Reintentar' })}</span>
              </TvButton>
            </div>
          )}

          {!isLoading && !isError && episodes.length === 0 && (
            <div className="tv-podcast-state">
              <span>
                {t('tv:noEpisodes', {
                  defaultValue: 'No hay episodios disponibles.',
                })}
              </span>
            </div>
          )}

          {!isLoading && !isError && episodes.length > 0 && (
            <div className="tv-podcast-episodes-list">
              {episodes.map((episode, episodeIndex) => {
                const episodeArtwork =
                  pickArtwork(episode.artwork, 'thumbnail', 200)?.url ??
                  (typeof artworkUrl === 'string' ? artworkUrl : undefined);
                const durationText = formatDuration(episode.durationMs);

                return (
                  <TvButton
                    key={
                      episode.source?.id ?? `${episode.title}-${episodeIndex}`
                    }
                    focusKey={`tv-podcast-ep-${episodeIndex}`}
                    data-testid={`tv-podcast-episode-${episodeIndex}`}
                    className="tv-podcast-episode-row"
                    onClick={() => handlePlayEpisode(episodeIndex)}
                  >
                    <span className="tv-podcast-ep-number">
                      {episodeIndex + 1}
                    </span>

                    <span className="tv-podcast-ep-thumb">
                      {episodeArtwork ? (
                        <img src={episodeArtwork} alt="" loading="lazy" />
                      ) : (
                        <Mic2 className="h-5 w-5 text-emerald-400" />
                      )}
                      <span className="tv-podcast-ep-play-overlay">
                        <Play className="h-4 w-4 fill-white text-white" />
                      </span>
                    </span>

                    <div className="tv-podcast-ep-info">
                      <span className="tv-podcast-ep-title">
                        {episode.title}
                      </span>
                      {durationText && (
                        <span className="tv-podcast-ep-duration">
                          {durationText}
                        </span>
                      )}
                    </div>
                  </TvButton>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </FocusContext.Provider>
  );
};
