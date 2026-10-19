import { invoke } from '@tauri-apps/api/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { httpHost } from './httpHost';
import { isTauriEnvironment } from './universalStore';
import { ytdlpHost } from './ytdlpHost';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('./universalStore', () => ({
  isTauriEnvironment: vi.fn().mockReturnValue(false),
  isCapacitorEnvironment: vi.fn().mockReturnValue(false),
}));

describe('ytdlpHost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isTauriEnvironment).mockReturnValue(false);
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
      let requestedBody: Record<string, unknown> | null = null;
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

    it('uses fast direct extraction on Tauri desktop and falls back to ytdlp_get_stream only on failure', async () => {
      vi.mocked(isTauriEnvironment).mockReturnValue(true);
      vi.spyOn(httpHost, 'fetch').mockRejectedValue(new Error('Blocked'));
      vi.mocked(invoke).mockResolvedValue({
        stream_url: 'https://manifest.googlevideo.com/fallback.m3u8',
        duration: 210,
        title: 'Fallback Song',
        container: 'mp4',
        codec: 'aac',
        album: null,
        artists: ['Artist'],
        album_artists: [],
        upload_date: null,
      });

      const streamInfo = await ytdlpHost.getStream('dQw4w9WgXcQ');

      expect(invoke).toHaveBeenCalledWith('ytdlp_get_stream', {
        url: 'dQw4w9WgXcQ',
      });
      expect(streamInfo.stream_url).toBe(
        'https://manifest.googlevideo.com/fallback.m3u8',
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
