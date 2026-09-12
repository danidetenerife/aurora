import { check, Update, type DownloadEvent } from '@tauri-apps/plugin-updater';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApkUpdaterPlugin } from '../services/apkUpdater';
import { setSetting } from './settingsStore';
import { useUpdaterStore } from './updaterStore';

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn(),
}));

vi.mock('../services/apkUpdater', () => ({
  ApkUpdaterPlugin: {
    getAppVersion: vi.fn(async () => ({
      version: '1.47.1',
      versionCode: 14701,
    })),
    downloadAndInstall: vi.fn(async () => ({ success: true })),
    addListener: vi.fn(async () => ({ remove: vi.fn() })),
  },
}));

describe('useUpdaterStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (
      window as unknown as { __TAURI_INTERNALS__: unknown }
    ).__TAURI_INTERNALS__ = {};
    delete (window as Window & { Capacitor?: unknown }).Capacitor;
    useUpdaterStore.setState({
      isUpdateAvailable: false,
      updateInfo: null,
      lastChecked: null,
      isChecking: false,
      isDownloading: false,
      isInstalling: false,
      isReadyToRestart: false,
      error: null,
    });
  });

  afterEach(() => {
    (
      window as unknown as { __TAURI_INTERNALS__: unknown }
    ).__TAURI_INTERNALS__ = {};
  });

  it('automatically downloads the mobile APK even when the TV asset comes first', async () => {
    delete (window as Window & { __TAURI_INTERNALS__?: unknown })
      .__TAURI_INTERNALS__;
    await setSetting('core.updates.autoInstall', true);
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        tag_name: 'player@1.49.0',
        assets: [
          {
            name: 'aurora-google-tv.apk',
            browser_download_url: 'https://example.com/tv.apk',
          },
          {
            name: 'aurora-android.apk',
            browser_download_url: 'https://example.com/mobile.apk',
          },
        ],
      }),
    } as Response);
    await useUpdaterStore.getState().checkForUpdate();
    expect(ApkUpdaterPlugin.downloadAndInstall).toHaveBeenCalledExactlyOnceWith(
      { url: 'https://example.com/mobile.apk' },
    );
    await setSetting('core.updates.autoInstall', false);
  });

  it.each(['plugin-sdk@9.0.0', 'not-a-version', 'v1.0.0'])(
    'does not install an unrelated or older release: %s',
    async (tag) => {
      delete (window as Window & { __TAURI_INTERNALS__?: unknown })
        .__TAURI_INTERNALS__;
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          tag_name: tag,
          assets: [
            {
              name: 'aurora.apk',
              browser_download_url: 'https://example.com/app.apk',
            },
          ],
        }),
      } as Response);
      await useUpdaterStore.getState().checkForUpdate();
      expect(useUpdaterStore.getState().isUpdateAvailable).toBe(false);
      expect(ApkUpdaterPlugin.downloadAndInstall).not.toHaveBeenCalled();
    },
  );

  describe('initial state', () => {
    it('starts with no update available', () => {
      const state = useUpdaterStore.getState();
      expect(state.isUpdateAvailable).toBe(false);
      expect(state.updateInfo).toBe(null);
      expect(state.lastChecked).toBe(null);
      expect(state.isChecking).toBe(false);
      expect(state.error).toBe(null);
    });
  });

  describe('installation lifecycle', () => {
    it('waits for installation and prevents duplicate downloads and checks', async () => {
      let finishInstallation!: () => void;
      const installation = new Promise<void>((resolve) => {
        finishInstallation = resolve;
      });
      const downloadAndInstall = vi.fn(
        (onEvent?: (event: DownloadEvent) => void) => {
          onEvent?.({ event: 'Finished' });
          return installation;
        },
      );
      useUpdaterStore.setState({
        updateInfo: { downloadAndInstall } as unknown as Update,
      });

      const pending = useUpdaterStore.getState().downloadUpdate();
      expect(useUpdaterStore.getState().isInstalling).toBe(true);
      expect(useUpdaterStore.getState().isReadyToRestart).toBe(false);
      await useUpdaterStore.getState().downloadUpdate();
      await useUpdaterStore.getState().checkForUpdate();
      expect(downloadAndInstall).toHaveBeenCalledTimes(1);
      expect(check).not.toHaveBeenCalled();

      finishInstallation();
      await pending;
      expect(useUpdaterStore.getState().isInstalling).toBe(false);
      expect(useUpdaterStore.getState().isReadyToRestart).toBe(true);
      await useUpdaterStore.getState().downloadUpdate();
      expect(downloadAndInstall).toHaveBeenCalledTimes(1);
    });

    it('does not offer a restart when installation fails after downloading', async () => {
      useUpdaterStore.setState({
        updateInfo: {
          downloadAndInstall: async (
            onEvent?: (event: DownloadEvent) => void,
          ) => {
            onEvent?.({ event: 'Finished' });
            throw new Error('Installation failed');
          },
        } as unknown as Update,
      });
      await useUpdaterStore.getState().downloadUpdate();
      expect(useUpdaterStore.getState().isReadyToRestart).toBe(false);
      expect(useUpdaterStore.getState().isInstalling).toBe(false);
      expect(useUpdaterStore.getState().error).toBe('Installation failed');
    });
  });

  describe('checkForUpdate', () => {
    it('sets isChecking to true while checking', async () => {
      vi.mocked(check).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(null), 10);
          }),
      );

      const checkPromise = useUpdaterStore.getState().checkForUpdate();
      expect(useUpdaterStore.getState().isChecking).toBe(true);
      await checkPromise;
      expect(useUpdaterStore.getState().isChecking).toBe(false);
    });

    it('sets updateAvailable to false when no update', async () => {
      vi.mocked(check).mockResolvedValue(null);

      await useUpdaterStore.getState().checkForUpdate();

      const state = useUpdaterStore.getState();
      expect(state.isUpdateAvailable).toBe(false);
      expect(state.updateInfo).toBe(null);
      expect(state.lastChecked).toBeInstanceOf(Date);
      expect(state.error).toBe(null);
    });

    it('sets updateAvailable to true when update exists', async () => {
      const mockUpdate = {
        version: '1.2.3',
        date: '2025-12-30',
        body: 'New features!',
      } as unknown as Update;

      vi.mocked(check).mockResolvedValue(mockUpdate);

      await useUpdaterStore.getState().checkForUpdate();

      const state = useUpdaterStore.getState();
      expect(state.isUpdateAvailable).toBe(true);
      expect(state.updateInfo).toBe(mockUpdate);
      expect(state.lastChecked).toBeInstanceOf(Date);
      expect(state.error).toBe(null);
    });

    it('stores error when check fails', async () => {
      const error = new Error('Network error');
      vi.mocked(check).mockRejectedValue(error);

      await useUpdaterStore.getState().checkForUpdate();

      const state = useUpdaterStore.getState();
      expect(state.isChecking).toBe(false);
      expect(state.lastChecked).toBeInstanceOf(Date);
      expect(state.error).toEqual('Network error');
      expect(state.isUpdateAvailable).toBe(false);
      expect(state.updateInfo).toBe(null);
    });

    it('clears error on successful check', async () => {
      useUpdaterStore.setState({ error: 'Previous error' });

      vi.mocked(check).mockResolvedValue(null);

      await useUpdaterStore.getState().checkForUpdate();

      const state = useUpdaterStore.getState();
      expect(state.error).toBe(null);
    });

    it('checks GitHub releases on non-Tauri / Android platform', async () => {
      delete (window as unknown as { __TAURI_INTERNALS__?: unknown })
        .__TAURI_INTERNALS__;

      const mockRelease = {
        tag_name: 'v1.48.0',
        name: 'Aurora v1.48.0',
        body: 'Bug fixes and performance improvements',
        assets: [
          {
            name: 'aurora.apk',
            browser_download_url:
              'https://github.com/danidetenerife/aurora/releases/download/v1.48.0/aurora.apk',
            size: 13000000,
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockRelease,
      });

      await useUpdaterStore.getState().checkForUpdate();

      const state = useUpdaterStore.getState();
      expect(state.isUpdateAvailable).toBe(true);
      expect(state.androidApkUrl).toBe(
        'https://github.com/danidetenerife/aurora/releases/download/v1.48.0/aurora.apk',
      );
      expect(state.newVersion).toBe('v1.48.0');
    });
  });
});
