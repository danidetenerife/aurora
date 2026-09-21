import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

import { ApkUpdaterPlugin } from '../../services/apkUpdater';
import { initSpatialNavigation } from '../../services/spatialNavigation';
import { TvAutoUpdater } from './TvAutoUpdater';

vi.mock('../../services/apkUpdater', () => ({
  ApkUpdaterPlugin: {
    getAppVersion: vi.fn().mockResolvedValue({ version: '1.48.4' }),
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
    downloadUpdate: vi.fn().mockResolvedValue({ success: true, path: '/cache/aurora-update.apk' }),
    installUpdate: vi.fn().mockResolvedValue({ success: true }),
    downloadAndInstall: vi.fn().mockResolvedValue({ success: true }),
  },
}));

describe('Google TV background updates', () => {
  const checkIntervalMs = 10 * 60 * 1000;

  beforeAll(() => {
    initSpatialNavigation();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.stubEnv('MODE', 'production');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          tag_name: 'v1.49.0',
          assets: [
            {
              name: 'aurora-mobile.apk',
              browser_download_url: 'https://example.com/mobile.apk',
            },
            {
              name: 'aurora-google-tv.apk',
              browser_download_url: 'https://example.com/tv.apk',
            },
          ],
        }),
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('selects the TV package and downloads the update in the background', async () => {
    await act(async () => {
      render(<TvAutoUpdater />);
    });
    expect(ApkUpdaterPlugin.downloadUpdate).toHaveBeenCalledWith({
      url: 'https://example.com/tv.apk',
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(checkIntervalMs);
    });
    expect(ApkUpdaterPlugin.downloadUpdate).toHaveBeenCalledTimes(1);
  });

  it('falls back to aurora-music-player.apk when no TV-specific asset is in release', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          tag_name: 'v1.49.0',
          assets: [
            {
              name: 'Aurora_1.49.0_x64-setup.exe',
              browser_download_url: 'https://example.com/setup.exe',
            },
            {
              name: 'aurora-music-player.apk',
              browser_download_url: 'https://example.com/aurora-music-player.apk',
            },
          ],
        }),
      }),
    );

    await act(async () => {
      render(<TvAutoUpdater />);
    });
    expect(ApkUpdaterPlugin.downloadUpdate).toHaveBeenCalledWith({
      url: 'https://example.com/aurora-music-player.apk',
    });
  });

  it('renders the update modal upon download completion and triggers install on click', async () => {
    await act(async () => {
      render(<TvAutoUpdater />);
    });

    const dialog = screen.getByTestId('tv-update-dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Aurora v1.49.0');

    const acceptBtn = screen.getByTestId('tv-update-accept-btn');
    await act(async () => {
      fireEvent.click(acceptBtn);
    });

    expect(ApkUpdaterPlugin.installUpdate).toHaveBeenCalled();
  });

  it('dismisses the update modal when user clicks later button', async () => {
    await act(async () => {
      render(<TvAutoUpdater />);
    });

    expect(screen.getByTestId('tv-update-dialog')).toBeInTheDocument();

    const laterBtn = screen.getByTestId('tv-update-later-btn');
    await act(async () => {
      fireEvent.click(laterBtn);
    });

    expect(screen.queryByTestId('tv-update-dialog')).not.toBeInTheDocument();
  });
});
