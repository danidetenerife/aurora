import { getCurrentFocusKey } from '@noriginmedia/norigin-spatial-navigation';
import { cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetTvDetectionCache } from '../../services/tvDetection';
import { useTvStore } from '../../stores/tvStore';
import { TvShellWrapper } from './TvShell.test-wrapper';

describe('Google TV shell', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    resetTvDetectionCache();
  });

  it('starts with remote focus on the dashboard', async () => {
    await TvShellWrapper.mount();
    expect(TvShellWrapper.shell).toBeVisible();
    expect(TvShellWrapper.dashboard).toHaveClass('scale-110');
    expect(getCurrentFocusKey()).toBe('tv-nav-dashboard');
  });

  it('opens search with the remote, accepts typing, and restores focus when closed', async () => {
    await TvShellWrapper.mount();
    await TvShellWrapper.openSearch();
    expect(TvShellWrapper.searchInput).toHaveFocus();
    await userEvent.keyboard('Radiohead');
    expect(TvShellWrapper.searchInput).toHaveValue('Radiohead');
    await TvShellWrapper.closeSearchWithRemote();
    await waitFor(() => {
      expect(useTvStore.getState().isSearchOpen).toBe(false);
      expect(getCurrentFocusKey()).toBe('tv-nav-search');
    });
  });
});
