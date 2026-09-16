import { FC, useEffect, useState } from 'react';
import semver from 'semver';

import { useTranslation } from '@aurora/i18n';

import { ApkUpdaterPlugin } from '../../services/apkUpdater';
import { Logger } from '../../services/logger';
import { useSoundStore } from '../../stores/soundStore';

const GITHUB_LATEST_RELEASE_URL =
  'https://api.github.com/repos/danidetenerife/aurora/releases/latest';
const CHECK_INTERVAL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 30 * 1000;
const COMPLETE_PERCENT = 100;

type GitHubRelease = {
  tag_name: string;
  assets: { name: string; browser_download_url: string }[];
};

export const TvAutoUpdater: FC = () => {
  const { t } = useTranslation();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [targetVersion, setTargetVersion] = useState('');

  useEffect(() => {
    let isCancelled = false;
    let checkInProgress = false;
    let attemptedVersion: string | null = null;
    let requestController: AbortController | null = null;
    let listenerHandle: { remove: () => void } | null = null;

    const checkForTvUpdate = async () => {
      if (
        isCancelled ||
        checkInProgress ||
        document.visibilityState === 'hidden' ||
        useSoundStore.getState().status === 'playing'
      ) {
        return;
      }
      checkInProgress = true;
      requestController = new AbortController();
      const requestTimeout = setTimeout(
        () => requestController?.abort(),
        REQUEST_TIMEOUT_MS,
      );
      try {
        const response = await fetch(GITHUB_LATEST_RELEASE_URL, {
          headers: { Accept: 'application/vnd.github.v3+json' },
          signal: requestController.signal,
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error(`GitHub API returned status ${response.status}`);
        }
        const release: GitHubRelease = await response.json();
        const latestVersion = release.tag_name.replace(/^(?:player@|v)/, '');
        const appVersion = await ApkUpdaterPlugin.getAppVersion();
        const currentVersion = appVersion.version.replace(/^(?:player@|v)/, '');
        const apkAsset = release.assets.find(
          (asset) =>
            asset.name.toLowerCase().endsWith('.apk') &&
            /google[-_ ]?tv|android[-_ ]?tv|(?:^|[-_.])tv(?:[-_.]|$)/i.test(
              asset.name,
            ) &&
            !/unsigned|tvpreview/i.test(asset.name),
        );
        if (
          !semver.valid(latestVersion) ||
          !semver.valid(currentVersion) ||
          !semver.gt(latestVersion, currentVersion) ||
          !apkAsset ||
          isCancelled ||
          attemptedVersion === latestVersion ||
          (document.visibilityState as DocumentVisibilityState) === 'hidden' ||
          useSoundStore.getState().status === 'playing'
        ) {
          return;
        }
        clearTimeout(requestTimeout);
        setIsDownloading(true);
        setDownloadProgress(0);
        setTargetVersion(release.tag_name);
        listenerHandle = await ApkUpdaterPlugin.addListener(
          'downloadProgress',
          (data) => {
            if (!isCancelled) {
              setDownloadProgress(
                Math.max(0, Math.min(COMPLETE_PERCENT, Math.round(data.percent))),
              );
            }
          },
        );
        if (isCancelled) {
          return;
        }
        const result = await ApkUpdaterPlugin.downloadAndInstall({
          url: apkAsset.browser_download_url,
        });
        if (!result.success) {
          throw new Error('Android update request failed');
        }
        attemptedVersion = latestVersion;
      } catch (error) {
        if (!isCancelled) {
          Logger.updates.warn(`TvAutoUpdater check failed: ${error}`);
        }
      } finally {
        clearTimeout(requestTimeout);
        listenerHandle?.remove();
        listenerHandle = null;
        checkInProgress = false;
        if (!isCancelled) {
          setIsDownloading(false);
        }
      }
    };

    void checkForTvUpdate();
    const interval = setInterval(checkForTvUpdate, CHECK_INTERVAL_MS);
    const onResume = () => void checkForTvUpdate();
    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('focus', onResume);
    window.addEventListener('online', onResume);

    return () => {
      isCancelled = true;
      requestController?.abort();
      listenerHandle?.remove();
      listenerHandle = null;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('focus', onResume);
      window.removeEventListener('online', onResume);
    };
  }, []);

  if (!isDownloading) {
    return null;
  }

  return (
    <div
      role="status"
      className="tv-update-status"
      style={{
        position: 'fixed',
        top: '6rem',
        right: '4.5vw',
        maxWidth: '24rem',
        zIndex: 9999,
        background: '#185745',
        border: '2px solid #62e2bd',
        borderRadius: '0.5rem',
        padding: '0.75rem 1rem',
        color: '#f4f4f5',
        pointerEvents: 'none',
        fontSize: '1rem',
        fontWeight: 600,
      }}
    >
      {downloadProgress < COMPLETE_PERCENT
        ? t('tv.updateDownloading', {
            version: targetVersion,
            percent: downloadProgress,
          })
        : t('tv.updateOpeningInstaller')}
    </div>
  );
};
