import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetTvDetectionCache } from '../../services/tvDetection';
import { useQueueStore } from '../../stores/queueStore';
import { useSoundStore } from '../../stores/soundStore';
import { useStartupStore } from '../../stores/startupStore';
import { useTvStore } from '../../stores/tvStore';
import { TvShell } from './TvShell';

export const TvShellWrapper = {
  async focusPlayback() {
    await act(async () => setFocus('tv-control-play'));
  },
  get favorites() {
    return screen.getByTestId('tv-nav-item-favorites');
  },
  seedPlayback() {
    useQueueStore.setState({
      currentIndex: 0,
      items: ['Primera canción', 'Segunda canción'].map((title, index) => ({
        id: String(index),
        track: {
          title,
          artists: [],
          source: { provider: 'test', id: String(index) },
        },
        status: 'success' as const,
        addedAtIso: '2026-09-10T00:00:00Z',
      })),
    });
    useSoundStore.setState({ src: null, status: 'paused' });
  },
  get playButton() {
    return screen.getByRole('button', { name: 'Reproducir', exact: true });
  },
  get pauseButton() {
    return screen.getByRole('button', { name: 'Pausar', exact: true });
  },
  get nextButton() {
    return screen.getByRole('button', { name: 'Siguiente', exact: true });
  },
  get videoButton() {
    return screen.getByRole('button', {
      name: 'Activar videoclip',
      exact: true,
    });
  },
  get hideVideoButton() {
    return screen.getByRole('button', {
      name: 'Ocultar videoclip',
      exact: true,
    });
  },
  async mount() {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Linux; Android 12) Aurora GoogleTV',
    );
    resetTvDetectionCache();
    useStartupStore.setState({ isStartingUp: false });
    useTvStore.setState({
      activeSection: 'dashboard',
      isSearchOpen: false,
      showVideo: false,
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <TvShell />
      </QueryClientProvider>,
    );
    await screen.findByTestId('tv-shell');
  },
  get shell() {
    return screen.getByTestId('tv-shell');
  },
  get dashboard() {
    return screen.getByTestId('tv-nav-item-dashboard');
  },
  get searchInput() {
    return screen.getByTestId('tv-search-input');
  },
  async openSearch() {
    await act(async () => {
      setFocus('tv-nav-search');
    });
    await userEvent.keyboard('{Enter}');
    await screen.findByTestId('tv-search-input');
  },
  async closeSearchWithRemote() {
    await userEvent.keyboard('{ArrowDown}{Enter}');
  },
};
