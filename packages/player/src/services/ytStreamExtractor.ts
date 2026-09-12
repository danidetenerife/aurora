import { registerPlugin } from '@capacitor/core';

type YtStreamExtractorPluginInterface = {
  extractAudioUrl(options: { videoId: string }): Promise<{ streamUrl: string }>;
};

const NativeYtStreamExtractor =
  registerPlugin<YtStreamExtractorPluginInterface>('YtStreamExtractor');

const extractViaDomIframe = (videoId: string): Promise<string> =>
  new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('DOM document not available'));
      return;
    }

    try {
      performance.clearResourceTimings();
    } catch {
      // ignore
    }

    const startTime = performance.now();
    const iframe = document.createElement('iframe');
    iframe.style.width = '300px';
    iframe.style.height = '200px';
    iframe.style.position = 'fixed';
    iframe.style.bottom = '-9999px';
    iframe.style.opacity = '0.01';
    iframe.allow = 'autoplay; encrypted-media';

    let resolved = false;

    const cleanup = () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    };

    const checkResources = () => {
      if (resolved) {
        return;
      }
      const entries = performance.getEntriesByType('resource');
      for (
        let entryIndex = entries.length - 1;
        entryIndex >= 0;
        entryIndex -= 1
      ) {
        const entry = entries[entryIndex];
        if (entry.startTime < startTime - 50) {
          break;
        }

        const name = entry.name;
        const lower = name.toLowerCase();

        const isHls =
          lower.includes('googlevideo.com') && lower.includes('hls_playlist');
        const isAudioItag =
          lower.includes('itag/234') ||
          lower.includes('itag%2f234') ||
          lower.includes('itag/140') ||
          lower.includes('itag%2f140') ||
          lower.includes('itag/251') ||
          lower.includes('itag%2f251');
        const isSeg = lower.includes('file/seg.ts');

        const isDashAudio =
          lower.includes('videoplayback') &&
          (lower.includes('mime=audio') ||
            lower.includes('mime%3daudio') ||
            lower.includes('audio%2f') ||
            lower.includes('audio/')) &&
          !lower.includes('mime=video') &&
          !lower.includes('mime%3dvideo');

        const isDubbed =
          (lower.includes('dubbed-auto') || lower.includes('dubbed')) &&
          !lower.includes('lang=es') &&
          !lower.includes('acont=original');

        if (
          (isHls &&
            (isAudioItag || lower.includes('playlist/index.m3u8')) &&
            !isSeg &&
            !isDubbed) ||
          (isDashAudio && !isDubbed)
        ) {
          resolved = true;
          cleanup();
          let rawUrl = name;
          if (name.includes('?u=')) {
            rawUrl = decodeURIComponent(name.split('?u=')[1]);
          }
          resolve(rawUrl);
          return;
        }
      }
    };

    const intervalId = setInterval(checkResources, 150);
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(new Error('Iframe stream extraction timed out'));
      }
    }, 6000);

    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&playsinline=1&hl=es&gl=ES&enablejsapi=1`;
    document.body.appendChild(iframe);
  });

export const YtStreamExtractor = {
  extractAudioUrl: async (options: {
    videoId: string;
  }): Promise<{ streamUrl: string }> => {
    try {
      const streamUrl = await extractViaDomIframe(options.videoId);
      if (streamUrl) {
        return { streamUrl };
      }
    } catch {
      // ignore
    }

    try {
      return await NativeYtStreamExtractor.extractAudioUrl(options);
    } catch {
      return { streamUrl: '' };
    }
  },
};
