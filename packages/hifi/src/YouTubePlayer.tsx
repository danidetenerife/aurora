import { FC, useCallback, useEffect, useRef, useState } from 'react';

import { SoundProps } from './types';

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string | HTMLElement,
        options: {
          videoId: string;
          playerVars?: Record<string, unknown>;
          events?: {
            onReady?: (event: { target: YTPlayerInstance }) => void;
            onStateChange?: (event: {
              data: number;
              target: YTPlayerInstance;
            }) => void;
            onError?: (event: { data: number }) => void;
          };
        },
      ) => YTPlayerInstance;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

type YTPlayerInstance = {
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  setVolume: (volume: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState?: () => number;
  loadVideoById?: (options: { videoId: string; startSeconds?: number }) => void;
  cueVideoById?: (options: { videoId: string; startSeconds?: number }) => void;
  destroy: () => void;
};

const extractYouTubeVideoId = (url: string): string | null => {
  const match = url.match(
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/,
  );
  return match ? match[1] : null;
};

const getPlayerOrigin = (): string | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const { protocol, hostname, origin } = window.location;
  if (
    protocol === 'capacitor:' ||
    protocol === 'file:' ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    !origin ||
    origin === 'null'
  ) {
    return undefined;
  }
  return origin;
};

export const YouTubePlayer: FC<SoundProps> = ({
  src,
  status,
  seek,
  volume,
  showVideo = false,
  onCloseVideo,
  onTimeUpdate,
  onEnd,
  onCanPlay,
  onError,
  onSourceInvalid,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const intervalRef = useRef<number | null>(null);
  const lastSeekRef = useRef<number | undefined>(undefined);
  const hasEndedRef = useRef<boolean>(false);
  const videoId = extractYouTubeVideoId(src.url);

  const statusRef = useRef(status);
  statusRef.current = status;

  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  const onCanPlayRef = useRef(onCanPlay);
  onCanPlayRef.current = onCanPlay;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const onSourceInvalidRef = useRef(onSourceInvalid);
  onSourceInvalidRef.current = onSourceInvalid;

  const onTimeUpdateRef = useRef(onTimeUpdate);
  onTimeUpdateRef.current = onTimeUpdate;

  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      if (firstScriptTag?.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      } else {
        document.head.appendChild(tag);
      }
    }
  }, []);

  // Keep playback running through screen off, backgrounding, and foregrounding
  useEffect(() => {
    const handleKeepPlaying = () => {
      if (statusRef.current === 'playing') {
        try {
          const player = playerRef.current;
          if (player) {
            const playerState = player.getPlayerState?.();
            if (playerState !== 1) {
              player.playVideo();
            }
          }
        } catch {
          void 0;
        }
      }
    };

    document.addEventListener('visibilitychange', handleKeepPlaying);
    window.addEventListener('blur', handleKeepPlaying);
    window.addEventListener('focus', handleKeepPlaying);

    return () => {
      document.removeEventListener('visibilitychange', handleKeepPlaying);
      window.removeEventListener('blur', handleKeepPlaying);
      window.removeEventListener('focus', handleKeepPlaying);
    };
  }, []);

  useEffect(() => {
    if (!videoId) {
      return;
    }

    let isMounted = true;
    hasEndedRef.current = false;

    if (
      playerRef.current &&
      typeof playerRef.current.loadVideoById === 'function'
    ) {
      const startSeconds = seek && seek > 0 ? seek : 0;
      if (statusRef.current === 'playing') {
        try {
          playerRef.current.loadVideoById({ videoId, startSeconds });
        } catch {
          void 0;
        }
      } else {
        try {
          playerRef.current.cueVideoById?.({ videoId, startSeconds });
        } catch {
          void 0;
        }
      }
      return;
    }

    const initPlayer = () => {
      if (!window.YT?.Player || !containerRef.current || !isMounted) {
        return;
      }

      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          void 0;
        }
        playerRef.current = null;
      }

      const container = containerRef.current;
      container.innerHTML = '';
      const placeholder = document.createElement('div');
      placeholder.style.width = '100%';
      placeholder.style.height = '100%';
      container.appendChild(placeholder);

      try {
        const safeOrigin = getPlayerOrigin();
        playerRef.current = new window.YT.Player(placeholder, {
          videoId,
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            playsinline: 1,
            rel: 0,
            enablejsapi: 1,
            iv_load_policy: 3,
            modestbranding: 1,
            ...(safeOrigin ? { origin: safeOrigin } : {}),
          },
          events: {
            onReady: (event) => {
              if (!isMounted) {
                return;
              }
              if (volume !== undefined) {
                try {
                  event.target.setVolume(volume);
                } catch {
                  void 0;
                }
              }
              if (seek && seek > 0) {
                try {
                  event.target.seekTo(seek, true);
                } catch {
                  void 0;
                }
              }
              onCanPlayRef.current?.();
              if (statusRef.current === 'playing') {
                try {
                  event.target.playVideo();
                } catch {
                  void 0;
                }
              } else {
                try {
                  event.target.pauseVideo();
                } catch {
                  void 0;
                }
              }
            },
            onStateChange: (event) => {
              if (!isMounted) {
                return;
              }
              if (event.data === window.YT?.PlayerState.PLAYING) {
                onCanPlayRef.current?.();
                if (statusRef.current !== 'playing') {
                  try {
                    event.target.pauseVideo();
                  } catch {
                    void 0;
                  }
                }
              } else if (event.data === window.YT?.PlayerState.ENDED) {
                if (!hasEndedRef.current) {
                  hasEndedRef.current = true;
                  onEndRef.current?.();
                }
              } else if (
                event.data === window.YT?.PlayerState.PAUSED &&
                statusRef.current === 'playing'
              ) {
                try {
                  event.target.playVideo();
                } catch {
                  void 0;
                }
                setTimeout(() => {
                  if (isMounted && statusRef.current === 'playing') {
                    try {
                      playerRef.current?.playVideo();
                    } catch {
                      void 0;
                    }
                  }
                }, 100);
                setTimeout(() => {
                  if (isMounted && statusRef.current === 'playing') {
                    try {
                      playerRef.current?.playVideo();
                    } catch {
                      void 0;
                    }
                  }
                }, 300);
                setTimeout(() => {
                  if (isMounted && statusRef.current === 'playing') {
                    try {
                      playerRef.current?.playVideo();
                    } catch {
                      void 0;
                    }
                  }
                }, 600);
              }
            },
            onError: (event: { data: number }) => {
              if (isMounted && !hasEndedRef.current) {
                if (event.data === 101 || event.data === 150) {
                  onSourceInvalidRef.current?.();
                }
                onErrorRef.current?.(
                  new Error(`YouTube playback failed (${event.data})`),
                );
              }
            },
          },
        });
      } catch (error) {
        if (isMounted && !hasEndedRef.current) {
          onErrorRef.current?.(
            error instanceof Error ? error : new Error('YouTube init failed'),
          );
        }
      }
    };

    let pollInterval: number | null = null;
    if (window.YT && typeof window.YT.Player === 'function') {
      initPlayer();
    } else {
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previousReady?.();
        initPlayer();
      };
      let attempts = 0;
      pollInterval = window.setInterval(() => {
        attempts += 1;
        if (window.YT && typeof window.YT.Player === 'function') {
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
          initPlayer();
        } else if (attempts > 50) {
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
          if (isMounted) {
            onErrorRef.current?.(new Error('YouTube API load timeout'));
          }
        }
      }, 100);
    }

    return () => {
      isMounted = false;
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          void 0;
        }
        playerRef.current = null;
      }
    };
  }, [videoId]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    if (status === 'playing') {
      try {
        player.playVideo();
      } catch {
        void 0;
      }
    } else if (status === 'paused') {
      try {
        player.pauseVideo();
      } catch {
        void 0;
      }
    } else if (status === 'stopped') {
      try {
        player.stopVideo();
      } catch {
        void 0;
      }
    }
  }, [status]);

  useEffect(() => {
    const player = playerRef.current;
    if (player && volume !== undefined) {
      try {
        player.setVolume(volume);
      } catch {
        void 0;
      }
    }
  }, [volume]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || seek === undefined) {
      return;
    }

    try {
      const currentTime = player.getCurrentTime() || 0;
      const seekDelta = Math.abs(seek - currentTime);

      if (lastSeekRef.current !== seek && seekDelta > 2) {
        player.seekTo(seek, true);
      }
      lastSeekRef.current = seek;
    } catch {
      void 0;
    }
  }, [seek]);

  useEffect(() => {
    if (status === 'playing') {
      intervalRef.current = window.setInterval(() => {
        const player = playerRef.current;
        if (player) {
          try {
            if (statusRef.current === 'playing') {
              const state = player.getPlayerState?.();
              if (state === 2 || state === -1 || state === 5) {
                player.playVideo();
              }
            }
            const position = player.getCurrentTime() || 0;
            const duration = player.getDuration() || 0;
            onTimeUpdateRef.current?.({ position, duration });

            if (
              duration > 0 &&
              position >= duration - 0.8 &&
              !hasEndedRef.current
            ) {
              hasEndedRef.current = true;
              onEndRef.current?.();
            }
          } catch {
            void 0;
          }
        }
      }, 500);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [status]);

  const [showControls, setShowControls] = useState(true);
  const hideTimerRef = useRef<number | null>(null);

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = window.setTimeout(() => {
      setShowControls(false);
    }, 3500);
  }, []);

  return (
    <div
      id="aurora-youtube-player-container"
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
      style={
        showVideo
          ? {
              position: 'fixed',
              bottom: '140px',
              right: '24px',
              zIndex: 60,
              width: '560px',
              maxWidth: 'calc(100vw - 48px)',
              aspectRatio: '16/9',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
              border: '2px solid rgba(255, 255, 255, 0.2)',
              backgroundColor: '#000',
              overflow: 'hidden',
            }
          : {
              position: 'fixed',
              bottom: 0,
              right: 0,
              width: '200px',
              height: '200px',
              overflow: 'hidden',
              pointerEvents: 'none',
              opacity: 0.001,
              zIndex: -1,
            }
      }
    >
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          maxWidth: '100%',
          maxHeight: '100%',
          flexShrink: 0,
        }}
      />
      {showVideo && (
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            right: '12px',
            zIndex: 70,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pointerEvents: 'auto',
            opacity: showControls ? 1 : 0,
            transition: 'opacity 0.3s ease-in-out',
          }}
        >
          <span
            style={{
              padding: '4px 10px',
              borderRadius: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 700,
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            🎬 Videoclip
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseVideo?.();
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(220, 38, 38, 0.9)',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 700,
                border: '1px solid rgba(255, 255, 255, 0.3)',
                cursor: 'pointer',
                backdropFilter: 'blur(8px)',
              }}
              title="Cerrar Videoclip"
            >
              ✕ Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
