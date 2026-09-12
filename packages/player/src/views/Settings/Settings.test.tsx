import { vi } from 'vitest';

import { registerBuiltInCoreSettings } from '../../services/coreSettings';
import { isCapacitorEnvironment } from '../../services/universalStore';
import { resetInMemoryTauriStore } from '../../test/utils/inMemoryTauriStore';
import { SettingsWrapper } from './Settings.test-wrapper';

window.scrollTo = vi.fn();

vi.mock('../../services/universalStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/universalStore')>()),
  isCapacitorEnvironment: vi.fn(() => false),
}));

describe('Settings view', async () => {
  beforeEach(() => {
    resetInMemoryTauriStore();
    vi.mocked(isCapacitorEnvironment).mockReturnValue(false);
    registerBuiltInCoreSettings();
  });
  it('(Snapshot) renders the settings view', async () => {
    const { getByRole } = await SettingsWrapper.mount();
    expect(getByRole('dialog')).toMatchSnapshot();
  });
  it('shows only mobile settings sections and the Aurora wordmark in the APK', async () => {
    vi.mocked(isCapacitorEnvironment).mockReturnValue(true);
    await SettingsWrapper.mount();
    expect(
      SettingsWrapper.tabs.map((tab) => tab.getAttribute('data-testid')),
    ).toEqual([
      'settings-tab-general',
      'settings-tab-sync',
      'settings-tab-plugins',
    ]);
    expect(SettingsWrapper.logo).toBeInTheDocument();
  });
});
