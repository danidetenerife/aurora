import { check, Update, type DownloadEvent } from '@tauri-apps/plugin-updater';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUpdaterStore } from './updaterStore';

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn(),
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
