import type { AudioSource } from '@aurora/hifi';
import type { QueueItem } from '@aurora/model';
import { useQueueStore } from '../../stores/queueStore';
import { getSetting } from '../../stores/settingsStore';
import { useSoundStore } from '../../stores/soundStore';
import { ensureUpcomingTracks } from '../discoveryService';
import { eventBus } from '../eventBus';

const DOUBLE_PRESS_WINDOW_MS = 2500;

export type StartTrackOptions = {
  autoPlay: boolean;
};

export class PlaybackManager {
  private mountedItemId: string | null = null;
  private playRequested = false;
  private lastPreviousCallTime = 0;

  previous = (): void => {
    const now = Date.now();
    if (now - this.lastPreviousCallTime < DOUBLE_PRESS_WINDOW_MS) {
      this.lastPreviousCallTime = now;
      useQueueStore.getState().goToPrevious();
      return;
    }

    this.lastPreviousCallTime = now;
    useSoundStore.getState().seekTo(0);
  };

  play = (): void => {
    const { status } = useSoundStore.getState();
    if (status === 'playing') {
      return;
    }
    if (status === 'paused') {
      useSoundStore.getState().play();
      return;
    }

    const item = useQueueStore.getState().getCurrentItem();
    if (!item) {
      return;
    }
    if (this.mountedItemId !== item.id) {
      this.playRequested = true;
      return;
    }

    useSoundStore.getState().play();
    eventBus.emit('trackStarted', item.track);
  };

  pause = (): void => {
    this.playRequested = false;
    useSoundStore.getState().pause();
  };

  toggle = (): void => {
    if (useSoundStore.getState().status === 'playing') {
      this.pause();
      return;
    }
    this.play();
  };

  startTrack = (
    item: QueueItem,
    source: AudioSource,
    options: StartTrackOptions,
  ): void => {
    useSoundStore.getState().setSrc(source);
    this.mountedItemId = item.id;

    const shouldPlay = options.autoPlay || this.playRequested;
    this.playRequested = false;

    if (!shouldPlay) {
      return;
    }

    useSoundStore.getState().play();

    const isResumingMidTrack = source.startPositionSeconds !== undefined;
    if (isResumingMidTrack) {
      return;
    }

    eventBus.emit('trackStarted', item.track);
  };

  finishTrack = async (): Promise<void> => {
    const item = useQueueStore.getState().getCurrentItem();
    if (!item) {
      return;
    }

    eventBus.emit('trackFinished', item.track);

    const repeatMode = (getSetting('core.playback.repeat') as string) ?? 'off';
    if (repeatMode === 'one') {
      useSoundStore.getState().seekTo(0);
      eventBus.emit('trackStarted', item.track);
      return;
    }

    const { items, currentIndex } = useQueueStore.getState();
    const isLastTrack = currentIndex >= items.length - 1;
    const isDiscoveryEnabled =
      (getSetting('core.playback.discovery') as boolean) ?? true;

    if (isLastTrack && isDiscoveryEnabled) {
      await ensureUpcomingTracks(true);
    }

    useQueueStore.getState().goToNext();
  };
}

export const playbackManager = new PlaybackManager();
