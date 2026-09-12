import { useEffect, useState } from 'react';

import { pickArtwork } from '@aurora/model';

import { metadataHost } from '../../services/metadataHost';
import { useProvidersStore } from '../../stores/providersStore';

const imageCache = new Map<string, string>();

export const useArtistCardImage = (
  artistName: string,
  localArtworkUrl?: string,
  providerId?: string,
): string | undefined => {
  const selectedProviderId = useProvidersStore((state) =>
    state.getActive('metadata'),
  );

  const activeProviderId = providerId ?? selectedProviderId;
  const isYtThumbnail =
    typeof localArtworkUrl === 'string' &&
    localArtworkUrl.includes('i.ytimg.com');

  const usableLocalUrl = !isYtThumbnail ? localArtworkUrl : undefined;

  const cacheKey = activeProviderId ? `${activeProviderId}:${artistName}` : '';
  const cachedUrl = cacheKey ? imageCache.get(cacheKey) : undefined;

  const initialUrl = usableLocalUrl ?? cachedUrl;
  const [resolvedUrl, setResolvedUrl] = useState<string | undefined>(
    initialUrl,
  );

  useEffect(() => {
    if (usableLocalUrl) {
      setResolvedUrl(usableLocalUrl);
      return;
    }

    if (cachedUrl) {
      setResolvedUrl(cachedUrl);
      return;
    }

    setResolvedUrl(undefined);
    if (!activeProviderId || !artistName) {
      return;
    }

    let cancelled = false;
    metadataHost
      .search({ query: artistName, types: ['artists'], limit: 5 }, activeProviderId)
      .then((results) => {
        if (cancelled) {
          return;
        }
        const match = results.artists?.find((artist) => artist.name.toLocaleLowerCase() === artistName.toLocaleLowerCase());
        const artwork = match?.artwork;
        const imageUrl = pickArtwork(artwork, 'avatar', 300)?.url;
        if (imageUrl) {
          imageCache.set(cacheKey, imageUrl);
          setResolvedUrl(imageUrl);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [artistName, activeProviderId, usableLocalUrl, cachedUrl, cacheKey]);

  return resolvedUrl;
};
