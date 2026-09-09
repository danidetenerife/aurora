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
