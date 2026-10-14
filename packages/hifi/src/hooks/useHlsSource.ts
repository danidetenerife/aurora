import Hls from 'hls.js';
import { RefObject, useEffect, useRef } from 'react';

import { SoundError } from '../SoundError';
import { AudioSource } from '../types';

const canPlayNativeHls = (audio: HTMLAudioElement): boolean =>
  audio.canPlayType('application/vnd.apple.mpegurl') !== '';

export const useHlsSource = (
  audioRef: RefObject<HTMLAudioElement | null>,
  src: AudioSource,
  onError?: (error: Error) => void,
  onSourceInvalid?: () => void,
) => {
  const hlsRef = useRef<Hls | null>(null);
  const prevUrl = useRef<string | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onSourceInvalidRef = useRef(onSourceInvalid);
  onSourceInvalidRef.current = onSourceInvalid;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    if (src.protocol !== 'hls') {
      prevUrl.current = null;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      return;
    }
    if (src.url === prevUrl.current) {
      return;
    }
    prevUrl.current = src.url;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) {
          return;
        }
        const statusCode = data.response?.code;
        if (statusCode === 401 || statusCode === 403 || statusCode === 410) {
          onSourceInvalidRef.current?.();
          return;
        }
        onErrorRef.current?.(
          new SoundError('loadFailed', data.details || 'HLS playback error'),
        );
      });
      hls.attachMedia(audio);
      hls.loadSource(src.url);
      hlsRef.current = hls;
    } else if (canPlayNativeHls(audio)) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audio.src = src.url;
      audio.load();
    }
  }, [src, audioRef]);

  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);
};
