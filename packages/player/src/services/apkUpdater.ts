import { registerPlugin } from '@capacitor/core';

export type DownloadProgressData = {
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
};

export type AppVersionData = {
  version: string;
  versionCode: number;
};

export type ApkUpdaterPluginInterface = {
  getAppVersion(): Promise<AppVersionData>;
  downloadUpdate(options: { url: string }): Promise<{ success: boolean; path?: string }>;
  installUpdate(): Promise<{ success: boolean }>;
  downloadAndInstall(options: { url: string }): Promise<{ success: boolean }>;
  addListener(
    event: 'downloadProgress',
    handler: (data: DownloadProgressData) => void,
  ): Promise<{ remove: () => void }>;
};

export const ApkUpdaterPlugin = registerPlugin<ApkUpdaterPluginInterface>(
  'ApkUpdater',
  {
    web: {
      getAppVersion: () =>
        Promise.resolve({ version: '1.48.62', versionCode: 14862 }),
      downloadUpdate: () => Promise.resolve({ success: true, path: '/tmp/aurora-update.apk' }),
      installUpdate: () => Promise.resolve({ success: true }),
      downloadAndInstall: () => Promise.resolve({ success: true }),
      addListener: () => Promise.resolve({ remove: () => {} }),
    },
  },
);
