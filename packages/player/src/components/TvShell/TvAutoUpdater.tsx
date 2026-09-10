import { FC, useEffect, useState } from 'react';
import semver from 'semver';

import { ApkUpdaterPlugin } from '../../services/apkUpdater';
import { Logger } from '../../services/logger';

const CURRENT_FALLBACK_VERSION = '1.48.4';
const GITHUB_REPO = 'danidetenerife/aurora';
const GITHUB_LATEST_RELEASE_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const CHECK_INTERVAL_MS = 10 * 60 * 1000;

type GitHubAsset = {
  name: string;
  browser_download_url: string;
  size: number;
};

type GitHubRelease = {
  tag_name: string;
  name: string;
  body: string;
  assets: GitHubAsset[];
};

export const TvAutoUpdater: FC = () => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [targetVersion, setTargetVersion] = useState<string | null>(null);

  useEffect(() => {
    if (import.meta.env.MODE === 'test') {
      return;
    }

    let isCancelled = false;

    const checkForTvUpdate = async () => {
      try {
        const response = await fetch(GITHUB_LATEST_RELEASE_URL, {
          headers: {
            Accept: 'application/vnd.github.v3+json',
          },
        });

        if (!response.ok) {
          return;
        }

        const release: GitHubRelease = await response.json();
        const latestTag = release.tag_name.replace(/^v/, '');

        let currentClean = CURRENT_FALLBACK_VERSION.replace(/^v/, '');
        try {
          const appVer = await ApkUpdaterPlugin.getAppVersion();
          if (appVer?.version) {
            currentClean = appVer.version.replace(/^v/, '');
          }
        } catch {
          // fallback to CURRENT_FALLBACK_VERSION
        }

        const isNewer =
          semver.valid(latestTag) && semver.valid(currentClean)
            ? semver.gt(latestTag, currentClean)
            : latestTag !== currentClean;

        const apkAsset = release.assets?.find((asset) =>
          asset.name.toLowerCase().endsWith('.apk'),
        );

        if (isNewer && apkAsset && !isCancelled) {
          Logger.updates.info(
            `TvAutoUpdater: New version ${release.tag_name} detected. Starting automatic background update...`,
          );
          setIsDownloading(true);
          setTargetVersion(release.tag_name);

          let listenerHandle: { remove: () => void } | null = null;
          try {
            listenerHandle = await ApkUpdaterPlugin.addListener(
              'downloadProgress',
              (data) => {
                if (!isCancelled) {
                  setDownloadProgress(data.percent);
                }
              },
            );
          } catch {
            // ignore
          }

          try {
            await ApkUpdaterPlugin.downloadAndInstall({
              url: apkAsset.browser_download_url,
            });
          } finally {
            if (listenerHandle) {
              listenerHandle.remove();
            }
          }
        }
      } catch (err) {
        Logger.updates.warn(`TvAutoUpdater check failed: ${err}`);
      }
    };

    void checkForTvUpdate();

    const interval = setInterval(checkForTvUpdate, CHECK_INTERVAL_MS);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!isDownloading) {
    return null;
  }

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        top: '1.25rem',
        right: '2.5rem',
        zIndex: 9999,
        background: '#185745',
        border: '2px solid #62e2bd',
        borderRadius: '0.5rem',
        padding: '0.5rem 1rem',
        color: '#f4f4f5',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.6)',
      }}
    >
      <div
        style={{
          width: '0.85rem',
          height: '0.85rem',
          border: '2px solid #62e2bd',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
        {downloadProgress < 100
          ? `Actualizando Aurora a ${targetVersion ?? 'nueva versión'}... (${downloadProgress}%)`
          : 'Instalando actualización...'}
      </span>
    </div>
  );
};
