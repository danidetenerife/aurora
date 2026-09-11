import { useSetting } from '@aurora/plugin-sdk';
import type { SettingValue } from '@aurora/plugin-sdk';

import { coreSettingsHost } from '../services/settingsHost';

export const useCoreSetting = <T extends SettingValue = SettingValue>(
  id: string,
) => useSetting<T>(coreSettingsHost, id);
