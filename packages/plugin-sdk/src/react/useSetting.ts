import { useEffect, useMemo, useState } from 'react';

import type { SettingsHost, SettingValue } from '../types/settings';

export const useSetting = <T extends SettingValue = SettingValue>(
  host: SettingsHost | undefined,
  id: string,
) => {
  const [currentValue, setCurrentValue] = useState<T | undefined>(undefined);

  useEffect(() => {
    setCurrentValue(undefined);
    if (!host) {
      return;
    }
    let isMounted = true;
    let hasReceivedUpdate = false;
    const unsubscribe = host.subscribe<T>(id, (nextValue) => {
      if (!isMounted) {
        return;
      }
      hasReceivedUpdate = true;
      setCurrentValue(nextValue);
    });
    host
      .get<T>(id)
      .then((initialValue) => {
        if (!isMounted) {
          return;
        }
        if (!hasReceivedUpdate) {
          setCurrentValue(initialValue);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [id, host]);

  const setValue = useMemo(
    () => (nextValue: T) => {
      if (!host) {
        return;
      }
      setCurrentValue(nextValue);
      void host.set<T>(id, nextValue).catch(() => {});
    },
    [id, host],
  );

  return [currentValue, setValue] as const;
};
