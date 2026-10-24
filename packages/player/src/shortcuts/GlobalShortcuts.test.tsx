import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../App';
import { registerBuiltInCoreSettings } from '../services/coreSettings';
import { playbackManager } from '../services/playback';
import { initSpatialNavigation } from '../services/spatialNavigation';
import { useQueueStore } from '../stores/queueStore';
import { useSettingsModalStore } from '../stores/settingsModalStore';
import {
  getSetting,
  initializeSettingsStore,
  setSetting,
} from '../stores/settingsStore';
import { useSoundStore } from '../stores/soundStore';
import { resetInMemoryTauriStore } from '../test/utils/inMemoryTauriStore';
import { createMockTrack } from '../test/utils/mockTrack';

const user = userEvent.setup();

describe('Keyboard input without unwanted global shortcut actions', () => {
  beforeEach(async () => {
    resetInMemoryTauriStore();
    await initializeSettingsStore();
    registerBuiltInCoreSettings();
    useSoundStore.setState({
      status: 'stopped',
      seek: 50,
      duration: 200,
    });
    useSettingsModalStore.setState({
      isOpen: false,
    });
    render(<App />);
  });

  it('does not trigger playback or settings actions on keyboard presses', async () => {
    const currentItem = {
      id: '1',
      track: createMockTrack('Track 1'),
      status: 'idle',
      addedAtIso: '',
    } as const;
    const nextItem = {
      id: '2',
      track: createMockTrack('Track 2'),
      status: 'idle',
      addedAtIso: '',
    } as const;
    useQueueStore.setState({
      items: [currentItem, nextItem],
      currentIndex: 0,
    });
    playbackManager.startTrack(
      currentItem,
      { url: '/track.mp3', protocol: 'http' },
      { autoPlay: false },
    );
    useSoundStore.setState({ seek: 50, duration: 200 });
    await setSetting('core.playback.volume', 0.5);

    await user.keyboard(' ');
    await user.keyboard('{Control>}{ArrowRight}{/Control}');
    await user.keyboard('{Control>}{ArrowLeft}{/Control}');
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{ArrowLeft}');
    await user.keyboard('{Control>}{ArrowUp}{/Control}');
    await user.keyboard('{Control>}{ArrowDown}{/Control}');
    await user.keyboard('{Control>}m{/Control}');
    await user.keyboard('{Control>}[Comma]{/Control}');

    expect(useSoundStore.getState().status).toBe('stopped');
    expect(useQueueStore.getState().currentIndex).toBe(0);
    expect(useSoundStore.getState().seek).toBe(50);
    expect(getSetting('core.playback.volume')).toBe(0.5);
    expect(getSetting('core.playback.muted')).toBe(false);
    expect(useSettingsModalStore.getState().isOpen).toBe(false);
  });

  it('allows typing artists with u, w, x and spaces in the search box without triggering actions', async () => {
    initSpatialNavigation();

    const currentItem = {
      id: '1',
      track: createMockTrack('Track 1'),
      status: 'idle',
      addedAtIso: '',
    } as const;
    const nextItem = {
      id: '2',
      track: createMockTrack('Track 2'),
      status: 'idle',
      addedAtIso: '',
    } as const;
    useQueueStore.setState({
      items: [currentItem, nextItem],
      currentIndex: 0,
    });
    playbackManager.startTrack(
      currentItem,
      { url: '/track.mp3', protocol: 'http' },
      { autoPlay: false },
    );

    const searchInput = await screen.findByTestId('search-box');
    await user.click(searchInput);
    await user.type(searchInput, 'Rauw Alejandro Xavi Queen');

    for (const [key, keyCode] of [
      ['u', 85],
      ['w', 87],
      ['x', 88],
    ] as const) {
      const event = new KeyboardEvent('keydown', {
        key,
        code: `Key${key.toUpperCase()}`,
        keyCode,
        bubbles: true,
        cancelable: true,
      });
      searchInput.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }

    expect(searchInput).toHaveValue('Rauw Alejandro Xavi Queen');
    expect(useSoundStore.getState().status).toBe('stopped');
    expect(useQueueStore.getState().currentIndex).toBe(0);
  });
});
