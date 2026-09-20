import { getVersion } from '@tauri-apps/api/app';
import { useEffect, useState } from 'react';

import { ApkUpdaterPlugin } from '../services/apkUpdater';
import { Logger } from '../services/logger';
import {
  isCapacitorEnvironment,
  isTauriEnvironment,
} from '../services/universalStore';

export const COMMIT_HASH =
  typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : '';

export const useAppVersion = () => {
  const [version, setVersion] = useState<string | null>('1.48.58');

  useEffect(() => {
    if (isTauriEnvironment()) {
      getVersion()
        .then(setVersion)
        .catch((error) => {
          Logger.app.error(`Failed to get app version: ${error}`);
        });
      return;
    }

    if (isCapacitorEnvironment()) {
      ApkUpdaterPlugin.getAppVersion()
        .then((data) => {
          if (data?.version) {
            setVersion(data.version);
          }
        })
        .catch((error) => {
          Logger.app.error(`Failed to get capacitor app version: ${error}`);
        });
    }
  }, []);

  return {
    version,
    commitHash: COMMIT_HASH,
  };
};
