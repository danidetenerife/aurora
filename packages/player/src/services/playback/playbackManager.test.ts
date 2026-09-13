import { useQueueStore } from '../../stores/queueStore';
import { useSoundStore } from '../../stores/soundStore';
import { createQueueItem } from '../../test/fixtures/queue';
import { PlaybackManager } from './playbackManager';

const INITIAL_SEEK_SECONDS = 45;

describe('PlaybackManager previous', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useSoundStore.setState({
      status: 'playing',
      seek: INITIAL_SEEK_SECONDS,
      duration: 180,
    });

    const firstTrack = createQueueItem('Song 1');
    const secondTrack = createQueueItem('Song 2');
    useQueueStore.setState({
      items: [firstTrack, secondTrack],
      currentIndex: 1,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('restarts current song on first press', () => {
    const manager = new PlaybackManager();
    const seekSpy = vi.spyOn(useSoundStore.getState(), 'seekTo');

    manager.previous();

    expect(seekSpy).toHaveBeenCalledWith(0);
    expect(useQueueStore.getState().currentIndex).toBe(1);
  });

  it('goes to previous track when pressed twice in rapid succession', () => {
    const manager = new PlaybackManager();
    const seekSpy = vi.spyOn(useSoundStore.getState(), 'seekTo');

    manager.previous();
    expect(seekSpy).toHaveBeenCalledWith(0);
    expect(useQueueStore.getState().currentIndex).toBe(1);

    vi.advanceTimersByTime(500);

    manager.previous();
    expect(useQueueStore.getState().currentIndex).toBe(0);
  });

  it('restarts track again if second press happens after timeout', () => {
    const manager = new PlaybackManager();
    const seekSpy = vi.spyOn(useSoundStore.getState(), 'seekTo');

    manager.previous();
    expect(seekSpy).toHaveBeenCalledWith(0);
    expect(useQueueStore.getState().currentIndex).toBe(1);

    vi.advanceTimersByTime(3000);

    manager.previous();
    expect(seekSpy).toHaveBeenCalledTimes(2);
    expect(useQueueStore.getState().currentIndex).toBe(1);
  });
});
