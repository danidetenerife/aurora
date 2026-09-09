import { isGoogleTVEnvironment, resetTvDetectionCache } from './tvDetection';

describe('Google TV detection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetTvDetectionCache();
  });

  it.each([640, 960, 1280, 1920, 3840])(
    'recognizes the native TV marker at width %i',
    (width) => {
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
        'Mozilla/5.0 (Linux; Android 12; Pixel 7) Mobile Aurora GoogleTV',
      );
      vi.stubGlobal('innerWidth', width);
      expect(isGoogleTVEnvironment()).toBe(true);
    },
  );

  it.each([
    'Mozilla/5.0 (Linux; Android 12; Pixel 7) Mobile',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
  ])('keeps the existing non-TV platform for %s', (userAgent) => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
    vi.stubGlobal('innerWidth', 400);
    expect(isGoogleTVEnvironment()).toBe(false);
  });
});
