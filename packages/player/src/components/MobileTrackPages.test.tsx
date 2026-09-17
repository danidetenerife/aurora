import { act, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useQueueStore } from '../stores/queueStore';
import { createMockTrack } from '../test/utils/mockTrack';
import { MobileTrackPagesWrapper } from './MobileTrackPages.test-wrapper';

describe('MobileTrackPages', () => {
  const tracks = [
    createMockTrack('Song 0'),
    createMockTrack('Song 1'),
    createMockTrack('Song 2'),
    createMockTrack('Song 3'),
    createMockTrack('Song 4'),
    createMockTrack('Song 5'),
    createMockTrack('Song 6'),
    createMockTrack('Song 7'),
    createMockTrack('Song 8'),
  ];

  beforeEach(() => {
    cleanup();
    useQueueStore.setState({
      items: [],
      currentIndex: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders initial page correctly with capacity of 3', async () => {
    await MobileTrackPagesWrapper.mount(tracks, 3);

    expect(MobileTrackPagesWrapper.indicatorText).toBe('1 / 3');
    expect(MobileTrackPagesWrapper.trackRows).toHaveLength(3);
    expect(MobileTrackPagesWrapper.prevButton.isDisabled).toBe(true);
    expect(MobileTrackPagesWrapper.nextButton.isDisabled).toBe(false);
  });

  it('navigates forward and backward with pagination buttons', async () => {
    await MobileTrackPagesWrapper.mount(tracks, 3);

    await MobileTrackPagesWrapper.nextButton.click();
    expect(MobileTrackPagesWrapper.indicatorText).toBe('2 / 3');

    await MobileTrackPagesWrapper.nextButton.click();
    expect(MobileTrackPagesWrapper.indicatorText).toBe('3 / 3');
    expect(MobileTrackPagesWrapper.nextButton.isDisabled).toBe(true);

    await MobileTrackPagesWrapper.prevButton.click();
    expect(MobileTrackPagesWrapper.indicatorText).toBe('2 / 3');
  });

  it('automatically advances page hands-free when active queue track changes (Zero-Touch Driving Safety)', async () => {
    MobileTrackPagesWrapper.setQueue(tracks, 0);
    await MobileTrackPagesWrapper.mount(tracks, 3);

    expect(MobileTrackPagesWrapper.indicatorText).toBe('1 / 3');

    // Simulate car queue advancing to Song 4 (which belongs on page 2: index 3, 4, 5)
    MobileTrackPagesWrapper.advanceQueue(4);

    expect(MobileTrackPagesWrapper.indicatorText).toBe('2 / 3');
    expect(MobileTrackPagesWrapper.activeTrackRow).toBeDefined();

    // Advance queue to Song 7 (belongs on page 3: index 6, 7, 8)
    MobileTrackPagesWrapper.advanceQueue(7);

    expect(MobileTrackPagesWrapper.indicatorText).toBe('3 / 3');
  });

  it('highlights the active playing track for glanceability (< 1.5s NHTSA)', async () => {
    MobileTrackPagesWrapper.setQueue(tracks, 1);
    await MobileTrackPagesWrapper.mount(tracks, 3);

    const activeRow = MobileTrackPagesWrapper.activeTrackRow;
    expect(activeRow).toBeDefined();
    expect(activeRow?.getAttribute('data-active-track')).toBe('true');
  });

  it('navigates pages via touch swipe gestures', async () => {
    await MobileTrackPagesWrapper.mount(tracks, 3);
    expect(MobileTrackPagesWrapper.indicatorText).toBe('1 / 3');

    // Swipe left to go to next page
    MobileTrackPagesWrapper.swipeLeft();
    expect(MobileTrackPagesWrapper.indicatorText).toBe('2 / 3');

    // Swipe right to go back to previous page
    MobileTrackPagesWrapper.swipeRight();
    expect(MobileTrackPagesWrapper.indicatorText).toBe('1 / 3');
  });

  it('shows sync button when user browses away from playing track, and sync button snaps back', async () => {
    MobileTrackPagesWrapper.setQueue(tracks, 1); // Song 1 is on page 1
    await MobileTrackPagesWrapper.mount(tracks, 3);

    expect(MobileTrackPagesWrapper.indicatorText).toBe('1 / 3');

    // User browses to page 2 manually
    await MobileTrackPagesWrapper.nextButton.click();
    expect(MobileTrackPagesWrapper.indicatorText).toBe('2 / 3');

    // Sync button should now be visible
    expect(MobileTrackPagesWrapper.syncButton.element).toBeInTheDocument();

    // Clicking sync button snaps back to now-playing page (page 1)
    await MobileTrackPagesWrapper.syncButton.click();
    expect(MobileTrackPagesWrapper.indicatorText).toBe('1 / 3');
  });

  it('automatically returns to playing page after 8 seconds of inactivity', async () => {
    MobileTrackPagesWrapper.setQueue(tracks, 0); // Song 0 is on page 1
    await MobileTrackPagesWrapper.mount(tracks, 3);

    expect(MobileTrackPagesWrapper.indicatorText).toBe('1 / 3');

    vi.useFakeTimers({ shouldAdvanceTime: true });

    // User browses to page 3
    await MobileTrackPagesWrapper.nextButton.click();
    await MobileTrackPagesWrapper.nextButton.click();
    expect(MobileTrackPagesWrapper.indicatorText).toBe('3 / 3');

    // Fast-forward 8 seconds of driving inactivity
    act(() => {
      vi.advanceTimersByTime(8000);
    });

    expect(MobileTrackPagesWrapper.indicatorText).toBe('1 / 3');
  });

  it('survives chaos monkey stress test (20 rapid skips without crash or de-sync)', async () => {
    MobileTrackPagesWrapper.setQueue(tracks, 0);
    await MobileTrackPagesWrapper.mount(tracks, 3);

    // Rapid skip through tracks back and forth
    for (let index = 0; index < 20; index++) {
      const targetTrackIndex = index % tracks.length;
      MobileTrackPagesWrapper.advanceQueue(targetTrackIndex);
      const expectedPage = Math.floor(targetTrackIndex / 3) + 1;
      expect(MobileTrackPagesWrapper.indicatorText).toBe(`${expectedPage} / 3`);
    }
  });

  it('handles empty track lists gracefully without errors', async () => {
    await MobileTrackPagesWrapper.mount([], 3);

    expect(MobileTrackPagesWrapper.indicatorText).toBe('1 / 1');
    expect(MobileTrackPagesWrapper.prevButton.isDisabled).toBe(true);
    expect(MobileTrackPagesWrapper.nextButton.isDisabled).toBe(true);
  });
});
