import { Settings } from 'luxon';

import { i18n } from '@aurora/i18n';

import { useSettingsStore } from '../stores/settingsStore';
import { coreSettingsHost } from './settingsHost';

export const changeLanguage = async (locale: string) => {
  await i18n.changeLanguage(locale);
  Settings.defaultLocale = locale.replaceAll('_', '-');
};

export const applyLanguageFromSettings = async () => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  const persistedValues = useSettingsStore.getState().values;
  const hasExplicitLanguage =
    persistedValues['core.general.language'] !== undefined ||
    persistedValues['general.language'] !== undefined;
  const savedLanguage = hasExplicitLanguage
    ? await coreSettingsHost.get<string>('general.language')
    : undefined;
  if (savedLanguage && typeof savedLanguage === 'string') {
    await changeLanguage(savedLanguage);
  } else {
    await changeLanguage('es_ES');
    await coreSettingsHost.set('general.language', 'es_ES');
  }
};

export const initLanguageWatcher = () => {
  coreSettingsHost.subscribe('general.language', (value) => {
    if (value && typeof value === 'string') {
      void changeLanguage(value);
    }
  });
};
