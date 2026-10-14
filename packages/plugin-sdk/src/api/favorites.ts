import type {
  AlbumRef,
  ArtistRef,
  PlaylistRef,
  ProviderRef,
  Track,
} from '@aurora/model';

import type { FavoritesHost, FavoritesListener } from '../types/favorites';

export class FavoritesAPI {
  #host?: FavoritesHost;

  constructor(host?: FavoritesHost) {
    this.#host = host;
  }

  #withHost<T>(fn: (host: FavoritesHost) => T): T {
    const host = this.#host;
    if (!host) {
      throw new Error('Favorites host not available');
    }
    return fn(host);
  }

  getTracks() {
    return this.#withHost((host) => host.getTracks());
  }

  getAlbums() {
    return this.#withHost((host) => host.getAlbums());
  }

  getArtists() {
    return this.#withHost((host) => host.getArtists());
  }

  getPlaylists() {
    return this.#withHost((host) => host.getPlaylists());
  }

  addTrack(track: Track) {
    return this.#withHost((host) => host.addTrack(track));
  }

  removeTrack(source: ProviderRef) {
    return this.#withHost((host) => host.removeTrack(source));
  }

  isTrackFavorite(source: ProviderRef) {
    return this.#withHost((host) => host.isTrackFavorite(source));
  }

  addAlbum(ref: AlbumRef) {
    return this.#withHost((host) => host.addAlbum(ref));
  }

  removeAlbum(source: ProviderRef) {
    return this.#withHost((host) => host.removeAlbum(source));
  }

  isAlbumFavorite(source: ProviderRef) {
    return this.#withHost((host) => host.isAlbumFavorite(source));
  }

  addArtist(ref: ArtistRef) {
    return this.#withHost((host) => host.addArtist(ref));
  }

  removeArtist(source: ProviderRef) {
    return this.#withHost((host) => host.removeArtist(source));
  }

  removeArtistByName(name: string) {
    return this.#withHost((host) => host.removeArtistByName(name));
  }

  isArtistFavorite(source: ProviderRef) {
    return this.#withHost((host) => host.isArtistFavorite(source));
  }

  addPlaylist(ref: PlaylistRef) {
    return this.#withHost((host) => host.addPlaylist(ref));
  }

  removePlaylist(source: ProviderRef) {
    return this.#withHost((host) => host.removePlaylist(source));
  }

  isPlaylistFavorite(source: ProviderRef) {
    return this.#withHost((host) => host.isPlaylistFavorite(source));
  }

  getDeletedKeys() {
    return this.#withHost((host) => host.getDeletedKeys());
  }

  subscribe(listener: FavoritesListener) {
    return this.#withHost((host) => host.subscribe(listener));
  }
}
