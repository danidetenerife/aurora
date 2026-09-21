import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import { CheckCircle2, Download, Sparkles } from 'lucide-react';
import { FC, useEffect, useRef, useState } from 'react';
import semver from 'semver';

import { useTranslation } from '@aurora/i18n';
import { cn } from '@aurora/ui';

import { ApkUpdaterPlugin } from '../../services/apkUpdater';
import { Logger } from '../../services/logger';

const GITHUB_LATEST_RELEASE_URL =
  'https://api.github.com/repos/danidetenerife/aurora/releases/latest';
const CHECK_INTERVAL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 30 * 1000;
const COMPLETE_PERCENT = 100;

type GitHubRelease = {
  tag_name: string;
  assets: { name: string; browser_download_url: string }[];
};

type TvUpdateModalProps = {
  targetVersion: string;
  isInstalling: boolean;
  onAccept: () => void;
  onLater: () => void;
};

const TvUpdateModal: FC<TvUpdateModalProps> = ({
  targetVersion,
  isInstalling,
  onAccept,
  onLater,
}) => {
  const { t } = useTranslation('tv');
  const { ref: modalBoundaryRef, focusKey: modalFocusKey } = useFocusable({
    focusKey: 'TV_UPDATE_MODAL',
    isFocusBoundary: true,
  });

  const { ref: acceptRef, focused: acceptFocused } = useFocusable({
    focusKey: 'tv-update-accept',
    onEnterPress: () => onAccept(),
  });

  const { ref: laterRef, focused: laterFocused } = useFocusable({
    focusKey: 'tv-update-later',
    onEnterPress: () => onLater(),
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setFocus('tv-update-accept');
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      data-testid="tv-update-modal-backdrop"
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/85 animate-fade-in p-6"
    >
      <FocusContext.Provider value={modalFocusKey}>
        <div
          ref={modalBoundaryRef}
          data-testid="tv-update-dialog"
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-xl rounded-3xl bg-zinc-900/95 border-2 border-emerald-500/60 p-8 shadow-[0_0_50px_rgba(16,185,129,0.25)] flex flex-col items-center text-center gap-6 text-zinc-100"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-inner">
            <Sparkles className="w-8 h-8" />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-400">
              {t('updateAvailableTitle')}
            </span>
            <h2 className="text-2xl font-black tracking-tight text-white">
              Aurora {targetVersion}
            </h2>
            <p className="text-zinc-300 text-sm leading-relaxed max-w-md mt-1">
              {t('updateDownloadedDesc', { version: targetVersion })}
            </p>
          </div>

          <div className="flex items-center justify-center gap-4 w-full mt-2">
            <button
              ref={acceptRef}
              type="button"
              data-testid="tv-update-accept-btn"
              data-focused={acceptFocused}
              data-tv-focus="tv-update-accept"
              onClick={onAccept}
              disabled={isInstalling}
              className={cn(
                'flex-1 max-w-[14rem] px-6 py-4 rounded-xl font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all duration-200',
                acceptFocused
                  ? 'bg-emerald-400 text-zinc-950 scale-105 ring-4 ring-emerald-300 shadow-[0_0_30px_rgba(52,211,153,0.8)]'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500',
              )}
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>
                {isInstalling
                  ? t('updateOpeningInstaller')
                  : t('updateNow')}
              </span>
            </button>

            <button
              ref={laterRef}
              type="button"
              data-testid="tv-update-later-btn"
              data-focused={laterFocused}
              data-tv-focus="tv-update-later"
              onClick={onLater}
              className={cn(
                'px-6 py-4 rounded-xl font-semibold text-sm tracking-wide transition-all duration-200',
                laterFocused
                  ? 'bg-zinc-700 text-white scale-105 ring-2 ring-zinc-400'
                  : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 border border-zinc-700',
              )}
            >
              <span>{t('updateLater')}</span>
            </button>
          </div>

          <span className="text-xs text-zinc-400 tracking-wide">
            ↓ / ↑ para navegar · OK para confirmar
          </span>
        </div>
      </FocusContext.Provider>
    </div>
  );
};

export const TvAutoUpdater: FC = () => {
  const { t } = useTranslation('tv');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [targetVersion, setTargetVersion] = useState('');
  const [isReadyToInstall, setIsReadyToInstall] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const apkDownloadUrlRef = useRef<string | null>(null);

  const handleAccept = async () => {
    setIsInstalling(true);
    try {
      if (typeof ApkUpdaterPlugin.installUpdate === 'function') {
        await ApkUpdaterPlugin.installUpdate();
      } else if (apkDownloadUrlRef.current) {
        await ApkUpdaterPlugin.downloadAndInstall({
          url: apkDownloadUrlRef.current,
        });
      }
    } catch (error) {
      Logger.updates.warn(`Failed to execute update installation: ${error}`);
      setIsInstalling(false);
    }
  };

  const handleLater = () => {
    setIsDismissed(true);
  };

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
        document.visibilityState === 'hidden'
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

        const apkAsset =
          release.assets.find(
            (asset) =>
              asset.name.toLowerCase().endsWith('.apk') &&
              /google[-_ ]?tv|android[-_ ]?tv|(?:^|[-_.])tv(?:[-_.]|$)/i.test(
                asset.name,
              ) &&
              !/unsigned|tvpreview/i.test(asset.name),
          ) ??
          release.assets.find(
            (asset) =>
              asset.name.toLowerCase().endsWith('.apk') &&
              !/unsigned/i.test(asset.name),
          );

        if (
          !semver.valid(latestVersion) ||
          !semver.valid(currentVersion) ||
          !semver.gt(latestVersion, currentVersion) ||
          !apkAsset ||
          isCancelled ||
          attemptedVersion === latestVersion ||
          (document.visibilityState as DocumentVisibilityState) === 'hidden'
        ) {
          return;
        }

        clearTimeout(requestTimeout);
        setIsDownloading(true);
        setDownloadProgress(0);
        setTargetVersion(release.tag_name);
        apkDownloadUrlRef.current = apkAsset.browser_download_url;

        listenerHandle = await ApkUpdaterPlugin.addListener(
          'downloadProgress',
          (data) => {
            if (!isCancelled) {
              setDownloadProgress(
                Math.max(
                  0,
                  Math.min(COMPLETE_PERCENT, Math.round(data.percent)),
                ),
              );
            }
          },
        );

        if (isCancelled) {
          return;
        }

        if (typeof ApkUpdaterPlugin.downloadUpdate === 'function') {
          const result = await ApkUpdaterPlugin.downloadUpdate({
            url: apkAsset.browser_download_url,
          });
          if (!result.success) {
            throw new Error('APK download failed');
          }
        } else {
          const result = await ApkUpdaterPlugin.downloadAndInstall({
            url: apkAsset.browser_download_url,
          });
          if (!result.success) {
            throw new Error('Android update request failed');
          }
        }

        attemptedVersion = latestVersion;
        if (!isCancelled) {
          setIsDownloading(false);
          setIsReadyToInstall(true);
          setIsDismissed(false);
        }
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

    const onSimulate = (event: Event) => {
      const customEvent = event as CustomEvent<{ version?: string }>;
      setTargetVersion(customEvent.detail?.version || 'v1.48.60');
      setIsDownloading(false);
      setIsReadyToInstall(true);
      setIsDismissed(false);
    };
    window.addEventListener('tv:simulate-update', onSimulate);

    return () => {
      isCancelled = true;
      requestController?.abort();
      listenerHandle?.remove();
      listenerHandle = null;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('focus', onResume);
      window.removeEventListener('online', onResume);
      window.removeEventListener('tv:simulate-update', onSimulate);
    };
  }, []);

  useEffect(() => {
    if (!isReadyToInstall || isDismissed) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' ||
        event.key === 'Back' ||
        event.keyCode === 27 ||
        event.keyCode === 4
      ) {
        event.preventDefault();
        event.stopPropagation();
        setIsDismissed(true);
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [isReadyToInstall, isDismissed]);

  return (
    <>
      {isDownloading && !isReadyToInstall && (
        <div
          role="status"
          data-testid="tv-update-downloading-pill"
          className="fixed top-[3.5vh] right-[4.5vw] z-[9999] flex items-center gap-3 px-4 py-2.5 rounded-full bg-zinc-900 border border-emerald-500/60 shadow-xl text-zinc-100 animate-pulse pointer-events-none"
        >
          <Download className="w-4 h-4 text-emerald-400 animate-bounce" />
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold tracking-wider text-emerald-400 uppercase">
              {t('updateAvailableTitle')}
            </span>
            <span className="text-sm font-semibold">
              {t('updateDownloading', {
                version: targetVersion,
                percent: downloadProgress,
              })}
            </span>
          </div>
        </div>
      )}

      {isReadyToInstall && !isDismissed && (
        <TvUpdateModal
          targetVersion={targetVersion}
          isInstalling={isInstalling}
          onAccept={() => void handleAccept()}
          onLater={handleLater}
        />
      )}
    </>
  );
};
