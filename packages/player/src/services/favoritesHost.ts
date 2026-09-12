import type {
  AlbumRef,
  ArtistRef,
  PlaylistRef,
  ProviderRef,
  Track,
} from '@aurora/model';
import type { FavoritesHost, FavoritesListener } from '@aurora/plugin-sdk';

import { useFavoritesStore } from '../stores/favoritesStore';

export const createFavoritesHost = (): FavoritesHost => ({
  getTracks: async () => useFavoritesStore.getState().tracks,
  getAlbums: async () => useFavoritesStore.getState().albums,
  getArtists: async () => useFavoritesStore.getState().artists,
  getPlaylists: async () => useFavoritesStore.getState().playlists,

  addTrack: async (track: Track) =>
    useFavoritesStore.getState().addTrack(track),
  removeTrack: async (source: ProviderRef) =>
    useFavoritesStore.getState().removeTrack(source),
  isTrackFavorite: async (source: ProviderRef) =>
    useFavoritesStore.getState().isTrackFavorite(source),

  addAlbum: async (ref: AlbumRef) => useFavoritesStore.getState().addAlbum(ref),
  removeAlbum: async (source: ProviderRef) =>
    useFavoritesStore.getState().removeAlbum(source),
  isAlbumFavorite: async (source: ProviderRef) =>
    useFavoritesStore.getState().isAlbumFavorite(source),

  addArtist: async (ref: ArtistRef) =>
    useFavoritesStore.getState().addArtist(ref),
  removeArtist: async (source: ProviderRef) =>
    useFavoritesStore.getState().removeArtist(source),
  removeArtistByName: async (name: string) =>
    useFavoritesStore.getState().removeArtistByName(name),
  isArtistFavorite: async (source: ProviderRef) =>
    useFavoritesStore.getState().isArtistFavorite(source),
  addPlaylist: async (ref: PlaylistRef) =>
    useFavoritesStore.getState().addPlaylist(ref),
  removePlaylist: async (source: ProviderRef) =>
    useFavoritesStore.getState().removePlaylist(source),
  isPlaylistFavorite: async (source: ProviderRef) =>
    useFavoritesStore.getState().isPlaylistFavorite(source),

  getDeletedKeys: async () => useFavoritesStore.getState().deletedKeys,

  subscribe: (listener: FavoritesListener) =>
    useFavoritesStore.subscribe((state) =>
      listener({
        tracks: state.tracks,
        albums: state.albums,
        artists: state.artists,
        playlists: state.playlists,
      }),
    ),
});

export const favoritesHost = createFavoritesHost();
