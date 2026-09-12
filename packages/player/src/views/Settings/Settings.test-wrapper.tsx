import { render, RenderResult, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../../App';
import { registerBuiltInCoreSettings } from '../../services/coreSettings';
import { initializeSettingsStore } from '../../stores/settingsStore';

export const SettingsWrapper = {
  get tabs() {
    return within(screen.getByRole('dialog')).getAllByTestId(/^settings-tab-/);
  },
  get logo() {
    return screen.getByRole('img', { name: 'Aurora', hidden: true });
  },
  async mount(): Promise<RenderResult> {
    await initializeSettingsStore();
    registerBuiltInCoreSettings();
    const component = render(<App />);
    await userEvent.click(
      await component.findByRole('button', { name: 'Preferences' }),
    );
    await userEvent.click(
      await component.findByRole('button', {
        name: 'General',
      }),
    );
    await screen.findByRole('heading', { name: 'General', level: 1 });

    return component;
  },
};
