import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ytdlpHost } from './ytdlpHost';

vi.mock('./tvDetection', () => ({
  isGoogleTVEnvironment: vi.fn(),
}));

vi.mock('./universalStore', () => ({
  isTauriEnvironment: vi.fn().mockReturnValue(false),
  isCapacitorEnvironment: vi.fn().mockReturnValue(false),
}));

describe('ytdlpHost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getStream on Google TV', () => {
    it('returns YouTube watch URL directly when running on Google TV', async () => {
      const { isGoogleTVEnvironment } = await import('./tvDetection');
      vi.mocked(isGoogleTVEnvironment).mockReturnValue(true);

      const streamInfo = await ytdlpHost.getStream('dQw4w9WgXcQ');

      expect(streamInfo.stream_url).toBe(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      );
    });

    it('extracts videoId correctly from watch URL on Google TV', async () => {
      const { isGoogleTVEnvironment } = await import('./tvDetection');
      vi.mocked(isGoogleTVEnvironment).mockReturnValue(true);

      const streamInfo = await ytdlpHost.getStream(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share',
      );

      expect(streamInfo.stream_url).toBe(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      );
    });
  });

  describe('getStream resilient fallback', () => {
    it('returns watch URL as fallback when direct extraction fails on non-Tauri', async () => {
      const { isGoogleTVEnvironment } = await import('./tvDetection');
      vi.mocked(isGoogleTVEnvironment).mockReturnValue(false);

      const { httpHost } = await import('./httpHost');
      vi.spyOn(httpHost, 'fetch').mockRejectedValue(new Error('Network error'));

      const streamInfo = await ytdlpHost.getStream('dQw4w9WgXcQ');

      expect(streamInfo.stream_url).toBe(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      );
    });
  });
});
