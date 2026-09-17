const TV_USER_AGENT_PATTERN =
  /Android.*(?:TV|BRAVIA|Chromecast|GoogleTV|AFT[A-Z]*|SHIELD|Mi\s?Box|Nexus\s?Player)/i;

let cachedResult: boolean | null = null;

export const isGoogleTVEnvironment = (): boolean => {
  if (cachedResult !== null) {
    return cachedResult;
  }

  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    cachedResult = false;
    return false;
  }

  try {
    if (
      (window as unknown as { AndroidTV?: unknown }).AndroidTV !== undefined ||
      (window as unknown as { __AURORA_TV_MODE__?: boolean }).__AURORA_TV_MODE__ === true ||
      window.location.search.includes('tv=1') ||
      window.location.search.includes('platform=tv') ||
      localStorage.getItem('aurora:tv_mode') === 'true'
    ) {
      cachedResult = true;
      return true;
    }
  } catch {
    // ignore
  }

  const userAgent = navigator.userAgent;
  const isTVUserAgent = TV_USER_AGENT_PATTERN.test(userAgent);

  const hasNoTouch = navigator.maxTouchPoints === 0;

  const isAndroidLargeScreen =
    /Android/i.test(userAgent) && window.innerWidth >= 960;

  cachedResult = isTVUserAgent || (hasNoTouch && isAndroidLargeScreen);
  return cachedResult;
};

export const resetTvDetectionCache = (): void => {
  cachedResult = null;
};
