import { i18n } from '@nuclearplayer/i18n';

import { defaultQueryClient } from '../App';
import { useFavoritesStore } from '../stores/favoritesStore';
import { usePlaylistStore } from '../stores/playlistStore';
import { useProvidersStore } from '../stores/providersStore';
import { useSettingsStore } from '../stores/settingsStore';
import { changeLanguage } from './languageService';
import { mergeListenRecords } from './listeningProfile.mjs';
import {
  personalizationEngine,
  type UserListenRecord,
} from './personalizationEngine';
import { playlistFileService } from './playlistFileService';
import { GistAdapter } from './sync/gistAdapter';
import type {
  FavEntry,
  GistConfig,
  SyncAdapter,
  SyncConfig,
  SyncPayload,
  SyncPlaylistItem,
  SyncProviderType,
  SyncResult,
  WebDavConfig,
} from './sync/types';
import { WebDavAdapter } from './sync/webDavAdapter';
import { createUniversalStore, isTauriEnvironment } from './universalStore';

const SYNC_STORE_FILE = 'p2p_sync.json';
const syncStore = createUniversalStore(SYNC_STORE_FILE);

function entrySourceKey(entry: FavEntry): string {
  const source = entry.ref?.source as Record<string, string> | undefined;
  if (source?.provider && source?.id) {
    return `${source.provider}::${source.id}`;
  }
  return (
    (entry.ref?.title as string) ??
    (entry.ref?.name as string) ??
    JSON.stringify(entry.ref)
  );
}

function entryNameKey(entry: FavEntry): string {
  const name =
    (entry.ref?.name as string) ?? (entry.ref?.title as string) ?? '';
  return name ? `artist::${name.trim().toLowerCase()}` : '';
}

function isEntryDeleted(
  entry: FavEntry,
  deletedKeys: Record<string, number>,
): boolean {
  const sourceKey = entrySourceKey(entry);
  const nameKey = entryNameKey(entry);
  const addedTime = new Date(entry.addedAtIso).getTime();

  const sourceDeletedTime = deletedKeys[sourceKey];
  if (sourceDeletedTime && sourceDeletedTime >= addedTime) {
    return true;
  }
  const nameDeletedTime = nameKey ? deletedKeys[nameKey] : undefined;
  if (nameDeletedTime && nameDeletedTime >= addedTime) {
    return true;
  }
  return false;
}

function mergeFavEntries(
  local: FavEntry[],
  remote: FavEntry[],
  deletedKeys: Record<string, number> = {},
): { merged: FavEntry[]; hadLocalExtras: boolean } {
  const merged = new Map<string, FavEntry>();
  for (const entry of remote) {
    if (!isEntryDeleted(entry, deletedKeys)) {
      merged.set(entrySourceKey(entry), entry);
    }
  }

  let hadLocalExtras = false;
  for (const localEntry of local) {
    if (isEntryDeleted(localEntry, deletedKeys)) {
      continue;
    }
    const key = entrySourceKey(localEntry);
    const remoteEntry = merged.get(key);
    if (!remoteEntry) {
      merged.set(key, localEntry);
      hadLocalExtras = true;
    } else {
      const localTime = new Date(localEntry.addedAtIso).getTime();
      const remoteTime = new Date(remoteEntry.addedAtIso).getTime();
      if (localTime > remoteTime) {
        merged.set(key, localEntry);
        hadLocalExtras = true;
      }
    }
  }

  return { merged: Array.from(merged.values()), hadLocalExtras };
}

async function safeFetchJson<T>(
  url: string,
  optionsOrTimeout?: RequestInit | number,
  timeoutMs = 3000,
): Promise<T | null> {
  try {
    const isOptions = typeof optionsOrTimeout === 'object';
    const options = isOptions ? optionsOrTimeout : undefined;
    const timeout =
      typeof optionsOrTimeout === 'number' ? optionsOrTimeout : timeoutMs;

    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(timeout),
    });
    if (!response.ok) {
      return null;
    }
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export class P2PSyncService {
  private syncIntervalTimer: number | null = null;
  private eventSource: EventSource | null = null;
  private sseDebounceTimer: number | null = null;
  private isSyncing = false;
  private isApplyingRemote = false;
  private pushDebounceTimer: number | null = null;
  private profilePushTimer: number | null = null;
  private isPushingProfile = false;
  private lastAppliedLibrary = '';
  private lastSyncFinishedAt = 0;
  private static readonly PUSH_DEBOUNCE_MS = 5000;
  private static readonly SYNC_INTERVAL_MS = 120_000;
  private static readonly POST_SYNC_COOLDOWN_MS = 10_000;

  constructor() {
    this.setupLocalSubscribers();
  }

  private setupLocalSubscribers(): void {
    personalizationEngine.subscribe((origin) => {
      if (origin === 'local') {
        this.scheduleProfilePush();
      }
    });

    useFavoritesStore.subscribe(() => {
      if (this.isApplyingRemote) {
        return;
      }
      this.schedulePushToActiveProvider();
    });

    useSettingsStore.subscribe(() => {
      if (this.isApplyingRemote) {
        return;
      }
      this.schedulePushToActiveProvider();
    });

    usePlaylistStore.subscribe(() => {
      if (this.isApplyingRemote) {
        return;
      }
      this.schedulePushToActiveProvider();
    });
  }

  private schedulePushToActiveProvider(): void {
    if (this.pushDebounceTimer) {
      clearTimeout(this.pushDebounceTimer);
    }
    this.pushDebounceTimer = window.setTimeout(
      async () => {
        if (await this.isAutoSyncEnabled()) {
          const provider = await this.getSyncProvider();
          if (provider === 'lan') {
            void this.pushLocalChangesToPc();
          } else if (provider !== 'none') {
            void this.syncNow();
          }
        }
      },
      Math.max(
        P2PSyncService.PUSH_DEBOUNCE_MS,
        P2PSyncService.POST_SYNC_COOLDOWN_MS -
          (Date.now() - this.lastSyncFinishedAt),
      ),
    );
  }

  private scheduleProfilePush(): void {
    if (this.profilePushTimer !== null) {
      return;
    }
    this.profilePushTimer = window.setTimeout(async () => {
      this.profilePushTimer = null;
      if (await this.isAutoSyncEnabled()) {
        const provider = await this.getSyncProvider();
        if (provider === 'lan') {
          await this.pushListeningProfile();
        } else if (provider !== 'none') {
          await this.syncNow();
        }
      }
    }, P2PSyncService.PUSH_DEBOUNCE_MS);
  }

  async getSyncProvider(): Promise<SyncProviderType> {
    const saved = await syncStore.get<SyncProviderType>('sync_provider');
    if (saved) {
      return saved;
    }
    const webdavUrl = await syncStore.get<string>('webdav_url');
    if (webdavUrl) {
      return 'webdav';
    }
    const gistToken = await syncStore.get<string>('gist_token');
    if (gistToken) {
      return 'gist';
    }
    return 'lan';
  }

  async setSyncProvider(provider: SyncProviderType): Promise<void> {
    await syncStore.set('sync_provider', provider);
    await syncStore.save();
  }

  async getWebDavConfig(): Promise<WebDavConfig> {
    const url = (await syncStore.get<string>('webdav_url')) ?? '';
    const username = (await syncStore.get<string>('webdav_username')) ?? '';
    const password = (await syncStore.get<string>('webdav_password')) ?? '';
    const remotePath =
      (await syncStore.get<string>('webdav_remote_path')) ?? 'aurora_sync.json';
    return { url, username, password, remotePath };
  }

  async setWebDavConfig(config: WebDavConfig): Promise<void> {
    await syncStore.set('webdav_url', config.url.trim());
    await syncStore.set('webdav_username', config.username.trim());
    await syncStore.set('webdav_password', config.password);
    await syncStore.set(
      'webdav_remote_path',
      config.remotePath?.trim() || 'aurora_sync.json',
    );
    await syncStore.set('sync_provider', 'webdav');
    await syncStore.save();
  }

  async getGistConfig(): Promise<GistConfig> {
    const token = (await syncStore.get<string>('gist_token')) ?? '';
    const gistId = (await syncStore.get<string>('gist_id')) ?? '';
    return { token, gistId };
  }

  async setGistConfig(config: GistConfig): Promise<void> {
    await syncStore.set('gist_token', config.token.trim());
    if (config.gistId) {
      await syncStore.set('gist_id', config.gistId.trim());
    }
    await syncStore.set('sync_provider', 'gist');
    await syncStore.save();
  }

  async getSyncServerUrl(): Promise<string> {
    const saved = await syncStore.get<string>('server_url');
    if (saved) {
      return saved;
    }
    return 'http://192.168.0.12:4120';
  }

  async setSyncServerUrl(url: string): Promise<void> {
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `http://${cleanUrl}`;
    }
    await syncStore.set('server_url', cleanUrl);
    await syncStore.set('sync_provider', 'lan');
    await syncStore.save();
  }

  async isAutoSyncEnabled(): Promise<boolean> {
    const enabled = await syncStore.get<boolean>('auto_sync');
    return enabled ?? true;
  }

  async setAutoSyncEnabled(enabled: boolean): Promise<void> {
    await syncStore.set('auto_sync', enabled);
    await syncStore.save();
  }

  async getLastSyncTime(): Promise<number | null> {
    return (await syncStore.get<number>('last_sync_time')) ?? null;
  }

  async getWorkingServerUrl(): Promise<string | null> {
    const savedUrl = await this.getSyncServerUrl();
    const hostMatch = savedUrl.match(/^https?:\/\/([^:/]+)/);
    const host = hostMatch ? hostMatch[1] : '192.168.0.12';

    const candidates = [
      ...(isTauriEnvironment() ? ['http://127.0.0.1:4122'] : []),
      `http://${host}:4122`,
      savedUrl,
      `http://${host}:4120`,
    ];

    for (const url of candidates) {
      const health = await safeFetchJson<{ status: string }>(
        `${url}/api/health`,
        1200,
      );
      if (health?.status === 'ok') {
        return url;
      }
    }
    return null;
  }

  async checkPcHealth(targetUrl?: string): Promise<boolean> {
    if (targetUrl) {
      try {
        const response = await fetch(`${targetUrl}/api/health`, {
          signal: AbortSignal.timeout(2000),
        });
        return response.ok;
      } catch {
        return false;
      }
    }
    const url = await this.getWorkingServerUrl();
    return url !== null;
  }

  async discoverPcOnLan(): Promise<string | null> {
    const commonSubnets = [
      '192.168.0.',
      '192.168.1.',
      '192.168.18.',
      '10.0.0.',
    ];

    const currentUrl = await this.getWorkingServerUrl();
    if (currentUrl) {
      return currentUrl;
    }

    for (const subnet of commonSubnets) {
      const batchPromises: Promise<string | null>[] = [];

      for (let index = 1; index <= 40; index++) {
        const candidate = `http://${subnet}${index}:4122`;
        const promise = safeFetchJson<{ status: string }>(
          `${candidate}/api/health`,
          300,
        ).then((result) => (result?.status === 'ok' ? candidate : null));
        batchPromises.push(promise);
      }

      const results = await Promise.all(batchPromises);
      const found = results.find((result) => result !== null);
      if (found) {
        await this.setSyncServerUrl(found);
        return found;
      }
    }

    return null;
  }

  async getActiveAdapter(): Promise<SyncAdapter | null> {
    const provider = await this.getSyncProvider();
    if (provider === 'webdav') {
      const config = await this.getWebDavConfig();
      if (!config.url) {
        return null;
      }
      return new WebDavAdapter(config);
    }
    if (provider === 'gist') {
      const config = await this.getGistConfig();
      if (!config.token) {
        return null;
      }
      return new GistAdapter(config, async (newGistId) => {
        await syncStore.set('gist_id', newGistId);
        await syncStore.save();
      });
    }
    return null;
  }

  async testActiveConnection(): Promise<{ success: boolean; error?: string }> {
    const provider = await this.getSyncProvider();
    if (provider === 'lan') {
      const workingUrl = await this.getWorkingServerUrl();
      if (workingUrl) {
        return { success: true };
      }
      return {
        success: false,
        error: `No se puede conectar al servidor LAN en ${await this.getSyncServerUrl()}`,
      };
    }
    const adapter = await this.getActiveAdapter();
    if (!adapter) {
      return {
        success: false,
        error: 'No se ha configurado ningún proveedor de sincronización',
      };
    }
    return adapter.testConnection();
  }

  async gatherLocalPayload(): Promise<SyncPayload> {
    const favStoreState = useFavoritesStore.getState();
    const settingsStoreState = useSettingsStore.getState();
    const playlistStoreState = usePlaylistStore.getState();

    const allPlaylists: SyncPlaylistItem[] = [];
    for (const entry of playlistStoreState.index) {
      const playlist = await playlistStoreState.loadPlaylist(entry.id);
      if (playlist) {
        allPlaylists.push(playlist);
      }
    }

    const userProfileListens = await personalizationEngine.getListenRecords();
    const blacklist = await personalizationEngine.getBlacklist();

    return {
      version: 1,
      timestamp: Date.now(),
      favorites: {
        tracks: favStoreState.tracks as unknown as FavEntry[],
        artists: favStoreState.artists as unknown as FavEntry[],
        albums: favStoreState.albums as unknown as FavEntry[],
        deletedKeys: favStoreState.deletedKeys,
      },
      settings: settingsStoreState.values,
      playlists: allPlaylists,
      user_profile: userProfileListens,
      blacklist,
      activeProviders: useProvidersStore.getState().active,
    };
  }

  async applyRemotePayload(remotePayload: SyncPayload): Promise<{
    needsPushBack: boolean;
    counts: {
      tracks: number;
      artists: number;
      playlists: number;
      settings: number;
    };
  }> {
    let syncedTracks = 0;
    let syncedArtists = 0;
    let syncedSettings = 0;
    let syncedPlaylists = 0;
    let needsPushBack = false;

    if (remotePayload.user_profile) {
      await personalizationEngine.mergeRemoteListens(
        remotePayload.user_profile,
      );
    }

    if (remotePayload.blacklist) {
      await personalizationEngine.mergeRemoteBlacklist(
        remotePayload.blacklist.tracks ?? [],
        remotePayload.blacklist.artists ?? [],
      );
    }

    const mergedProfile = await personalizationEngine.getListenRecords();
    const remoteProfile = mergeListenRecords(
      remotePayload.user_profile || [],
      [],
    );
    const localBlacklist = await personalizationEngine.getBlacklist();
    const remoteTracks = remotePayload.blacklist?.tracks ?? [];
    const remoteArtists = (remotePayload.blacklist?.artists ?? []).map(
      (artist) => artist.trim().toLowerCase(),
    );

    const blacklistHadLocalExtras =
      localBlacklist.tracks.some((track) => !remoteTracks.includes(track)) ||
      localBlacklist.artists.some((artist) => !remoteArtists.includes(artist));

    if (
      JSON.stringify(mergedProfile) !== JSON.stringify(remoteProfile) ||
      blacklistHadLocalExtras
    ) {
      needsPushBack = true;
    }

    const toEntry = (item: {
      ref?: Record<string, unknown>;
      addedAtIso?: string;
    }): FavEntry => ({
      addedAtIso: item.addedAtIso ?? new Date().toISOString(),
      ref: (item.ref ?? item) as Record<string, unknown>,
    });

    if (remotePayload.favorites) {
      this.isApplyingRemote = true;

      const rawArtists = remotePayload.favorites.artists ?? [];
      const rawTracks = remotePayload.favorites.tracks ?? [];
      const rawAlbums = remotePayload.favorites.albums ?? [];
      const localState = useFavoritesStore.getState();

      const remoteDeletedKeys = remotePayload.favorites.deletedKeys ?? {};
      const mergedDeletedKeys: Record<string, number> = {
        ...localState.deletedKeys,
      };
      for (const [key, timestamp] of Object.entries(remoteDeletedKeys)) {
        if (
          !mergedDeletedKeys[key] ||
          (mergedDeletedKeys[key] ?? 0) < timestamp
        ) {
          mergedDeletedKeys[key] = timestamp;
        }
      }

      const { merged: mergedArtists, hadLocalExtras: artistExtras } =
        mergeFavEntries(
          (localState.artists as unknown as FavEntry[]) ?? [],
          rawArtists.map(toEntry),
          mergedDeletedKeys,
        );
      const { merged: mergedTracks, hadLocalExtras: trackExtras } =
        mergeFavEntries(
          (localState.tracks as unknown as FavEntry[]) ?? [],
          rawTracks.map(toEntry),
          mergedDeletedKeys,
        );
      const { merged: mergedAlbums, hadLocalExtras: albumExtras } =
        mergeFavEntries(
          (localState.albums as unknown as FavEntry[]) ?? [],
          rawAlbums.map(toEntry),
          mergedDeletedKeys,
        );

      if (artistExtras || trackExtras || albumExtras) {
        needsPushBack = true;
      }

      useFavoritesStore.setState({
        artists: mergedArtists as never,
        tracks: mergedTracks as never,
        albums: mergedAlbums as never,
        deletedKeys: mergedDeletedKeys,
      });

      syncedArtists = mergedArtists.length;
      syncedTracks = mergedTracks.length;

      const favDiskStore = createUniversalStore('favorites.json');
      await favDiskStore.set('favorites.tracks', mergedTracks);
      await favDiskStore.set('favorites.albums', mergedAlbums);
      await favDiskStore.set('favorites.artists', mergedArtists);
      await favDiskStore.set('favorites.deletedKeys', mergedDeletedKeys);
      await favDiskStore.save();

      this.isApplyingRemote = false;
    }

    if (
      Array.isArray(remotePayload.playlists) &&
      remotePayload.playlists.length > 0
    ) {
      const playlistStore = usePlaylistStore.getState();
      for (const rawPlaylist of remotePayload.playlists) {
        const playlist =
          (rawPlaylist as { playlist?: SyncPlaylistItem }).playlist ||
          rawPlaylist;
        if (playlist && (playlist.name || playlist.id)) {
          const playlistId = playlist.id || `synced-${playlist.name}`;
          const playlistObj = {
            id: playlistId,
            name: playlist.name || 'Playlist',
            description: playlist.description || '',
            createdAtIso: playlist.createdAtIso || new Date().toISOString(),
            lastModifiedIso:
              playlist.lastModifiedIso || new Date().toISOString(),
            isReadOnly: false,
            items: playlist.items || [],
            artwork: playlist.artwork,
          };
          await playlistFileService.savePlaylist(playlistObj as never);
          syncedPlaylists++;
        }
      }
      await playlistStore.loadIndex();
    }

    if (remotePayload.settings) {
      const settings = remotePayload.settings;
      const currentValues = { ...useSettingsStore.getState().values };
      const settingsDiskStore = createUniversalStore('settings.json');

      const isThemeKey = (key: string) =>
        key.includes('theme') || key === 'dark' || key === 'themeId';

      for (const [key, value] of Object.entries(settings)) {
        if (isThemeKey(key)) {
          continue;
        }
        const rawKey = key.replace(/^core\./, '');
        const fullKey = `core.${rawKey}`;

        currentValues[key] = value as never;
        currentValues[rawKey] = value as never;
        currentValues[fullKey] = value as never;

        await settingsDiskStore.set(key, value);
        await settingsDiskStore.set(rawKey, value);
        await settingsDiskStore.set(fullKey, value);
        syncedSettings++;
      }

      useSettingsStore.setState({ values: currentValues });
      await settingsDiskStore.save();

      const language = (settings['core.general.language'] ||
        settings['general.language'] ||
        settings.language) as string | undefined;
      if (language) {
        void changeLanguage(language);
      }
    }

    if (
      remotePayload.activeProviders &&
      typeof remotePayload.activeProviders === 'object'
    ) {
      const providersDiskStore = createUniversalStore('active-providers.json');
      const existing =
        (await providersDiskStore.get<Record<string, string>>('active')) ?? {};
      const merged = {
        ...existing,
        ...remotePayload.activeProviders,
      };
      await providersDiskStore.set('active', merged);
      await providersDiskStore.save();
      await useProvidersStore.getState().loadFromDisk();
    }

    return {
      needsPushBack,
      counts: {
        tracks: syncedTracks,
        artists: syncedArtists,
        playlists: syncedPlaylists,
        settings: syncedSettings,
      },
    };
  }

  async syncNow(): Promise<SyncResult> {
    if (this.isSyncing) {
      return { success: false, error: 'Sincronización ya en curso' };
    }
    this.isSyncing = true;

    try {
      const provider = await this.getSyncProvider();

      if (provider === 'webdav' || provider === 'gist') {
        const adapter = await this.getActiveAdapter();
        if (!adapter) {
          this.isSyncing = false;
          return {
            success: false,
            error: 'Configuración de sincronización incompleta',
          };
        }

        let remotePayload: SyncPayload | null = null;
        try {
          remotePayload = await adapter.fetchRemote();
        } catch (error) {
          this.isSyncing = false;
          return {
            success: false,
            error: `Error al conectar con el almacenamiento de sincronización: ${error instanceof Error ? error.message : String(error)}`,
          };
        }

        let applyResult = {
          needsPushBack: true,
          counts: { tracks: 0, artists: 0, playlists: 0, settings: 0 },
        };

        if (remotePayload) {
          applyResult = await this.applyRemotePayload(remotePayload);
        }

        if (!remotePayload || applyResult.needsPushBack) {
          const fullLocal = await this.gatherLocalPayload();
          await adapter.pushRemote(fullLocal);
        }

        await syncStore.set('last_sync_time', Date.now());
        await syncStore.save();
        this.lastSyncFinishedAt = Date.now();

        void defaultQueryClient.invalidateQueries({ queryKey: ['history'] });
        void defaultQueryClient.invalidateQueries({ queryKey: ['favorites'] });
        void defaultQueryClient.invalidateQueries({ queryKey: ['playlists'] });

        return {
          success: true,
          syncedCounts: applyResult.counts,
        };
      }

      // LAN Sync Provider
      const workingUrl = await this.getWorkingServerUrl();
      if (!workingUrl) {
        this.isSyncing = false;
        const savedUrl = await this.getSyncServerUrl();
        return {
          success: false,
          error: `No se puede conectar con el PC en ${savedUrl}. Comprueba que el PC está encendido y en el mismo Wi-Fi.`,
        };
      }

      const syncData = await safeFetchJson<{
        favorites?: {
          tracks?: Array<{
            ref?: Record<string, unknown>;
            title?: string;
            addedAtIso?: string;
          }>;
          albums?: Array<{
            ref?: Record<string, unknown>;
            title?: string;
            addedAtIso?: string;
          }>;
          artists?: Array<{
            ref?: Record<string, unknown>;
            name?: string;
            addedAtIso?: string;
          }>;
          deletedKeys?: Record<string, number>;
        };
        settings?: Record<string, unknown>;
        plugins?: Record<string, unknown>;
        activeProviders?: Record<string, unknown>;
        playlists?: Array<{ id: string; name: string; tracks?: unknown[] }>;
        user_profile?: UserListenRecord[];
        blacklist?: { tracks?: string[]; artists?: string[] };
        queue?: { items?: Array<{ track?: unknown }> };
      }>(`${workingUrl}/api/sync`, undefined, 3500);

      if (!syncData) {
        this.isSyncing = false;
        return {
          success: false,
          error: i18n.t('common:sync.profileDownloadFailed'),
        };
      }

      await personalizationEngine.mergeRemoteListens(
        syncData.user_profile ?? [],
      );
      if (syncData.blacklist) {
        await personalizationEngine.mergeRemoteBlacklist(
          syncData.blacklist.tracks ?? [],
          syncData.blacklist.artists ?? [],
        );
      }

      const mergedProfile = await personalizationEngine.getListenRecords();
      const remoteProfile = mergeListenRecords(syncData.user_profile, []);

      const localBlacklist = await personalizationEngine.getBlacklist();
      const remoteTracks = syncData.blacklist?.tracks ?? [];
      const remoteArtists = (syncData.blacklist?.artists ?? []).map((artist) =>
        artist.trim().toLowerCase(),
      );
      const blacklistHadLocalExtras =
        localBlacklist.tracks.some((track) => !remoteTracks.includes(track)) ||
        localBlacklist.artists.some(
          (artist) => !remoteArtists.includes(artist),
        );

      if (
        JSON.stringify(mergedProfile) !== JSON.stringify(remoteProfile) ||
        blacklistHadLocalExtras
      ) {
        const pushed = await this.pushListeningProfile(workingUrl);
        if (!pushed) {
          this.isSyncing = false;
          return {
            success: false,
            error: i18n.t('common:sync.profileUploadFailed'),
          };
        }
      }

      let syncedTracks = 0;
      let syncedArtists = 0;
      let syncedSettings = 0;

      const librarySnapshot = JSON.stringify({
        favorites: syncData.favorites,
        settings: syncData.settings,
        playlists: syncData.playlists,
        plugins: syncData.plugins,
        activeProviders: syncData.activeProviders,
      });

      if (syncData.favorites && librarySnapshot !== this.lastAppliedLibrary) {
        this.isApplyingRemote = true;

        const rawArtists = syncData.favorites.artists ?? [];
        const rawTracks = syncData.favorites.tracks ?? [];
        const rawAlbums = syncData.favorites.albums ?? [];

        const toEntry = (item: {
          ref?: Record<string, unknown>;
          addedAtIso?: string;
        }): FavEntry => ({
          addedAtIso: item.addedAtIso ?? new Date().toISOString(),
          ref: (item.ref ?? item) as Record<string, unknown>,
        });

        const localState = useFavoritesStore.getState();
        let needsPushBack = false;

        const remoteDeletedKeys = syncData.favorites.deletedKeys ?? {};
        const mergedDeletedKeys: Record<string, number> = {
          ...localState.deletedKeys,
        };
        for (const [key, timestamp] of Object.entries(remoteDeletedKeys)) {
          if (
            !mergedDeletedKeys[key] ||
            (mergedDeletedKeys[key] ?? 0) < timestamp
          ) {
            mergedDeletedKeys[key] = timestamp;
          }
        }

        const { merged: mergedArtists, hadLocalExtras: artistExtras } =
          mergeFavEntries(
            (localState.artists as unknown as FavEntry[]) ?? [],
            rawArtists.map(toEntry),
            mergedDeletedKeys,
          );
        const { merged: mergedTracks, hadLocalExtras: trackExtras } =
          mergeFavEntries(
            (localState.tracks as unknown as FavEntry[]) ?? [],
            rawTracks.map(toEntry),
            mergedDeletedKeys,
          );
        const { merged: mergedAlbums, hadLocalExtras: albumExtras } =
          mergeFavEntries(
            (localState.albums as unknown as FavEntry[]) ?? [],
            rawAlbums.map(toEntry),
            mergedDeletedKeys,
          );

        needsPushBack = artistExtras || trackExtras || albumExtras;

        useFavoritesStore.setState({
          artists: mergedArtists as never,
          tracks: mergedTracks as never,
          albums: mergedAlbums as never,
          deletedKeys: mergedDeletedKeys,
        });

        syncedArtists = mergedArtists.length;
        syncedTracks = mergedTracks.length;

        const favDiskStore = createUniversalStore('favorites.json');
        await favDiskStore.set('favorites.tracks', mergedTracks);
        await favDiskStore.set('favorites.albums', mergedAlbums);
        await favDiskStore.set('favorites.artists', mergedArtists);
        await favDiskStore.set('favorites.deletedKeys', mergedDeletedKeys);
        await favDiskStore.save();

        if (needsPushBack) {
          this.isApplyingRemote = false;
          void this.pushLocalChangesToPc();
          this.isApplyingRemote = true;
        }

        if (
          Array.isArray(syncData.playlists) &&
          syncData.playlists.length > 0
        ) {
          for (const rawPlaylist of syncData.playlists) {
            const playlist =
              (rawPlaylist as { playlist?: SyncPlaylistItem }).playlist ||
              (rawPlaylist as SyncPlaylistItem);
            if (playlist && (playlist.name || playlist.id)) {
              const playlistId = playlist.id || `synced-${playlist.name}`;
              const playlistObj = {
                id: playlistId,
                name: playlist.name || 'Playlist',
                description: playlist.description || '',
                createdAtIso: new Date().toISOString(),
                lastModifiedIso: new Date().toISOString(),
                isReadOnly: false,
                items: playlist.items || [],
                artwork: playlist.artwork,
              };

              await playlistFileService.savePlaylist(playlistObj as never);
            }
          }
          await usePlaylistStore.getState().loadIndex();
        }

        if (syncData.settings) {
          const settings = syncData.settings;
          const currentValues = { ...useSettingsStore.getState().values };
          const settingsDiskStore = createUniversalStore('settings.json');

          const isThemeKey = (key: string) =>
            key.includes('theme') || key === 'dark' || key === 'themeId';

          for (const [key, value] of Object.entries(settings)) {
            if (isThemeKey(key)) {
              continue;
            }
            const rawKey = key.replace(/^core\./, '');
            const fullKey = `core.${rawKey}`;

            currentValues[key] = value as never;
            currentValues[rawKey] = value as never;
            currentValues[fullKey] = value as never;

            await settingsDiskStore.set(key, value);
            await settingsDiskStore.set(rawKey, value);
            await settingsDiskStore.set(fullKey, value);
          }

          useSettingsStore.setState({ values: currentValues });
          await settingsDiskStore.save();

          const language = (settings['core.general.language'] ||
            settings['general.language'] ||
            settings.language) as string | undefined;
          if (language) {
            void changeLanguage(language);
          }
        }

        if (
          syncData.activeProviders &&
          typeof syncData.activeProviders === 'object'
        ) {
          const providersDiskStore = createUniversalStore(
            'active-providers.json',
          );
          const existing =
            (await providersDiskStore.get<Record<string, string>>('active')) ??
            {};
          const merged = {
            ...existing,
            ...(syncData.activeProviders as Record<string, string>),
          };
          await providersDiskStore.set('active', merged);
          await providersDiskStore.save();
          await useProvidersStore.getState().loadFromDisk();
        }

        if (syncData.plugins) {
          const pluginsDiskStore = createUniversalStore('plugins.json');
          for (const [key, value] of Object.entries(syncData.plugins)) {
            await pluginsDiskStore.set(key, value);
          }
          await pluginsDiskStore.save();
        }

        this.isApplyingRemote = false;
        this.lastAppliedLibrary = librarySnapshot;
      }

      const hostMatch = workingUrl.match(/^https?:\/\/([^:/]+)/);
      const host = hostMatch ? hostMatch[1] : '192.168.0.12';
      const pcSettings = await safeFetchJson<{
        shuffle?: boolean;
        repeat?: string;
        discovery?: boolean;
        language?: string;
      }>(`http://${host}:4120/api/settings`, 2000);

      if (pcSettings) {
        const settingsStore = useSettingsStore.getState();
        if (pcSettings.shuffle !== undefined) {
          settingsStore.setValue('playback.shuffle', pcSettings.shuffle);
        }
        if (pcSettings.repeat !== undefined) {
          settingsStore.setValue('playback.repeat', pcSettings.repeat);
        }
        if (pcSettings.discovery !== undefined) {
          settingsStore.setValue('playback.discovery', pcSettings.discovery);
        }
        if (pcSettings.language) {
          settingsStore.setValue('general.language', pcSettings.language);
          void changeLanguage(pcSettings.language);
        }
        syncedSettings++;
      }

      await syncStore.set('last_sync_time', Date.now());
      await syncStore.save();
      this.isSyncing = false;
      this.lastSyncFinishedAt = Date.now();

      void defaultQueryClient.invalidateQueries({ queryKey: ['history'] });
      void defaultQueryClient.invalidateQueries({ queryKey: ['favorites'] });
      void defaultQueryClient.invalidateQueries({ queryKey: ['playlists'] });

      this.ensureRealtimeSseConnection(workingUrl);

      return {
        success: true,
        syncedCounts: {
          tracks: syncedTracks,
          artists: syncedArtists,
          playlists: 0,
          settings: syncedSettings,
        },
      };
    } catch (error) {
      return { success: false, error: String(error) };
    } finally {
      this.isSyncing = false;
      this.isApplyingRemote = false;
    }
  }

  async exportLibraryBackup(): Promise<string> {
    const payload = await this.gatherLocalPayload();
    return JSON.stringify(payload, null, 2);
  }

  async importLibraryBackup(jsonContent: string): Promise<SyncResult> {
    try {
      const parsed = JSON.parse(jsonContent) as SyncPayload;
      if (!parsed || typeof parsed !== 'object') {
        return {
          success: false,
          error: 'Formato de archivo de respaldo no válido',
        };
      }
      const result = await this.applyRemotePayload(parsed);
      void defaultQueryClient.invalidateQueries({ queryKey: ['history'] });
      void defaultQueryClient.invalidateQueries({ queryKey: ['favorites'] });
      void defaultQueryClient.invalidateQueries({ queryKey: ['playlists'] });
      return { success: true, syncedCounts: result.counts };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Error al procesar el archivo',
      };
    }
  }

  async generateQrConfigString(): Promise<string> {
    const provider = await this.getSyncProvider();
    const config: Record<string, unknown> = { provider };
    if (provider === 'webdav') {
      config.webdav = await this.getWebDavConfig();
    } else if (provider === 'gist') {
      config.gist = await this.getGistConfig();
    } else if (provider === 'lan') {
      config.lan = { serverUrl: await this.getSyncServerUrl() };
    }
    const jsonString = JSON.stringify(config);
    return `aurora-sync://${btoa(jsonString)}`;
  }

  async applyQrConfigString(scanned: string): Promise<boolean> {
    const trimmed = scanned.trim();
    if (trimmed.startsWith('aurora-sync://')) {
      try {
        const base64Data = trimmed.replace('aurora-sync://', '');
        const decodedJson = atob(base64Data);
        const config = JSON.parse(decodedJson) as SyncConfig;

        if (config.provider === 'webdav' && config.webdav) {
          await this.setWebDavConfig(config.webdav);
          return true;
        }
        if (config.provider === 'gist' && config.gist) {
          await this.setGistConfig(config.gist);
          return true;
        }
        if (config.provider === 'lan' && config.lan) {
          await this.setSyncServerUrl(config.lan.serverUrl);
          return true;
        }
      } catch {
        return false;
      }
    }

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      await this.setSyncServerUrl(trimmed);
      return true;
    }

    return false;
  }

  async pushListeningProfile(serverUrl?: string): Promise<boolean> {
    if (this.isPushingProfile) {
      this.scheduleProfilePush();
      return false;
    }
    this.isPushingProfile = true;
    try {
      const workingUrl = serverUrl ?? (await this.getWorkingServerUrl());
      if (!workingUrl) {
        return false;
      }
      const listens = await personalizationEngine.getListenRecords();
      const blacklist = await personalizationEngine.getBlacklist();
      const response = await safeFetchJson<{ success: boolean }>(
        `${workingUrl}/api/sync/push`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_profile: listens, blacklist }),
        },
        6000,
      );
      return response?.success === true;
    } finally {
      this.isPushingProfile = false;
    }
  }

  async pushLocalChangesToPc(): Promise<boolean> {
    const serverUrl = await this.getWorkingServerUrl();
    if (!serverUrl) {
      return false;
    }

    try {
      const favStoreState = useFavoritesStore.getState();
      const settingsStoreState = useSettingsStore.getState();
      const playlistStoreState = usePlaylistStore.getState();

      const allPlaylists = [];
      for (const entry of playlistStoreState.index) {
        const playlist = await playlistStoreState.loadPlaylist(entry.id);
        if (playlist) {
          allPlaylists.push(playlist);
        }
      }

      const userProfileListens = await personalizationEngine.getListenRecords();
      const blacklist = await personalizationEngine.getBlacklist();

      const payload = {
        favorites: {
          tracks: favStoreState.tracks,
          artists: favStoreState.artists,
          albums: favStoreState.albums,
          deletedKeys: favStoreState.deletedKeys,
        },
        settings: settingsStoreState.values,
        playlists: allPlaylists,
        user_profile: userProfileListens,
        blacklist,
        activeProviders: useProvidersStore.getState().active,
      };

      const response = await fetch(`${serverUrl}/api/sync/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(6000),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  private ensureRealtimeSseConnection(serverUrl: string): void {
    if (
      this.eventSource &&
      this.eventSource.readyState !== EventSource.CLOSED
    ) {
      return;
    }

    try {
      this.eventSource = new EventSource(`${serverUrl}/api/sync/events`);
      this.eventSource.addEventListener('sync:update', () => {
        if (this.sseDebounceTimer) {
          clearTimeout(this.sseDebounceTimer);
        }
        this.sseDebounceTimer = window.setTimeout(async () => {
          if (!this.isSyncing && (await this.isAutoSyncEnabled())) {
            void this.syncNow();
          }
        }, 3000);
      });
      this.eventSource.onerror = () => {
        if (this.sseDebounceTimer) {
          clearTimeout(this.sseDebounceTimer);
          this.sseDebounceTimer = null;
        }
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
      };
    } catch {
      // ignore
    }
  }

  startBackgroundSyncWatcher(): void {
    if (this.syncIntervalTimer) {
      return;
    }

    void this.resumeSync();
    window.addEventListener('online', this.resumeSync);
    window.addEventListener('focus', this.resumeSync);

    this.syncIntervalTimer = window.setInterval(async () => {
      const autoEnabled = await this.isAutoSyncEnabled();
      if (autoEnabled && !this.isSyncing) {
        void this.syncNow();
      }
    }, P2PSyncService.SYNC_INTERVAL_MS);
  }

  stopBackgroundSyncWatcher(): void {
    window.removeEventListener('online', this.resumeSync);
    window.removeEventListener('focus', this.resumeSync);
    if (this.profilePushTimer !== null) {
      clearTimeout(this.profilePushTimer);
    }
    if (this.pushDebounceTimer !== null) {
      clearTimeout(this.pushDebounceTimer);
    }
    this.profilePushTimer = null;
    this.pushDebounceTimer = null;
    if (this.syncIntervalTimer) {
      clearInterval(this.syncIntervalTimer);
      this.syncIntervalTimer = null;
    }
    if (this.sseDebounceTimer) {
      clearTimeout(this.sseDebounceTimer);
      this.sseDebounceTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  private resumeSync = async (): Promise<void> => {
    if (await this.isAutoSyncEnabled()) {
      await this.syncNow();
    }
  };
}

export const p2pSyncService = new P2PSyncService();
