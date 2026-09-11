import { act, cleanup, render } from '@testing-library/react';

import { ApkUpdaterPlugin } from '../../services/apkUpdater';
import { useSoundStore } from '../../stores/soundStore';
import { TvAutoUpdater } from './TvAutoUpdater';

vi.mock('../../services/apkUpdater', () => ({
  ApkUpdaterPlugin: {
    getAppVersion: vi.fn().mockResolvedValue({ version: '1.48.4' }),
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
    downloadAndInstall: vi.fn().mockResolvedValue({ success: true }),
  },
}));

describe('Google TV background updates', () => {
  const checkIntervalMs = 10 * 60 * 1000;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.stubEnv('MODE', 'production');
    useSoundStore.setState({ status: 'paused' });
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

  it('selects the TV package and does not repeatedly download the same update', async () => {
    await act(async () => {
      render(<TvAutoUpdater />);
    });
    expect(ApkUpdaterPlugin.downloadAndInstall).toHaveBeenCalledWith({
      url: 'https://example.com/tv.apk',
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(checkIntervalMs);
    });
    expect(ApkUpdaterPlugin.downloadAndInstall).toHaveBeenCalledTimes(1);
  });

  it('defers background downloads while music is playing', async () => {
    useSoundStore.setState({ status: 'playing' });
    await act(async () => {
      render(<TvAutoUpdater />);
    });
    expect(ApkUpdaterPlugin.downloadAndInstall).not.toHaveBeenCalled();
    useSoundStore.setState({ status: 'paused' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(checkIntervalMs);
    });
    expect(ApkUpdaterPlugin.downloadAndInstall).toHaveBeenCalledTimes(1);
  });
});
