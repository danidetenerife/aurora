import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { QueryClient } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../../App';
import { resetTvDetectionCache } from '../../services/tvDetection';
import { useStartupStore } from '../../stores/startupStore';
import { useTvStore } from '../../stores/tvStore';

export const TvShellWrapper = {
  async mount() {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Linux; Android 12) Aurora GoogleTV',
    );
    resetTvDetectionCache();
    useStartupStore.setState({ isStartingUp: false });
    useTvStore.setState({ activeSection: 'dashboard', isSearchOpen: false });
    render(<App queryClientProp={new QueryClient()} />);
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
