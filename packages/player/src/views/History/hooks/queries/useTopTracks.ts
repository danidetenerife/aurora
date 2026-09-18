import { useQuery } from '@tanstack/react-query';

import {
  isYouTubeOrGenericArtwork,
  resolveTrackCoverUrl,
} from '../../../../services/coverArtResolver';
import { personalizationEngine } from '../../../../services/personalizationEngine';
import type {
  TimeRange,
  TopTrack,
} from '../../../../services/tauri/bindings';
import { commands } from '../../../../services/tauri/bindings';
import { unwrapResult } from '../../../../services/tauri/results';
import { isTauriEnvironment } from '../../../../services/universalStore';
import { useFavoritesStore } from '../../../../stores/favoritesStore';

const FALLBACK_MS_PER_PLAY = 210000;

export const useTopTracks = (range: TimeRange, limit: number) =>
  useQuery({
    queryKey: ['history', 'stats', 'topTracks', range.from, range.to, limit],
    queryFn: async (): Promise<TopTrack[]> => {
      let rawTracks: TopTrack[] = [];

      if (isTauriEnvironment()) {
        try {
          rawTracks = unwrapResult(await commands.historyTopTracks(range, limit));
        } catch {
          rawTracks = [];
        }
      }

      const favoriteTracks = useFavoritesStore.getState().tracks || [];
      const favoriteMap = new Map<string, string>();
      for (const favorite of favoriteTracks) {
        if (favorite.ref) {
          const artistName = favorite.ref.artists?.[0]?.name || '';
          const key = `${artistName}-${favorite.ref.title}`.toLowerCase();
          const artworkUrl = favorite.ref.artwork?.items?.[0]?.url;
          if (artworkUrl) {
            favoriteMap.set(key, artworkUrl);
          }
        }
      }

      if (rawTracks.length === 0) {
        const records = await personalizationEngine.getListenRecords();
        const sorted = [...records]
          .sort((first, second) => (second.playCount || 1) - (first.playCount || 1))
          .slice(0, limit);

        if (sorted.length === 0 && favoriteTracks.length > 0) {
          rawTracks = favoriteTracks.slice(0, limit).map((favorite, index) => ({
            title: favorite.ref?.title || 'Canción',
            artists: [favorite.ref?.artists?.[0]?.name || 'Artista'],
            artworkUrl: favorite.ref?.artwork?.items?.[0]?.url || null,
            msPlayed: (limit - index) * FALLBACK_MS_PER_PLAY,
            plays: limit - index,
          }));
        } else {
          rawTracks = sorted.map((record) => {
            const key = `${record.artist}-${record.title}`.toLowerCase();
            return {
              title: record.title,
              artists: [record.artist],
              artworkUrl: favoriteMap.get(key) || null,
              msPlayed: (record.playCount || 1) * FALLBACK_MS_PER_PLAY,
              plays: record.playCount || 1,
            };
          });
        }
      }

      return Promise.all(
        rawTracks.map(async (track) => {
          if (track.artworkUrl && !isYouTubeOrGenericArtwork(track.artworkUrl)) {
            return track;
          }

          const primaryArtist = track.artists[0] ?? '';
          const key = `${primaryArtist}-${track.title}`.toLowerCase();
          const favoriteUrl = favoriteMap.get(key);
          if (favoriteUrl && !isYouTubeOrGenericArtwork(favoriteUrl)) {
            return {
              ...track,
              artworkUrl: favoriteUrl,
            };
          }

          const resolvedUrl = await resolveTrackCoverUrl(
            primaryArtist,
            track.title,
          );
          return {
            ...track,
            artworkUrl: resolvedUrl ?? track.artworkUrl ?? null,
          };
        }),
      );
    },
  });

