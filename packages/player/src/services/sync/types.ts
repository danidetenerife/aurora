import type { UserListenRecord } from '../personalizationEngine';

export type SyncProviderType = 'webdav' | 'gist' | 'lan' | 'none';

export type FavEntry = {
  ref: Record<string, unknown>;
  addedAtIso: string;
};

export type SyncFavorites = {
  tracks?: FavEntry[];
  artists?: FavEntry[];
  albums?: FavEntry[];
  deletedKeys?: Record<string, number>;
};

export type SyncPlaylistItem = {
  id?: string;
  name?: string;
  description?: string;
  createdAtIso?: string;
  lastModifiedIso?: string;
  isReadOnly?: boolean;
  items?: unknown[];
  artwork?: unknown;
};

export type SyncPayload = {
  version?: number;
  timestamp: number;
  favorites?: SyncFavorites;
  playlists?: SyncPlaylistItem[];
  user_profile?: UserListenRecord[];
  blacklist?: {
    tracks?: string[];
    artists?: string[];
  };
  settings?: Record<string, unknown>;
  activeProviders?: Record<string, string>;
  plugins?: Record<string, unknown>;
};

export type WebDavConfig = {
  url: string;
  username: string;
  password: string;
  remotePath?: string;
};

export type GistConfig = {
  token: string;
  gistId?: string;
};

export type LanConfig = {
  serverUrl: string;
};

export type SyncConfig = {
  provider: SyncProviderType;
  autoSync: boolean;
  lastSyncTime?: number | null;
  webdav?: WebDavConfig;
  gist?: GistConfig;
  lan?: LanConfig;
};

export type SyncResult = {
  success: boolean;
  error?: string;
  syncedCounts?: {
    tracks: number;
    artists: number;
    playlists: number;
    settings?: number;
  };
};

export type SyncAdapter = {
  testConnection(): Promise<{ success: boolean; error?: string }>;
  fetchRemote(): Promise<SyncPayload | null>;
  pushRemote(payload: SyncPayload): Promise<boolean>;
};
