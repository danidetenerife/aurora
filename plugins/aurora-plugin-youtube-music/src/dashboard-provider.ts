import type {
  AlbumRef,
  AuroraPluginAPI,
  DashboardProvider,
  PlaylistRef,
  Track,
} from '@aurora/plugin-sdk';

import { YtMusicClient } from './client';
import {
  mapAlbumToAlbumRef,
  mapPlaylistDetailsToPlaylistRef,
  mapSongToTrack,
} from './mappers';

export const DASHBOARD_PROVIDER_ID = 'youtube-music-dashboard';

export const PUBLIC_PLAYLISTS: PlaylistRef[] = [
  {
    id: 'PL4fGSI1pDJn6O1LS0XSdF3RyO0Rq_LDeI',
    name: 'Top canciones',
    source: {
      provider: 'youtube-music',
      id: 'PL4fGSI1pDJn6O1LS0XSdF3RyO0Rq_LDeI',
      url: 'https://music.youtube.com/playlist?list=PL4fGSI1pDJn6O1LS0XSdF3RyO0Rq_LDeI',
    },
  },
  {
    id: 'PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI',
    name: 'Éxitos globales',
    source: {
      provider: 'youtube-music',
      id: 'PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI',
      url: 'https://music.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI',
    },
  },
  {
    id: 'PLQog_FHUHAFUj9M1fK9M4w5yX7L7Y7Y7Y',
    name: 'Novedades musicales',
    source: {
      provider: 'youtube-music',
      id: 'PLQog_FHUHAFUj9M1fK9M4w5yX7L7Y7Y7Y',
      url: 'https://music.youtube.com/playlist?list=PLQog_FHUHAFUj9M1fK9M4w5yX7L7Y7Y7Y',
    },
  },
];

export const createDashboardProvider = (
  api: AuroraPluginAPI,
  client: YtMusicClient,
): DashboardProvider => ({
  id: DASHBOARD_PROVIDER_ID,
  kind: 'dashboard',
  name: 'Música Personalizada',
  metadataProviderId: 'youtube-music',
  capabilities: ['topTracks', 'newReleases', 'editorialPlaylists'],

  fetchTopTracks: async (): Promise<Track[]> => {
    try {
      const favArtists = (await api.Favorites.getArtists()) || [];
      const favTracks = (await api.Favorites.getTracks()) || [];

      const artistNames = favArtists
        .map((a) => a.ref?.name)
        .filter((n): n is string => Boolean(n));

      const targetArtists =
        artistNames.length > 0
          ? artistNames
          : ['Alejandro Sanz', 'Christian Nodal', 'Luis Miguel', 'Emmanuel'];

      const accumulatedSongs: Track[] = [];
      const seenIds = new Set<string>();

      for (const ft of favTracks.slice(0, 5)) {
        if (ft.ref && ft.ref.source) {
          seenIds.add(ft.ref.source.id);
          accumulatedSongs.push(ft.ref);
        }
      }

      for (const artist of targetArtists.slice(0, 4)) {
        try {
          const songs = await client.searchSongs(artist, 6);
          for (const s of songs) {
            if (!seenIds.has(s.id)) {
              seenIds.add(s.id);
              accumulatedSongs.push(mapSongToTrack(s, 'youtube-music'));
            }
          }
        } catch {
          // ignore
        }
      }

      return accumulatedSongs;
    } catch {
      return [];
    }
  },

  fetchNewReleases: async (): Promise<AlbumRef[]> => {
    try {
      const favArtists = (await api.Favorites.getArtists()) || [];
      const artistNames = favArtists
        .map((a) => a.ref?.name)
        .filter((n): n is string => Boolean(n));

      const targetArtists =
        artistNames.length > 0
          ? artistNames
          : ['Alejandro Sanz', 'Christian Nodal', 'Luis Miguel'];

      const accumulatedAlbums: AlbumRef[] = [];
      const seenIds = new Set<string>();

      for (const artist of targetArtists.slice(0, 6)) {
        try {
          const albums = await client.searchAlbums(artist, 3);
          for (const al of albums) {
            if (!seenIds.has(al.id)) {
              seenIds.add(al.id);
              accumulatedAlbums.push(mapAlbumToAlbumRef(al, 'youtube-music'));
            }
          }
        } catch {
          // ignore
        }
      }

      return accumulatedAlbums;
    } catch {
      return [];
    }
  },

  fetchEditorialPlaylists: async (): Promise<PlaylistRef[]> => {
    try {
      const explore = await client.getExplore();
      const playlists = explore.editorialPlaylists.map((playlist) =>
        mapPlaylistDetailsToPlaylistRef(playlist, 'youtube-music'),
      );
      if (playlists.length > 0) {
        return playlists;
      }
    } catch {
      // Use the public catalogue below when Explore is unavailable.
    }

    return PUBLIC_PLAYLISTS;
  },
});
