import { i18n } from '@aurora/i18n';

import {
  registerCoreSettings,
  useSettingsStore,
} from '../stores/settingsStore';
import { applyLanguageFromSettings } from './languageService';

describe('languageService', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalLanguageDescriptor = Object.getOwnPropertyDescriptor(
    window.navigator,
    'language',
  );

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    useSettingsStore.setState({
      definitions: {},
      values: {},
      loaded: true,
    });
    registerCoreSettings([
      {
        id: 'general.language',
        category: 'general',
        label: 'Language',
        type: 'select',
        default: 'en_US',
        options: [
          { value: 'en_US', label: 'English' },
          { value: 'es_ES', label: 'Español' },
        ],
      },
    ]);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalLanguageDescriptor) {
      Object.defineProperty(
        window.navigator,
        'language',
        originalLanguageDescriptor,
      );
    }
  });

  it('auto-detects Spanish when no language was explicitly persisted on disk even after default is registered', async () => {
    Object.defineProperty(window.navigator, 'language', {
      value: 'es-ES',
      configurable: true,
    });
    const changeSpy = vi.spyOn(i18n, 'changeLanguage');

    await applyLanguageFromSettings();

    expect(changeSpy).toHaveBeenCalledWith('es_ES');
    expect(useSettingsStore.getState().values['core.general.language']).toBe(
      'es_ES',
    );
  });

  it('respects an explicitly persisted language setting over browser language', async () => {
    Object.defineProperty(window.navigator, 'language', {
      value: 'es-ES',
      configurable: true,
    });
    useSettingsStore.setState({
      values: { 'core.general.language': 'en_US' },
    });
    const changeSpy = vi.spyOn(i18n, 'changeLanguage');

    await applyLanguageFromSettings();

    expect(changeSpy).toHaveBeenCalledWith('en_US');
  });
});
