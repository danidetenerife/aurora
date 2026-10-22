import type {
  AlbumRef,
  ArtworkSet,
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

const COVER_SIZE = 640;

const createCoverArtwork = (url: string): ArtworkSet => ({
  items: [
    {
      url,
      purpose: 'cover',
      width: COVER_SIZE,
      height: COVER_SIZE,
      source: { provider: 'youtube-music', id: 'cover' },
    },
  ],
});

export const PUBLIC_PLAYLISTS: PlaylistRef[] = [
  {
    id: 'PL4fGSI1pDJn6O1LS0XSdF3RyO0Rq_LDeI',
    name: 'Top canciones',
    artwork: createCoverArtwork(
      'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=640&auto=format&fit=crop&q=80',
    ),
    source: {
      provider: 'youtube-music',
      id: 'PL4fGSI1pDJn6O1LS0XSdF3RyO0Rq_LDeI',
      url: 'https://music.youtube.com/playlist?list=PL4fGSI1pDJn6O1LS0XSdF3RyO0Rq_LDeI',
    },
  },
  {
    id: 'PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI',
    name: 'Éxitos globales',
    artwork: createCoverArtwork(
      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=640&auto=format&fit=crop&q=80',
    ),
    source: {
      provider: 'youtube-music',
      id: 'PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI',
      url: 'https://music.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI',
    },
  },
  {
    id: 'PL4fGSI1pDJn5kI81J1PX42TOozGzOM1CX',
    name: 'Novedades musicales',
    artwork: createCoverArtwork(
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=640&auto=format&fit=crop&q=80',
    ),
    source: {
      provider: 'youtube-music',
      id: 'PL4fGSI1pDJn5kI81J1PX42TOozGzOM1CX',
      url: 'https://music.youtube.com/playlist?list=PL4fGSI1pDJn5kI81J1PX42TOozGzOM1CX',
    },
  },
];

export const createDashboardProvider = (
  apiOrClient: AuroraPluginAPI | YtMusicClient,
  maybeClient?: YtMusicClient,
): DashboardProvider => {
  const client = maybeClient ?? (apiOrClient as YtMusicClient);
  const api = maybeClient ? (apiOrClient as AuroraPluginAPI) : undefined;

  return {
    id: DASHBOARD_PROVIDER_ID,
    kind: 'dashboard',
    name: 'Música Personalizada',
    metadataProviderId: 'youtube-music',
    capabilities: ['topTracks', 'newReleases', 'editorialPlaylists'],

    fetchTopTracks: async (): Promise<Track[]> => {
      try {
        const favArtists = (await api?.Favorites?.getArtists?.()) || [];
        const favTracks = (await api?.Favorites?.getTracks?.()) || [];

        const artistNames = favArtists
          .map((artistEntry) => artistEntry.ref?.name)
          .filter((name): name is string => Boolean(name));

        if (
          artistNames.length === 0 &&
          favTracks.length === 0 &&
          typeof client.getExplore === 'function'
        ) {
          try {
            const explore = await client.getExplore();
            if (explore.topTracks.length > 0) {
              return explore.topTracks.map((song) =>
                mapSongToTrack(song, 'youtube-music'),
              );
            }
          } catch {
            void 0;
          }
        }

        const targetArtists =
          artistNames.length > 0
            ? artistNames
            : ['The Weeknd', 'Dua Lipa', 'Bruno Mars', 'Coldplay'];

        const accumulatedSongs: Track[] = [];
        const seenIds = new Set<string>();

        for (const favoriteTrack of favTracks.slice(0, 5)) {
          if (favoriteTrack.ref && favoriteTrack.ref.source) {
            seenIds.add(favoriteTrack.ref.source.id);
            accumulatedSongs.push(favoriteTrack.ref);
          }
        }

        for (const artist of targetArtists.slice(0, 4)) {
          try {
            const songs = await client.searchSongs(artist, 6);
            for (const song of songs) {
              if (!seenIds.has(song.id)) {
                seenIds.add(song.id);
                accumulatedSongs.push(mapSongToTrack(song, 'youtube-music'));
              }
            }
          } catch {
            void 0;
          }
        }

        return accumulatedSongs;
      } catch {
        return [];
      }
    },

    fetchNewReleases: async (): Promise<AlbumRef[]> => {
      try {
        const favArtists = (await api?.Favorites?.getArtists?.()) || [];
        const artistNames = favArtists
          .map((artistEntry) => artistEntry.ref?.name)
          .filter((name): name is string => Boolean(name));

        if (
          artistNames.length === 0 &&
          typeof client.getExplore === 'function'
        ) {
          try {
            const explore = await client.getExplore();
            if (explore.newReleases.length > 0) {
              return explore.newReleases.map((album) =>
                mapAlbumToAlbumRef(album, 'youtube-music'),
              );
            }
          } catch {
            void 0;
          }
        }

        const targetArtists =
          artistNames.length > 0
            ? artistNames
            : ['The Weeknd', 'Dua Lipa', 'Coldplay'];

        const accumulatedAlbums: AlbumRef[] = [];
        const seenIds = new Set<string>();

        for (const artist of targetArtists.slice(0, 6)) {
          try {
            const albums = await client.searchAlbums(artist, 3);
            for (const album of albums) {
              if (!seenIds.has(album.id)) {
                seenIds.add(album.id);
                accumulatedAlbums.push(
                  mapAlbumToAlbumRef(album, 'youtube-music'),
                );
              }
            }
          } catch {
            void 0;
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
        void 0;
      }

      return PUBLIC_PLAYLISTS;
    },
  };
};
