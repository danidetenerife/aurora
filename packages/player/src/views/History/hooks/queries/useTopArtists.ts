import { useQuery } from '@tanstack/react-query';

import {
  isYouTubeOrGenericArtwork,
  resolveArtistImageUrl,
} from '../../../../services/coverArtResolver';
import { personalizationEngine } from '../../../../services/personalizationEngine';
import type {
  TimeRange,
  TopArtist,
} from '../../../../services/tauri/bindings';
import { commands } from '../../../../services/tauri/bindings';
import { unwrapResult } from '../../../../services/tauri/results';
import { isTauriEnvironment } from '../../../../services/universalStore';
import { useFavoritesStore } from '../../../../stores/favoritesStore';

const FALLBACK_MS_PER_PLAY = 210000;

export const useTopArtists = (range: TimeRange, limit: number) =>
  useQuery({
    queryKey: ['history', 'stats', 'topArtists', range.from, range.to, limit],
    queryFn: async (): Promise<TopArtist[]> => {
      let rawArtists: TopArtist[] = [];

      if (isTauriEnvironment()) {
        try {
          rawArtists = unwrapResult(await commands.historyTopArtists(range, limit));
        } catch {
          rawArtists = [];
        }
      }

      const favoriteArtists = useFavoritesStore.getState().artists || [];
      const artworkMap = new Map<string, string>();
      for (const favorite of favoriteArtists) {
        if (favorite.ref?.name) {
          const imageUrl = favorite.ref.artwork?.items?.[0]?.url;
          if (imageUrl) {
            artworkMap.set(favorite.ref.name.toLowerCase(), imageUrl);
          }
        }
      }

      if (rawArtists.length === 0) {
        const records = await personalizationEngine.getListenRecords();
        const artistPlays = new Map<string, number>();
        for (const record of records) {
          if (record?.artist) {
            const current = artistPlays.get(record.artist) || 0;
            artistPlays.set(record.artist, current + (record.playCount || 1));
          }
        }

        if (artistPlays.size === 0 && favoriteArtists.length > 0) {
          rawArtists = favoriteArtists.slice(0, limit).map((favorite, index) => ({
            name: favorite.ref?.name || 'Artista',
            artworkUrl: favorite.ref?.artwork?.items?.[0]?.url || null,
            msPlayed: (limit - index) * FALLBACK_MS_PER_PLAY,
            plays: limit - index,
          }));
        } else {
          const sorted = Array.from(artistPlays.entries())
            .sort((first, second) => second[1] - first[1])
            .slice(0, limit);

          rawArtists = sorted.map(([name, plays]) => ({
            name,
            artworkUrl: artworkMap.get(name.toLowerCase()) || null,
            msPlayed: plays * FALLBACK_MS_PER_PLAY,
            plays,
          }));
        }
      }

      return Promise.all(
        rawArtists.map(async (artist) => {
          if (artist.artworkUrl && !isYouTubeOrGenericArtwork(artist.artworkUrl)) {
            return artist;
          }

          const favoriteUrl = artworkMap.get(artist.name.toLowerCase());
          if (favoriteUrl && !isYouTubeOrGenericArtwork(favoriteUrl)) {
            return {
              ...artist,
              artworkUrl: favoriteUrl,
            };
          }

          const resolvedUrl = await resolveArtistImageUrl(artist.name);
          return {
            ...artist,
            artworkUrl: resolvedUrl ?? artist.artworkUrl ?? null,
          };
        }),
      );
    },
  });

