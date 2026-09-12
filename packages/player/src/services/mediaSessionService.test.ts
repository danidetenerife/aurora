import { vi } from 'vitest';

import { useFavoritesStore } from '../stores/favoritesStore';
import { usePlaylistStore } from '../stores/playlistStore';
import { useQueueStore } from '../stores/queueStore';
import { createQueueItem } from '../test/fixtures/queue';
import { initMediaSessionService } from './mediaSessionService';
import { NativeMediaSessionPlugin } from './nativeMediaSession';
import { playbackManager } from './playback';
import * as UniversalStore from './universalStore';

let actionCallback: ((data: { action: string; seekPositionMs?: number }) => void) | null = null;

vi.mock('./nativeMediaSession', () => ({
  NativeMediaSessionPlugin: {
    updateMetadata: vi.fn().mockResolvedValue(undefined),
    updatePlaybackState: vi.fn().mockResolvedValue(undefined),
    updatePosition: vi.fn().mockResolvedValue(undefined),
    updateAutoCatalog: vi.fn().mockResolvedValue(undefined),
    addListener: vi.fn().mockImplementation((_event: string, handler: (data: { action: string }) => void) => {
      actionCallback = handler;
      return Promise.resolve({ remove: vi.fn() });
    }),
  },
}));

describe('mediaSessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actionCallback = null;
    useQueueStore.setState({ items: [], currentIndex: 0 });
    useFavoritesStore.setState({
      tracks: [],
      albums: [],
      artists: [],
      playlists: [],
    });
    usePlaylistStore.setState({ index: [], playlists: new Map() });
  });

  it('initializes without errors when capacitor environment is active', () => {
    vi.spyOn(UniversalStore, 'isCapacitorEnvironment').mockReturnValue(true);

    initMediaSessionService();

    expect(NativeMediaSessionPlugin.updateAutoCatalog).toHaveBeenCalled();
    const mockCalls = vi.mocked(NativeMediaSessionPlugin.updateAutoCatalog).mock
      .calls;
    const passedArgument = mockCalls[0]?.[0];
    const parsed = JSON.parse(passedArgument?.json ?? '{}');

    expect(parsed).toHaveProperty('queue');
    expect(parsed).toHaveProperty('favorites');
    expect(parsed).toHaveProperty('playlists');
    expect(parsed).toHaveProperty('popularPlaylists');
    expect(parsed).toHaveProperty('discover');
  });

  it('syncs updated queue into auto catalog payload', () => {
    vi.spyOn(UniversalStore, 'isCapacitorEnvironment').mockReturnValue(true);

    initMediaSessionService();

    const sampleItem = createQueueItem('Cancion Carretera');
    useQueueStore.setState({ items: [sampleItem], currentIndex: 0 });

    const mockCalls = vi.mocked(NativeMediaSessionPlugin.updateAutoCatalog).mock
      .calls;
    const lastCall = mockCalls[mockCalls.length - 1]?.[0];
    const catalog = JSON.parse(lastCall?.json ?? '{}');

    expect(catalog.queue).toHaveLength(1);
    expect(catalog.queue[0].title).toBe('Cancion Carretera');
  });

  it('handles playid mediaAction by switching index and triggering playback', () => {
    vi.spyOn(UniversalStore, 'isCapacitorEnvironment').mockReturnValue(true);
    const playSpy = vi.spyOn(playbackManager, 'play').mockImplementation(() => {});

    initMediaSessionService();

    const itemA = createQueueItem('Pista 1');
    const itemB = createQueueItem('Pista 2');
    useQueueStore.setState({ items: [itemA, itemB], currentIndex: 0 });

    expect(actionCallback).toBeDefined();
    actionCallback?.({ action: `playid:${itemB.id}` });

    expect(useQueueStore.getState().currentIndex).toBe(1);
    expect(playSpy).toHaveBeenCalled();
  });

  it('handles personal playlist mediaAction by populating queue and playing', () => {
    vi.spyOn(UniversalStore, 'isCapacitorEnvironment').mockReturnValue(true);
    const playSpy = vi.spyOn(playbackManager, 'play').mockImplementation(() => {});

    initMediaSessionService();

    const trackA = createQueueItem('Track A').track;
    const trackB = createQueueItem('Track B').track;

    usePlaylistStore.setState({
      playlists: new Map([
        [
          'playlist-viaje',
          {
            id: 'playlist-viaje',
            name: 'Viaje en Coche',
            createdAtIso: new Date().toISOString(),
            lastModifiedIso: new Date().toISOString(),
            isReadOnly: false,
            items: [
              { id: 'item-1', track: trackA, addedAtIso: new Date().toISOString() },
              { id: 'item-2', track: trackB, addedAtIso: new Date().toISOString() },
            ],
          },
        ],
      ]),
    });

    expect(actionCallback).toBeDefined();
    actionCallback?.({ action: 'playlist_play:playlist-viaje' });

    expect(useQueueStore.getState().items).toHaveLength(2);
    expect(useQueueStore.getState().items[0].track.title).toBe('Track A');
    expect(playSpy).toHaveBeenCalled();
  });
});
