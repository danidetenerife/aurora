import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { i18n } from '@aurora/i18n';

import { providersHost } from '../../services/providersHost';
import { useStartupStore } from '../../stores/startupStore';
import { MetadataProviderBuilder } from '../../test/builders/MetadataProviderBuilder';
import { DashboardWrapper } from './Dashboard.test-wrapper';

const RECOMMENDATION_UPDATE_SETTLE_MS = 1200;

export const PersonalizedMixWrapper = {
  async waitForRows() {
    return within(this.section).findAllByTestId('track-row');
  },
  get visibleTitle() {
    return within(this.rows[0]).getByText(/^Mix for /).textContent;
  },
  async playVisible() {
    await userEvent.click(this.rows[0]);
  },
  async nextPage() {
    await userEvent.click(
      within(this.section).getByRole('button', {
        name: i18n.t('pagination:next'),
      }),
    );
  },
  async mount() {
    providersHost.clear();
    useStartupStore.setState({
      isStartingUp: false,
      startupFinishedAt: undefined,
      totalStartupTimeMs: undefined,
      pluginDurations: {},
    });
    providersHost.register(
      new MetadataProviderBuilder()
        .withSearch(async ({ query }) => ({
          tracks: [
            {
              title: 'Mix for ' + query,
              artists: [{ name: query, roles: [] }],
              source: { provider: 'test', id: query },
            },
          ],
        }))
        .build(),
    );
    return DashboardWrapper.mount();
  },
  get section() {
    return screen.getByTestId('dashboard-personalized-mix');
  },
  get rows() {
    return within(this.section).getAllByTestId('track-row');
  },
  get title() {
    return within(this.section).getByRole('heading', {
      name: 'Recomendado para ti',
    });
  },
  get badge() {
    return within(this.section).getByText('Algoritmo adaptativo');
  },
  get description() {
    return within(this.section).getByText(
      'Las recomendaciones aprenden de tus escuchas, saltos y favoritos en tus dispositivos sincronizados.',
    );
  },
  async play(artist: string) {
    await userEvent.click(await this.recommendation(artist));
  },
  async settleRecommendations() {
    await act(async () => {
      await new Promise((resolve) =>
        setTimeout(resolve, RECOMMENDATION_UPDATE_SETTLE_MS),
      );
    });
  },
  async recommendation(artist: string) {
    return within(this.section).findByText(
      'Mix for ' + artist,
      {},
      { timeout: 5000 },
    );
  },
};
