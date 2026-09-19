import type { ArtworkSet } from '@aurora/model';

const memoryCache = new Map<string, string>();
const LOCAL_STORAGE_KEY_PREFIX = 'aurora_cover_';

const normalizeText = (text: string): string =>
  text
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/ft\..*|feat\..*/gi, '')
    .trim();

export const isYouTubeOrGenericArtwork = (url?: string): boolean => {
  if (!url) {
    return true;
  }
  return (
    url.includes('i.ytimg.com') ||
    url.includes('img.youtube.com') ||
    url.includes('googleusercontent.com') ||
    url.includes('/vi/0/') ||
    url.includes('default.jpg')
  );
};

export const resolveTrackCoverUrl = async (
  artist: string,
  title: string,
): Promise<string | null> => {
  if (!artist || !title) {
    return null;
  }

  const cacheKey = `${normalizeText(artist)}___${normalizeText(title)}`;
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey)!;
  }

  // Check localStorage cache
  try {
    const cached = localStorage.getItem(
      `${LOCAL_STORAGE_KEY_PREFIX}${cacheKey}`,
    );
    if (cached) {
      memoryCache.set(cacheKey, cached);
      return cached;
    }
  } catch {
    void 0;
  }

  const queries = [
    `${artist} ${title}`,
    `${normalizeText(artist)} ${normalizeText(title)}`,
  ];

  for (const query of queries) {
    try {
      const response = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=1`,
      );
      if (!response.ok) {
        continue;
      }

      const data = (await response.json()) as {
        results?: Array<{ artworkUrl100?: string }>;
      };

      const rawArtwork = data?.results?.[0]?.artworkUrl100;
      if (rawArtwork) {
        const highResUrl = rawArtwork.replace('100x100bb.jpg', '600x600bb.jpg');
        memoryCache.set(cacheKey, highResUrl);
        try {
          localStorage.setItem(
            `${LOCAL_STORAGE_KEY_PREFIX}${cacheKey}`,
            highResUrl,
          );
        } catch (error) {
          void error;
        }
        return highResUrl;
      }
    } catch (error) {
      void error;
    }
  }

  return null;
};

const ARTIST_STORAGE_KEY_PREFIX = 'aurora_artist_img_';
const artistMemoryCache = new Map<string, string>();

export const resolveArtistImageUrl = async (
  artistName: string,
): Promise<string | null> => {
  if (!artistName || artistName.trim().toLowerCase() === 'unknown') {
    return null;
  }

  const cacheKey = normalizeText(artistName);
  if (artistMemoryCache.has(cacheKey)) {
    return artistMemoryCache.get(cacheKey)!;
  }

  try {
    const cached = localStorage.getItem(
      `${ARTIST_STORAGE_KEY_PREFIX}${cacheKey}`,
    );
    if (cached) {
      artistMemoryCache.set(cacheKey, cached);
      return cached;
    }
  } catch {
    void 0;
  }

  try {
    const response = await fetch(
      `https://api.deezer.com/search/artist?q=${encodeURIComponent(artistName)}&limit=1`,
    );
    if (response.ok) {
      const data = (await response.json()) as {
        data?: Array<{
          picture_big?: string;
          picture_medium?: string;
          picture?: string;
        }>;
      };
      const picture =
        data?.data?.[0]?.picture_big ||
        data?.data?.[0]?.picture_medium ||
        data?.data?.[0]?.picture;
      if (picture) {
        artistMemoryCache.set(cacheKey, picture);
        try {
          localStorage.setItem(
            `${ARTIST_STORAGE_KEY_PREFIX}${cacheKey}`,
            picture,
          );
        } catch {
          void 0;
        }
        return picture;
      }
    }
  } catch {
    void 0;
  }

  try {
    const trackCover = await resolveTrackCoverUrl(artistName, '');
    if (trackCover) {
      artistMemoryCache.set(cacheKey, trackCover);
      return trackCover;
    }
  } catch {
    void 0;
  }

  return null;
};

export const createArtworkSetFromUrl = (url: string): ArtworkSet => ({
  items: [
    {
      url,
      purpose: 'cover',
      width: 600,
      height: 600,
      source: { provider: 'itunes', id: 'cover' },
    },
  ],
});
