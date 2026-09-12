import { normalize } from '@tauri-apps/api/path';

import spotifyPlugin from '../../../../../plugins/aurora-plugin-something/src/index';
import ytMusicPlugin from '../../../../../plugins/aurora-plugin-youtube-music/src/index';
import youtubePlugin from '../../../../../plugins/aurora-plugin-youtube/src/index';
import { usePluginStore } from '../../stores/pluginStore';
import { useStartupStore } from '../../stores/startupStore';
import { errorMessage } from '../../utils/errorMessage';
import { providersHost } from '../providersHost';
import { isTauriEnvironment } from '../universalStore';
import { createPluginAPI } from './createPluginAPI';
import { checkAndUpdatePlugins } from './pluginAutoUpdate';
import { getPluginsDir } from './pluginDir';
import { PluginLoader } from './PluginLoader';
import {
  getRegistryEntry,
  listRegistryEntries,
  setRegistryEntryWarnings,
} from './pluginRegistry';

const isManagedPath = async (absPath: string): Promise<boolean> => {
  const normalizedPath = await normalize(absPath);
  const normalizedBase = await normalize(await getPluginsDir());
  return normalizedPath.startsWith(normalizedBase);
};

const loadBundledPlugins = (): void => {
  const ytMusicId = 'aurora-plugin-youtube-music';
  const ytMusicApi = createPluginAPI(ytMusicId, 'YouTube Music');
  if (ytMusicPlugin.onEnable) {
    try {
      ytMusicPlugin.onEnable(ytMusicApi);
    } catch {
      /* ignore */
    }
  }

  const spotifyId = 'aurora-plugin-something';
  const spotifyApi = createPluginAPI(spotifyId, 'Spotify');
  if (spotifyPlugin.onEnable) {
    try {
      spotifyPlugin.onEnable(spotifyApi);
    } catch {
      /* ignore */
    }
  }

  const youtubeId = 'aurora-plugin-youtube';
  const youtubeApi = createPluginAPI(youtubeId, 'YouTube');
  if (youtubePlugin.onEnable) {
    try {
      youtubePlugin.onEnable(youtubeApi);
    } catch {
      /* ignore */
    }
  }

  usePluginStore.setState((state) => ({
    plugins: {
      ...state.plugins,
      [ytMusicId]: {
        metadata: {
          id: ytMusicId,
          name: ytMusicId,
          displayName: 'YouTube Music',
          version: '0.1.0',
          description: 'YouTube Music streaming and metadata plugin for Aurora',
          categories: [
            'streaming',
            'metadata',
            'dashboard',
            'playlists',
            'discovery',
          ],
          author: 'Aurora Team',
          icon: { type: 'link', link: 'https://music.youtube.com/img/favicon_144.png' },
          entry: 'index.ts',
          permissions: [],
        },
        path: '',
        enabled: true,
        warning: false,
        warnings: [],
        installationMethod: 'store',
        instance: ytMusicPlugin,
        api: ytMusicApi,
      },
      [spotifyId]: {
        metadata: {
          id: spotifyId,
          name: spotifyId,
          displayName: 'Spotify',
          version: '0.2.2',
          description: 'Spotify metadata and playlists provider for Aurora',
          categories: ['metadata', 'playlists'],
          author: 'nukeop',
          icon: { type: 'link', link: 'https://storage.googleapis.com/pr-newsroom-wp/1/2023/05/Spotify_Primary_Logo_RGB_Green.png' },
          entry: 'index.ts',
          permissions: [],
        },
        path: '',
        enabled: true,
        warning: false,
        warnings: [],
        installationMethod: 'store',
        instance: spotifyPlugin,
        api: spotifyApi,
      },
      [youtubeId]: {
        metadata: {
          id: youtubeId,
          name: youtubeId,
          displayName: 'YouTube',
          version: '0.1.2',
          description: 'YouTube streaming provider for Aurora',
          categories: ['streaming'],
          author: 'nukeop',
          icon: { type: 'link', link: 'https://www.youtube.com/s/desktop/26a583e4/img/favicon_144x144.png' },
          entry: 'index.ts',
          permissions: [],
        },
        path: '',
        enabled: true,
        warning: false,
        warnings: [],
        installationMethod: 'store',
        instance: youtubePlugin,
        api: youtubeApi,
      },
    },
  }));

  providersHost.resolveActiveOnBootstrap();
};

export const hydratePluginsFromRegistry = async (options?: {
  loadBundled?: boolean;
}): Promise<void> => {
  useStartupStore.getState().startStartup();
  const now = Date.now();

  if (options?.loadBundled ?? true) {
    loadBundledPlugins();
  }

  if (!isTauriEnvironment()) {
    useStartupStore.getState().finishStartup(Date.now() - now);
    return;
  }

  const entries = (await listRegistryEntries()).sort(
    (a, b) =>
      new Date(a.installedAt).getTime() - new Date(b.installedAt).getTime(),
  );

  const BUNDLED_PLUGIN_IDS = new Set([
    'aurora-plugin-something',
    'aurora-plugin-youtube-music',
    'aurora-plugin-youtube',
    'nuclear-plugin-something',
    'nuclear-plugin-youtube-music',
    'nuclear-plugin-youtube',
  ]);

  for (const entry of entries) {
    if (BUNDLED_PLUGIN_IDS.has(entry.id)) {
      continue;
    }
    // TODO: Support non-managed paths (dev plugins)
    if (!(await isManagedPath(entry.path))) {
      continue;
    }
    const pluginLoadStartTime = Date.now();
    try {
      const loader = new PluginLoader(entry.path);
      const metadata = await loader.loadMetadata();
      const api = createPluginAPI(metadata.id, metadata.displayName);
      const { instance } = await loader.load(api);
      const warnings = entry.warnings ?? loader.getWarnings() ?? [];
      usePluginStore.setState((state) => ({
        plugins: {
          ...state.plugins,
          [entry.id]: {
            metadata,
            path: entry.path,
            enabled: entry.enabled,
            warning: warnings.length > 0,
            warnings,
            installationMethod: entry.installationMethod,
            originalPath: entry.originalPath,
            instance,
            api,
          },
        },
      }));
      if (entry.enabled) {
        if (instance.onEnable) {
          try {
            await instance.onEnable(api);
          } catch (enableError) {
            const message = `onEnable failed: ${errorMessage(enableError)}`;
            const updatedWarnings = [...warnings, message];
            await setRegistryEntryWarnings(entry.id, updatedWarnings);
            usePluginStore.setState((state) => ({
              plugins: {
                ...state.plugins,
                [entry.id]: {
                  ...state.plugins[entry.id],
                  warning: true,
                  warnings: updatedWarnings,
                },
              },
            }));
          }
        }
      }
    } catch (error) {
      await setRegistryEntryWarnings(entry.id, [errorMessage(error)]);
    } finally {
      const elapsed = Date.now() - pluginLoadStartTime;
      useStartupStore.getState().setPluginDuration(entry.id, elapsed);
      const targetMin = (await getRegistryEntry(entry.id))?.enabled ? 200 : 0;
      if (elapsed < targetMin) {
        await new Promise((resolve) =>
          setTimeout(resolve, targetMin - elapsed),
        );
      }
    }
  }

  providersHost.resolveActiveOnBootstrap();
  useStartupStore.getState().finishStartup(Date.now() - now);
  void checkAndUpdatePlugins();
};
