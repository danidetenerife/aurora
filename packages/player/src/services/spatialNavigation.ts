import { init, setKeyMap } from '@noriginmedia/norigin-spatial-navigation';

import { useQueueStore } from '../stores/queueStore';
import { playbackManager } from './playback';

let initialized = false;

export const initSpatialNavigation = (): void => {
  if (initialized) {
    return;
  }

  init({
    debug: false,
    visualDebug: false,
    shouldFocusDOMNode: true,
    shouldUseNativeEvents: true,
  });

  setKeyMap({
    left: [37, 21, 'ArrowLeft', 'Left'],
    up: [38, 19, 'ArrowUp', 'Up'],
    right: [39, 22, 'ArrowRight', 'Right'],
    down: [40, 20, 'ArrowDown', 'Down'],
    enter: [13, 23, 'Enter', 'Select', 'Ok', ' '],
  });

  if (typeof window !== 'undefined') {
    window.addEventListener('tv:playpause', () => {
      playbackManager.toggle();
    });

    window.addEventListener('tv:next', () => {
      useQueueStore.getState().goToNext();
    });

    window.addEventListener('tv:prev', () => {
      useQueueStore.getState().goToPrevious();
    });

    window.addEventListener('keydown', (event: KeyboardEvent) => {
      if (
        event.key === 'MediaPlayPause' ||
        event.code === 'MediaPlayPause' ||
        event.keyCode === 85
      ) {
        event.preventDefault();
        playbackManager.toggle();
      } else if (
        event.key === 'MediaPlay' ||
        event.code === 'MediaPlay' ||
        event.keyCode === 126
      ) {
        event.preventDefault();
        playbackManager.play();
      } else if (
        event.key === 'MediaPause' ||
        event.code === 'MediaPause' ||
        event.keyCode === 127
      ) {
        event.preventDefault();
        playbackManager.pause();
      } else if (
        event.key === 'MediaTrackNext' ||
        event.code === 'MediaTrackNext' ||
        event.keyCode === 87
      ) {
        event.preventDefault();
        useQueueStore.getState().goToNext();
      } else if (
        event.key === 'MediaTrackPrevious' ||
        event.code === 'MediaTrackPrevious' ||
        event.keyCode === 88
      ) {
        event.preventDefault();
        useQueueStore.getState().goToPrevious();
      }
    });
  }

  initialized = true;
};
