import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import {
  Infinity as InfinityIcon,
  Loader2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  ThumbsDown,
  X,
} from 'lucide-react';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { pickArtwork, type Track } from '@aurora/model';
import { cn } from '@aurora/ui';

import { Logger } from '../../services/logger';
import { musicVideoService } from '../../services/musicVideoService';
import { personalizationEngine } from '../../services/personalizationEngine';
import { playbackManager } from '../../services/playback';
import { useQueueStore } from '../../stores/queueStore';
import { useSoundStore } from '../../stores/soundStore';
import { useTvStore } from '../../stores/tvStore';
import { playNextInInfiniteQueue, replenishTvQueue } from './tvInfiniteQueue';
import { extractYouTubeId } from './TvSoundProvider';

const OVERLAY_HIDE_DELAY_MS = 3500;
const SUBTITLE_CHECK_INTERVAL_MS = 1000;
const SUBTITLE_TIMEOUT_MS = 8000;

type TvVideoPlayerProps = {
  videoId?: string;
  track?: Track;
};

export const TvVideoPlayer: FC<TvVideoPlayerProps> = ({
  videoId: propVideoId,
  track,
}) => {
  const [targetVideoId, setTargetVideoId] = useState<string | null>(null);
  const [resolvedVideoTitle, setResolvedVideoTitle] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const hideTimerRef = useRef<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const setShowVideo = useTvStore((state) => state.setShowVideo);
  const setIsVideoPlaying = useTvStore((state) => state.setIsVideoPlaying);
  const soundStatus = useSoundStore((state) => state.status);
  const isAudioPlaying = soundStatus === 'playing';
  const activeTrackKeyRef = useRef<string>('');

  const nextItem = useQueueStore(
    (state) => state.items[state.currentIndex + 1],
  );
  const nextTrack = nextItem?.track;

  const artworkUrl = useMemo(
    () =>
      pickArtwork(track?.artwork ?? track?.album?.artwork, 'thumbnail', 800)
        ?.url ??
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop',
    [track?.artwork, track?.album?.artwork],
  );

  const resetOverlayTimer = useCallback(() => {
    setShowOverlay(true);
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = window.setTimeout(() => {
      if (useSoundStore.getState().status === 'playing') {
        setShowOverlay(false);
      }
    }, OVERLAY_HIDE_DELAY_MS);
  }, []);

  const disableSubtitles = useCallback(() => {
    const iframeWindow = iframeRef.current?.contentWindow;
    if (!iframeWindow) {
      return;
    }
    const commands = [
      { event: 'command', func: 'unloadModule', args: ['captions'] },
      { event: 'command', func: 'unloadModule', args: ['cc'] },
      { event: 'command', func: 'setOption', args: ['captions', 'track', {}] },
      { event: 'command', func: 'setOption', args: ['cc', 'track', {}] },
      {
        event: 'command',
        func: 'setOption',
        args: ['captions', 'fontSize', -1],
      },
      {
        event: 'command',
        func: 'setOption',
        args: ['captions', 'reload', false],
      },
    ];
    for (const command of commands) {
      try {
        iframeWindow.postMessage(JSON.stringify(command), '*');
      } catch {}
    }
  }, []);

  const handleClose = useCallback(() => {
    setIsVideoPlaying(false);
    setShowVideo(false);
    setTimeout(() => {
      setFocus('tv-hero-video');
    }, 50);
  }, [setIsVideoPlaying, setShowVideo]);

  const handleTogglePlay = useCallback(() => {
    playbackManager.toggle();
    resetOverlayTimer();
  }, [resetOverlayTimer]);

  const handleNext = useCallback(() => {
    const { items, currentIndex } = useQueueStore.getState();
    if (currentIndex >= items.length - 2) {
      void replenishTvQueue();
    }
    useQueueStore.getState().goToNext();
    resetOverlayTimer();
  }, [resetOverlayTimer]);

  const handlePrevious = useCallback(() => {
    useQueueStore.getState().goToPrevious();
    resetOverlayTimer();
  }, [resetOverlayTimer]);

  const handleDislike = useCallback(() => {
    if (track) {
      const trackId =
        track.source?.id ||
        `${track.artists?.[0]?.name || ''}-${track.title || ''}`;
      void personalizationEngine.blacklistTrack(trackId);
    }
    handleNext();
  }, [track, handleNext]);

  useEffect(() => {
    let cancelled = false;
    const trackKey = track
      ? `${track.source?.provider || ''}:${track.source?.id || ''}:${track.title || ''}:${track.artists?.[0]?.name || ''}`
      : propVideoId || '';

    activeTrackKeyRef.current = trackKey;
    setLoading(true);
    setError(false);
    setTargetVideoId(null);
    setResolvedVideoTitle(null);
    setIsVideoPlaying(false);

    void (async () => {
      try {
        let videoIdentifier: string | null = null;
        let foundTitle: string | null = null;

        if (track) {
          Logger.streaming.info(
            `Searching official music video for: ${track.artists?.[0]?.name || ''} - ${track.title || ''}`,
          );
          const officialVideo =
            await musicVideoService.findOfficialVideo(track);
          if (cancelled || activeTrackKeyRef.current !== trackKey) {
            return;
          }
          if (officialVideo) {
            videoIdentifier = officialVideo.videoId;
            foundTitle = officialVideo.title;
            Logger.streaming.info(
              `Found official music video: ${videoIdentifier} ("${foundTitle}")`,
            );
          }
        }

        if (!videoIdentifier && propVideoId) {
          videoIdentifier = propVideoId;
        }

        if (!videoIdentifier && track) {
          const fallbackIdentifier = extractYouTubeId(
            track,
            useSoundStore.getState().src?.url,
          );
          if (fallbackIdentifier) {
            videoIdentifier = fallbackIdentifier;
          }
        }

        if (!videoIdentifier) {
          Logger.streaming.warn(
            'No official video or fallback ID available for track',
          );
          if (!cancelled && activeTrackKeyRef.current === trackKey) {
            setError(true);
            setLoading(false);
          }
          return;
        }

        if (!cancelled && activeTrackKeyRef.current === trackKey) {
          setTargetVideoId(videoIdentifier);
          setResolvedVideoTitle(foundTitle);
          setLoading(false);
          setIsVideoPlaying(true);
        }
      } catch (searchError) {
        if (!cancelled && activeTrackKeyRef.current === trackKey) {
          Logger.streaming.error(`Video search error: ${searchError}`);
          setError(true);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      setIsVideoPlaying(false);
    };
  }, [track, propVideoId, setIsVideoPlaying]);

  useEffect(() => {
    resetOverlayTimer();
    const handleActivity = () => {
      resetOverlayTimer();
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    return () => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
      }
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, [resetOverlayTimer]);

  useEffect(() => {
    const handleKeyDown = (keyEvent: KeyboardEvent) => {
      resetOverlayTimer();

      const activeElement = document.activeElement as HTMLElement | null;
      const isFocusedInteractive =
        activeElement?.tagName === 'BUTTON' ||
        activeElement?.tagName === 'INPUT' ||
        activeElement?.getAttribute('role') === 'button';

      if (
        keyEvent.key === 'MediaTrackNext' ||
        keyEvent.key === 'MediaTrackPrevious' ||
        keyEvent.key === 'MediaPlayPause' ||
        keyEvent.key === 'Play' ||
        keyEvent.key === 'Pause'
      ) {
        keyEvent.preventDefault();
        keyEvent.stopPropagation();
        if (keyEvent.key === 'MediaTrackNext') {
          handleNext();
        } else if (keyEvent.key === 'MediaTrackPrevious') {
          handlePrevious();
        } else {
          handleTogglePlay();
        }
        return;
      }

      if (keyEvent.key === 'ArrowUp' || keyEvent.key === 'ArrowDown') {
        setShowOverlay(true);
        return;
      }

      if (isFocusedInteractive) {
        return;
      }

      switch (keyEvent.key) {
        case 'ArrowRight':
          keyEvent.preventDefault();
          keyEvent.stopPropagation();
          handleNext();
          break;
        case 'ArrowLeft':
          keyEvent.preventDefault();
          keyEvent.stopPropagation();
          handlePrevious();
          break;
        case 'Enter':
        case ' ':
        case 'Select':
          keyEvent.preventDefault();
          keyEvent.stopPropagation();
          handleTogglePlay();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleNext, handlePrevious, handleTogglePlay, resetOverlayTimer]);

  useEffect(() => {
    if (!targetVideoId) {
      return;
    }
    const intervalIdentifier = window.setInterval(() => {
      disableSubtitles();
    }, SUBTITLE_CHECK_INTERVAL_MS);
    const timeoutIdentifier = window.setTimeout(() => {
      window.clearInterval(intervalIdentifier);
    }, SUBTITLE_TIMEOUT_MS);
    return () => {
      window.clearInterval(intervalIdentifier);
      window.clearTimeout(timeoutIdentifier);
    };
  }, [targetVideoId, disableSubtitles]);

  useEffect(() => {
    const handleMessage = (messageEvent: MessageEvent) => {
      try {
        const payload =
          typeof messageEvent.data === 'string'
            ? JSON.parse(messageEvent.data)
            : messageEvent.data;
        if (payload?.event === 'onStateChange') {
          disableSubtitles();
          if (payload.info === 1) {
            setIsVideoPlaying(true);
          } else if (payload.info === 2) {
            setIsVideoPlaying(false);
          } else if (payload.info === 0) {
            setIsVideoPlaying(false);
            void playNextInInfiniteQueue();
          }
        } else if (payload?.event === 'initialDelivery') {
          disableSubtitles();
          setIsVideoPlaying(true);
        } else if (payload?.event === 'onError') {
          setError(true);
          setIsVideoPlaying(false);
        }
      } catch {}
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [setIsVideoPlaying, disableSubtitles]);

  useEffect(() => {
    const unsubscribe = useSoundStore.subscribe((state) => {
      const iframeWindow = iframeRef.current?.contentWindow;
      if (!iframeWindow) {
        return;
      }
      if (state.status === 'playing') {
        iframeWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'playVideo' }),
          '*',
        );
      } else if (state.status === 'paused') {
        iframeWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'pauseVideo' }),
          '*',
        );
      }
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div data-testid="tv-video-player" className="tv-video-container">
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-400" />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xl font-black tracking-wide text-white">
              Buscando videoclip oficial…
            </span>
            <span className="text-sm font-semibold text-zinc-400">
              {track
                ? `${track.artists?.[0]?.name || ''} - ${track.title || ''}`
                : ''}
            </span>
          </div>
        </div>
        <button
          onClick={handleClose}
          aria-label="Cerrar búsqueda"
          className="tv-video-btn close absolute top-8 right-8"
        >
          <X className="h-4 w-4" />
          <span>Cancelar (Atrás)</span>
        </button>
      </div>
    );
  }

  if (error || !targetVideoId) {
    return (
      <div
        data-testid="tv-video-player"
        className="tv-video-container flex-col"
      >
        <div
          className="absolute inset-0 scale-125 bg-cover bg-center opacity-25 blur-3xl filter"
          style={{ backgroundImage: `url(${artworkUrl})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/60" />

        <div className="relative z-10 flex max-w-2xl flex-col items-center gap-6 text-center">
          <div className="h-56 w-56 overflow-hidden rounded-3xl border-2 border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
            <img
              src={artworkUrl}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="tv-video-badge infinite">
              <InfinityIcon className="h-4 w-4" />
              <span>Cola Infinita Activa · Reproduciendo Audio</span>
            </div>
            <h2 className="line-clamp-1 text-2xl font-black text-white">
              {track?.title || 'Canción actual'}
            </h2>
            <p className="text-base font-semibold text-zinc-300">
              {track?.artists?.map((artist) => artist.name).join(', ') ||
                'Aurora'}
            </p>
            <p className="text-xs text-zinc-400">
              Sin videoclip disponible · Pasando automáticamente al siguiente
              videoclip
            </p>
          </div>

          <div className="tv-video-controls mt-2">
            <button
              onClick={handlePrevious}
              aria-label="Anterior canción"
              className="tv-video-ctrl-btn"
            >
              <SkipBack className="h-5 w-5" />
            </button>
            <button
              onClick={handleTogglePlay}
              aria-label={isAudioPlaying ? 'Pausar' : 'Reproducir'}
              className="tv-video-ctrl-btn play"
            >
              {isAudioPlaying ? (
                <Pause className="h-7 w-7 fill-current" />
              ) : (
                <Play className="ml-1 h-7 w-7 fill-current" />
              )}
            </button>
            <button
              onClick={handleNext}
              aria-label="Siguiente canción"
              className="tv-video-ctrl-btn"
            >
              <SkipForward className="h-5 w-5" />
            </button>
            <button
              onClick={handleDislike}
              aria-label="No me gusta"
              title="No me gusta"
              className="tv-video-ctrl-btn"
            >
              <ThumbsDown className="h-5 w-5" />
            </button>
          </div>
        </div>

        <button
          onClick={handleClose}
          aria-label="Cerrar vista de vídeo"
          className="tv-video-btn close absolute top-8 right-8 z-20"
        >
          <X className="h-4 w-4" />
          <span>Volver al Dashboard (Atrás)</span>
        </button>
      </div>
    );
  }

  const embedUrl = `https://www.youtube.com/embed/${targetVideoId}?autoplay=1&enablejsapi=1&playsinline=1&controls=0&rel=0&iv_load_policy=3&modestbranding=1`;

  return (
    <div data-testid="tv-video-player" className="tv-video-container">
      <iframe
        ref={iframeRef}
        src={embedUrl}
        title={resolvedVideoTitle || track?.title || 'Videoclip'}
        referrerPolicy="strict-origin-when-cross-origin"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        tabIndex={-1}
        className="tv-video-frame"
        onLoad={() => {
          disableSubtitles();
          try {
            iframeRef.current?.contentWindow?.postMessage(
              JSON.stringify({ event: 'listening' }),
              '*',
            );
          } catch {}
        }}
      />

      <div
        className={cn(
          'tv-video-hud',
          showOverlay ? 'hud-visible' : 'hud-hidden',
        )}
      >
        <div className="tv-video-top">
          <div className="flex items-center gap-4">
            <div className="tv-video-badge official">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              <span>🎬 Videoclip Oficial</span>
            </div>
            <div className="tv-video-title-group">
              <span className="tv-video-title">
                {resolvedVideoTitle || track?.title || ''}
              </span>
              <span className="tv-video-artist">
                {track?.artists?.map((artist) => artist.name).join(', ') || ''}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="tv-video-badge infinite">
              <InfinityIcon className="h-4 w-4" />
              <span>Cola Infinita Activa</span>
            </div>
            <button
              onClick={handleClose}
              aria-label="Cerrar videoclip"
              tabIndex={showOverlay ? 0 : -1}
              className="tv-video-btn close"
            >
              <X className="h-4 w-4" />
              <span>Salir (Atrás)</span>
            </button>
          </div>
        </div>

        <div className="tv-video-bottom">
          <div className="flex items-center justify-between">
            <div className="tv-video-next-preview">
              <span>A continuación:</span>
              <strong>
                {nextTrack
                  ? `${nextTrack.artists?.[0]?.name || ''} - ${nextTrack.title || ''}`
                  : 'Siguiente videoclip recomendado…'}
              </strong>
            </div>

            <div className="tv-video-controls">
              <button
                onClick={handlePrevious}
                aria-label="Videoclip anterior"
                tabIndex={showOverlay ? 0 : -1}
                className="tv-video-ctrl-btn"
              >
                <SkipBack className="h-5 w-5" />
              </button>
              <button
                onClick={handleTogglePlay}
                aria-label={isAudioPlaying ? 'Pausar' : 'Reproducir'}
                tabIndex={showOverlay ? 0 : -1}
                className="tv-video-ctrl-btn play"
              >
                {isAudioPlaying ? (
                  <Pause className="h-6 w-6 fill-current" />
                ) : (
                  <Play className="ml-0.5 h-6 w-6 fill-current" />
                )}
              </button>
              <button
                onClick={handleNext}
                aria-label="Siguiente videoclip"
                tabIndex={showOverlay ? 0 : -1}
                className="tv-video-ctrl-btn"
              >
                <SkipForward className="h-5 w-5" />
              </button>
              <button
                onClick={handleDislike}
                aria-label="No me gusta"
                title="No me gusta"
                tabIndex={showOverlay ? 0 : -1}
                className="tv-video-ctrl-btn"
              >
                <ThumbsDown className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="tv-video-hints">
            Usa el mando a distancia: ◀ Anterior &nbsp;|&nbsp; OK Pausa/Play
            &nbsp;|&nbsp; ▶ Siguiente &nbsp;|&nbsp; Atrás Salir
          </div>
        </div>
      </div>
    </div>
  );
};

export const useTvVideoId = (): string | null => {
  const showVideo = useTvStore((state) => state.showVideo);
  const src = useSoundStore((state) => state.src);

  if (!showVideo) {
    return null;
  }

  const videoIdentifier = extractYouTubeId(undefined, src?.url);
  return videoIdentifier;
};
