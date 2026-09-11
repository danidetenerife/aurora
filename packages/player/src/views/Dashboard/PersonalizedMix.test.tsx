import { act } from '@testing-library/react';

import { i18n } from '@aurora/i18n';

import { personalizationEngine } from '../../services/personalizationEngine';
import { useFavoritesStore } from '../../stores/favoritesStore';
import { usePlaylistStore } from '../../stores/playlistStore';
import { useQueueStore } from '../../stores/queueStore';
import { DashboardWrapper } from './Dashboard.test-wrapper';
import { PersonalizedMixWrapper } from './PersonalizedMix.test-wrapper';

describe('personalized recommendations', () => {
  beforeEach(async () => {
    DashboardWrapper.reset();
    await i18n.changeLanguage('es_ES');
    localStorage.clear();
    useFavoritesStore.setState({ tracks: [], artists: [], albums: [] });
    usePlaylistStore.setState({ playlists: [] });
  });

  afterEach(async () => {
    await i18n.changeLanguage('en_US');
  });

  it('shows the Panel recommendation texts in Spanish', async () => {
    await PersonalizedMixWrapper.mount();
    expect(PersonalizedMixWrapper.title).toBeInTheDocument();
    expect(PersonalizedMixWrapper.badge).toBeInTheDocument();
    expect(PersonalizedMixWrapper.description).toBeInTheDocument();
  });

  it('keeps the current list fixed and applies synced learning on the next visit', async () => {
    const view = await PersonalizedMixWrapper.mount();
    expect(
      await PersonalizedMixWrapper.recommendation('Pop Hits'),
    ).toBeInTheDocument();
    const originalRows = PersonalizedMixWrapper.rows;
    const originalContent = originalRows.map((row) => row.textContent);

    await act(async () => {
      await personalizationEngine.mergeRemoteListens([
        {
          trackId: 'remote-song',
          title: 'A song from the PC',
          artist: 'Learned Artist',
          playCount: 4,
          skipCount: 0,
          totalListenMs: 720_000,
          durationMs: 180_000,
          firstPlayedAt: Date.now(),
          lastPlayedAt: Date.now(),
        },
      ]);
    });
    await PersonalizedMixWrapper.settleRecommendations();
    expect(PersonalizedMixWrapper.rows).toEqual(originalRows);
    expect(PersonalizedMixWrapper.rows.map((row) => row.textContent)).toEqual(
      originalContent,
    );
    view.unmount();
    await PersonalizedMixWrapper.mount();
    expect(
      await PersonalizedMixWrapper.recommendation('Learned Artist'),
    ).toBeInTheDocument();
  });

  it('keeps the same rows when playing a song and learning locally', async () => {
    const view = await PersonalizedMixWrapper.mount();
    expect(
      await PersonalizedMixWrapper.recommendation('Pop Hits'),
    ).toBeInTheDocument();
    const originalRows = PersonalizedMixWrapper.rows;
    const originalContent = originalRows.map((row) => row.textContent);
    await PersonalizedMixWrapper.play('Pop Hits');
    expect(useQueueStore.getState().getCurrentItem()?.track.title).toBe(
      'Mix for Pop Hits',
    );
    expect(PersonalizedMixWrapper.rows).toEqual(originalRows);

    await act(async () => {
      await personalizationEngine.recordPlay(
        {
          title: 'My new favorite',
          source: { provider: 'music', id: 'new-song' },
          artists: [{ name: 'New Favorite Artist', roles: [] }],
          durationMs: 180_000,
        },
        true,
      );
    });
    await PersonalizedMixWrapper.settleRecommendations();
    expect(PersonalizedMixWrapper.rows).toEqual(originalRows);
    expect(PersonalizedMixWrapper.rows.map((row) => row.textContent)).toEqual(
      originalContent,
    );
    view.unmount();
    await PersonalizedMixWrapper.mount();
    expect(
      await PersonalizedMixWrapper.recommendation('New Favorite Artist'),
    ).toBeInTheDocument();
  });
});
