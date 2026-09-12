import type {
  Album,
  AlbumRef,
  ArtistBio,
  ArtistRef,
  AuroraPlugin,
  AuroraPluginAPI,
  MetadataProvider,
  PlaylistProvider,
  SearchParams,
  Track,
  TrackRef,
} from '@aurora/plugin-sdk';

import { isPlaylistUrl, MetadataClient } from './client';
import {
  createDashboardProvider,
  DASHBOARD_PROVIDER_ID,
  PUBLIC_PLAYLISTS,
} from './dashboard-provider';
import {
  mapAlbumResponseToRef,
  mapAlbumUnionToAlbum,
  mapArtistResponseToRef,
  mapArtistToArtistBio,
  mapPlaylistToAuroraPlaylist,
  mapRelatedArtistToRef,
  mapReleaseItemToAlbumRef,
  mapTopTrackToTrackRef,
  mapTrackToAuroraTrack,
} from './mappers';

const decode = (encoded: string): string => atob(encoded);

export const PROVIDER_ID = decode('c3BvdGlmeQ==');
const PLAYLIST_PROVIDER_ID = `${PROVIDER_ID}-playlists`;

let client: MetadataClient | null = null;

const createProvider = (): MetadataProvider =>
  ({
    id: PROVIDER_ID,
    kind: 'metadata',
    name: decode('U3BvdGlmeQ=='),
    searchCapabilities: ['artists', 'albums', 'tracks', 'playlists'],
    artistMetadataCapabilities: [
      'artistBio',
      'artistTopTracks',
      'artistAlbums',
      'artistRelatedArtists',
    ],
    albumMetadataCapabilities: ['albumDetails'],
    searchArtists: async (
      params: Omit<SearchParams, 'types'>,
    ): Promise<ArtistRef[]> => {
      const data = await client!.searchArtists(
        params.query,
        params.limit ?? 15,
      );
      return data.map(mapArtistResponseToRef);
    },
    searchAlbums: async (
      params: Omit<SearchParams, 'types'>,
    ): Promise<AlbumRef[]> => {
      const data = await client!.searchAlbums(params.query, params.limit ?? 15);
      return data.map(mapAlbumResponseToRef);
    },
    searchTracks: async (
      params: Omit<SearchParams, 'types'>,
    ): Promise<Track[]> => {
      const data = await client!.searchTracks(params.query, params.limit ?? 15);
      return data.map(mapTrackToAuroraTrack);
    },
    searchPlaylists: async ({ query, limit = 15 }) =>
      PUBLIC_PLAYLISTS.filter((playlist) =>
        playlist.name.toLowerCase().includes(query.toLowerCase()),
      ).slice(0, limit),
    fetchArtistBio: async (artistUri: string): Promise<ArtistBio> => {
      const artist = await client!.getArtistOverview(artistUri);
      return mapArtistToArtistBio(artist);
    },
    fetchArtistTopTracks: async (artistUri: string): Promise<TrackRef[]> => {
      const topTracks = await client!.getArtistTopTracks(artistUri);
      return topTracks.map(mapTopTrackToTrackRef);
    },
    fetchArtistAlbums: async (artistUri: string): Promise<AlbumRef[]> => {
      const releases = await client!.getArtistAlbums(artistUri);
      return releases.map(mapReleaseItemToAlbumRef);
    },
    fetchArtistRelatedArtists: async (
      artistUri: string,
    ): Promise<ArtistRef[]> => {
      const artists = await client!.getRelatedArtists(artistUri);
      return artists.map(mapRelatedArtistToRef);
    },
    fetchAlbumDetails: async (albumUri: string): Promise<Album> => {
      const albumUnion = await client!.getAlbum(albumUri);
      return mapAlbumUnionToAlbum(albumUnion);
    },
  }) satisfies MetadataProvider;

const createPlaylistProvider = (): PlaylistProvider =>
  ({
    id: PLAYLIST_PROVIDER_ID,
    kind: 'playlists',
    name: decode('U3BvdGlmeQ=='),
    matchesUrl: isPlaylistUrl,
    fetchPlaylistByUrl: async (url: string) => {
      const playlist = await client!.getPlaylist(url);
      return mapPlaylistToAuroraPlaylist(playlist);
    },
  }) satisfies PlaylistProvider;

const plugin: AuroraPlugin = {
  onEnable(api: AuroraPluginAPI) {
    client = new MetadataClient(api.Http.fetch);
    api.Providers.register(createProvider());
    api.Providers.register(createPlaylistProvider());
    api.Providers.register(createDashboardProvider());
  },

  onDisable(api: AuroraPluginAPI) {
    api.Providers.unregister(PROVIDER_ID);
    api.Providers.unregister(PLAYLIST_PROVIDER_ID);
    api.Providers.unregister(DASHBOARD_PROVIDER_ID);
    client = null;
  },
};

export default plugin;
