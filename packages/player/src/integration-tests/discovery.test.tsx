import { screen, waitFor } from '@testing-library/react';

import type { Playlist, Track } from '@aurora/model';

import {
  getIntelligentAutoplayTracks,
  initDiscoveryService,
} from '../services/discoveryService';
import { providersHost } from '../services/providersHost';
import { usePlaylistStore } from '../stores/playlistStore';
import { useQueueStore } from '../stores/queueStore';
import { useSettingsStore } from '../stores/settingsStore';
import { DiscoveryProviderBuilder } from '../test/builders/DiscoveryProviderBuilder';
import { SoundWrapper } from './Sound.test-wrapper';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(9100),
}));

const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
}));

const recommendedTrack: Track = {
  title: 'Recommended Track',
  artists: [{ name: 'Recommended Artist', roles: ['primary'] }],
  source: { provider: 'test', id: 'recommended-track' },
};

const getRecommendations = vi.fn().mockResolvedValue([recommendedTrack]);

describe('Discovery', () => {
  let cleanup: () => void;

  beforeEach(() => {
    cleanup = initDiscoveryService();
    providersHost.clear();
    useQueueStore.setState({
      items: [],
      currentIndex: 0,
      isReady: true,
      isLoading: false,
    });
    useSettingsStore.setState({ values: {} });
    getRecommendations.mockClear();
    toastError.mockClear();

    providersHost.register(
      new DiscoveryProviderBuilder()
        .withGetRecommendations(getRecommendations)
        .build(),
    );
  });

  afterEach(() => {
    cleanup();
  });

  it.each<{
    enabled: boolean;
    lastTrack: boolean;
    shouldAddTrack: boolean;
  }>([
    { enabled: false, lastTrack: false, shouldAddTrack: false },
    { enabled: false, lastTrack: true, shouldAddTrack: false },
    { enabled: true, lastTrack: false, shouldAddTrack: false },
    { enabled: true, lastTrack: true, shouldAddTrack: true },
  ])(
    'enabled: $enabled, last track: $lastTrack → adds track: $shouldAddTrack',
    async ({ enabled, lastTrack, shouldAddTrack }) => {
      useSettingsStore.setState({
        values: { 'core.playback.discovery': enabled },
      });

      await SoundWrapper.mount();
      await SoundWrapper.initAndPlay(lastTrack ? 2 : 0);
      SoundWrapper.fireCanPlay();

      await waitFor(() => {
        expect(useQueueStore.getState().items).toHaveLength(
          shouldAddTrack ? 4 : 3,
        );
      });
    },
  );

  describe('when enabled', () => {
    beforeEach(() => {
      useSettingsStore.setState({
        values: { 'core.playback.discovery': true },
      });
    });

    it('does not show the discovery button and does not add tracks when no discovery provider is registered', async () => {
      providersHost.clear();

      await SoundWrapper.mount();
      await SoundWrapper.initAndPlay(2);
      SoundWrapper.fireCanPlay();

      expect(
        screen.queryByTestId('player-discovery-button'),
      ).not.toBeInTheDocument();
      expect(useQueueStore.getState().items).toHaveLength(3);
    });

    it('shows an error toast when the discovery provider returns an error', async () => {
      getRecommendations.mockRejectedValueOnce(
        new Error('Provider API is down'),
      );

      await SoundWrapper.mount();
      await SoundWrapper.initAndPlay(2);
      SoundWrapper.fireCanPlay();

      await waitFor(() => {
        expect(toastError).toHaveBeenCalled();
      });
      expect(useQueueStore.getState().items).toHaveLength(3);
    });

    it('proactively fetches when on second-to-last track in queue', async () => {
      await SoundWrapper.mount();
      await SoundWrapper.initAndPlay(1);
      SoundWrapper.fireCanPlay();

      await waitFor(() => {
        expect(useQueueStore.getState().items).toHaveLength(4);
      });
    });

    it('filters out tracks already present in the session', async () => {
      const existingItem: Track = {
        title: 'Track 1',
        artists: [{ name: 'Test Artist', roles: ['primary'] }],
        source: { provider: 'test', id: 'track 1' },
      };
      getRecommendations.mockResolvedValueOnce([existingItem]);

      await SoundWrapper.mount();
      await SoundWrapper.initAndPlay(2);
      SoundWrapper.fireCanPlay();

      await waitFor(() => {
        expect(getRecommendations).toHaveBeenCalled();
      });
      expect(
        useQueueStore
          .getState()
          .items.filter((item) => item.track.title === 'Track 1'),
      ).toHaveLength(1);
    });

    it('seamlessly transitions to new track at end of queue via finishTrack without looping', async () => {
      await SoundWrapper.mount();
      await SoundWrapper.initAndPlay(2);
      SoundWrapper.fireCanPlay();

      await waitFor(() => {
        expect(useQueueStore.getState().items).toHaveLength(4);
      });

      SoundWrapper.fireEnded();

      await waitFor(() => {
        expect(useQueueStore.getState().currentIndex).toBe(3);
      });
    });
  });

  describe('getIntelligentAutoplayTracks personalization', () => {
    it('fetches top tracks using provider-agnostic artist ID without requiring spotifyUri', async () => {
      const fetchArtistTopTracks = vi.fn().mockResolvedValue([
        {
          title: 'Provider Hit',
          artists: [{ name: 'YouTube Artist', roles: [] }],
          source: { provider: 'youtube-music', id: 'yt-track-1' },
        },
      ]);
      const mockMetaProvider = {
        id: 'test-yt-meta',
        name: 'Test YT Meta',
        kind: 'metadata' as const,
        fetchArtistTopTracks,
      };
      providersHost.register(
        mockMetaProvider as unknown as Parameters<
          typeof providersHost.register
        >[0],
      );

      const contextTrack: Track = {
        title: 'Context Song',
        artists: [
          {
            name: 'YouTube Artist',
            roles: [],
            source: { provider: 'youtube-music', id: 'yt-artist-123' },
          },
        ],
        source: { provider: 'youtube-music', id: 'yt-ctx-1' },
      };

      const tracks = await getIntelligentAutoplayTracks(
        [contextTrack],
        new Set(),
      );
      expect(fetchArtistTopTracks).toHaveBeenCalledWith('YouTube Artist');
      expect(tracks.length).toBeGreaterThan(0);
      expect(tracks[0].title).toBe('Provider Hit');
    });

    it('derives search queries from user playlists when top artists are empty and avoids pop hits', async () => {
      const searchFn = vi.fn().mockResolvedValue({
        tracks: [
          {
            title: 'Indie Result',
            artists: [{ name: 'Indie Band', roles: [] }],
            source: { provider: 'test', id: 'indie-res-1' },
          },
        ],
      });
      const mockMetaProvider = {
        id: 'test-search-meta',
        name: 'Test Search Meta',
        kind: 'metadata' as const,
        search: searchFn,
      };
      providersHost.register(
        mockMetaProvider as unknown as Parameters<
          typeof providersHost.register
        >[0],
      );

      usePlaylistStore.setState({
        playlists: new Map([
          [
            'pl-test',
            {
              id: 'pl-test',
              name: 'Synthwave Dreams',
              items: [],
            } as unknown as Playlist,
          ],
        ]),
      });

      await getIntelligentAutoplayTracks([], new Set());

      expect(searchFn).toHaveBeenCalled();
      const calledQueries = searchFn.mock.calls.map((call) => call[0].query);
      expect(calledQueries).toContain('Synthwave Dreams');
      expect(calledQueries).not.toContain('Pop Hits');
      expect(calledQueries).not.toContain('Trending Music');
    });
  });
});
