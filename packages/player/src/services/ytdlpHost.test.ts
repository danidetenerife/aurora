import { beforeEach, describe, expect, it, vi } from 'vitest';

import { httpHost } from './httpHost';
import { ytdlpHost } from './ytdlpHost';

vi.mock('./universalStore', () => ({
  isTauriEnvironment: vi.fn().mockReturnValue(false),
  isCapacitorEnvironment: vi.fn().mockReturnValue(false),
}));

describe('ytdlpHost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getStream direct extraction', () => {
    it('returns direct audio stream info when YouTube player API returns HLS manifest', async () => {
      vi.spyOn(httpHost, 'fetch').mockImplementation(async (url) => {
        if (typeof url === 'string' && url.includes('player')) {
          return {
            status: 200,
            body: JSON.stringify({
              videoDetails: {
                title: 'Test Song',
                author: 'Test Artist',
                lengthSeconds: '180',
              },
              streamingData: {
                hlsManifestUrl: 'https://manifest.googlevideo.com/test.m3u8',
              },
            }),
          };
        }
        return { status: 200, body: '' };
      });

      const streamInfo = await ytdlpHost.getStream('dQw4w9WgXcQ');

      expect(streamInfo.stream_url).toBe(
        'https://manifest.googlevideo.com/test.m3u8',
      );
      expect(streamInfo.title).toBe('Test Song');
      expect(streamInfo.artists).toEqual(['Test Artist']);
      expect(streamInfo.duration).toBe(180);
    });

    it('extracts videoId correctly from watch URL before extracting stream', async () => {
      let requestedBody: any = null;
      vi.spyOn(httpHost, 'fetch').mockImplementation(async (url, options) => {
        if (typeof url === 'string' && url.includes('player')) {
          if (options?.body) {
            requestedBody = JSON.parse(options.body as string);
          }
          return {
            status: 200,
            body: JSON.stringify({
              streamingData: {
                hlsManifestUrl: 'https://manifest.googlevideo.com/test.m3u8',
              },
            }),
          };
        }
        return { status: 200, body: '' };
      });

      const streamInfo = await ytdlpHost.getStream(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share',
      );

      expect(requestedBody?.videoId).toBe('dQw4w9WgXcQ');
      expect(streamInfo.stream_url).toBe(
        'https://manifest.googlevideo.com/test.m3u8',
      );
    });
  });

  describe('getStream resilient fallback', () => {
    it('returns watch URL as fallback when direct extraction fails on non-Tauri', async () => {
      vi.spyOn(httpHost, 'fetch').mockRejectedValue(new Error('Network error'));

      const streamInfo = await ytdlpHost.getStream('dQw4w9WgXcQ');

      expect(streamInfo.stream_url).toBe(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      );
    });
  });
});

