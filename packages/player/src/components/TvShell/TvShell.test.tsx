import { getCurrentFocusKey } from '@noriginmedia/norigin-spatial-navigation';
import { cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetTvDetectionCache } from '../../services/tvDetection';
import { useQueueStore } from '../../stores/queueStore';
import { useTvStore } from '../../stores/tvStore';
import { TvShellWrapper } from './TvShell.test-wrapper';

describe('Google TV shell', () => {
  it('reaches playback with arrows and activates each control exactly once', async () => {
    TvShellWrapper.seedPlayback();
    await TvShellWrapper.mount();
    await userEvent.keyboard('{ArrowDown}');
    expect(TvShellWrapper.playButton).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(TvShellWrapper.pauseButton).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(TvShellWrapper.playButton).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(TvShellWrapper.nextButton).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(useQueueStore.getState().currentIndex).toBe(1);
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{Enter}');
    expect(useQueueStore.getState().currentIndex).toBe(0);
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
    expect(TvShellWrapper.videoButton).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(TvShellWrapper.hideVideoButton).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.keyboard('{Enter}');
    expect(TvShellWrapper.videoButton).toHaveAttribute('aria-pressed', 'false');
    await userEvent.keyboard('{ArrowDown}');
    expect(TvShellWrapper.dashboard).toHaveFocus();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    resetTvDetectionCache();
  });

  it('starts with remote focus on the dashboard', async () => {
    await TvShellWrapper.mount();
    expect(TvShellWrapper.shell).toBeVisible();
    expect(TvShellWrapper.dashboard).toHaveAttribute('data-focused', 'true');
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
