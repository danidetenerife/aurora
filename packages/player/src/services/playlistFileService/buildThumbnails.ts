import type { ArtworkSet, PlaylistItem } from '@aurora/model';
import { pickArtwork } from '@aurora/model';
import { MOSAIC_SIZE } from '@aurora/ui';

type PlaylistWithItems = {
  artwork?: ArtworkSet;
  items: PlaylistItem[];
};

const getUniqueTrackArtworkUrls = (playlist: PlaylistWithItems): string[] => {
  const urls = playlist.items
    .map((item) => pickArtwork(item.track.artwork, 'cover', 300)?.url)
    .filter((url): url is string => url !== undefined);

  return [...new Set(urls)];
};

export const buildThumbnails = (playlist: PlaylistWithItems): string[] => {
  const customUrl = pickArtwork(playlist.artwork, 'cover', 300)?.url;
  if (customUrl) {
    return [customUrl];
  }

  const uniqueUrls = getUniqueTrackArtworkUrls(playlist);

  if (uniqueUrls.length >= MOSAIC_SIZE) {
    return uniqueUrls.slice(0, MOSAIC_SIZE);
  }

  return uniqueUrls.slice(0, 1);
};
