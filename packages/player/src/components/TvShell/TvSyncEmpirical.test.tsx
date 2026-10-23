import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { Track } from '@aurora/model';

import { musicVideoService } from '../../services/musicVideoService';
import { playbackManager } from '../../services/playback';
import { initSpatialNavigation } from '../../services/spatialNavigation';
import { useQueueStore } from '../../stores/queueStore';
import { useSoundStore } from '../../stores/soundStore';
import { useTvStore } from '../../stores/tvStore';
import { TvSoundProvider } from './TvSoundProvider';
import { TvVideoPlayer } from './TvVideoPlayer';

let mockVolumeSetting: number | undefined = 0.8;
let mockMutedSetting = false;

vi.mock('../../hooks/useCoreSetting', () => ({
  useCoreSetting: vi.fn((key: string) => {
    if (key === 'playback.volume') {
      return [mockVolumeSetting, vi.fn()];
    }
    if (key === 'playback.muted') {
      return [mockMutedSetting, vi.fn()];
    }
    return [undefined, vi.fn()];
  }),
}));

vi.mock('../../services/musicVideoService', () => ({
  musicVideoService: {
    findOfficialVideo: vi.fn(),
  },
}));

vi.mock('../../services/playback', () => ({
  playbackManager: {
    toggle: vi.fn(),
    finishTrack: vi.fn(),
  },
}));

vi.mock('../../services/personalizationEngine', () => ({
  personalizationEngine: {
    blacklistTrack: vi.fn().mockResolvedValue(undefined),
    blacklistArtist: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@aurora/hifi', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@aurora/hifi');
  return {
    ...actual,
    Sound: vi.fn(
      (props: { volume?: number; showVideo?: boolean; onEnd?: () => void }) => (
        <button
          type="button"
          data-testid="empirical-sound-engine"
          data-volume={props.volume}
          data-show-video={String(props.showVideo)}
          onClick={props.onEnd}
        />
      ),
    ),
  };
});

describe('TvSoundProvider ↔ TvVideoPlayer Synchronization: Empirical Challenger Suite', () => {
  beforeAll(() => {
    initSpatialNavigation();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockVolumeSetting = 0.8;
    mockMutedSetting = false;

    useTvStore.setState({
      showVideo: true,
      isVideoPlaying: false,
      targetVideoId: null,
      activeSection: 'dashboard',
    });

    useSoundStore.setState({
      status: 'playing',
      src: { url: 'https://youtube.com/watch?v=mockStream123' },
      targetSeek: null,
    });

    useQueueStore.setState({
      items: [
        {
          id: 'item-1',
          track: {
            title: 'Subterranean Homesick Alien',
            artists: [{ name: 'Radiohead', roles: [] }],
            source: { provider: 'test', id: 'sha-1' },
          },
          status: 'playing',
          addedAtIso: '',
        },
        {
          id: 'item-2',
          track: {
            title: 'Exit Music (For a Film)',
            artists: [{ name: 'Radiohead', roles: [] }],
            source: { provider: 'test', id: 'em-2' },
          },
          status: 'idle',
          addedAtIso: '',
        },
      ],
      currentIndex: 0,
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('Adversarial Challenge 1: Video Active / Loading Audio-End Suppression', () => {
    it('MUST NOT advance queue when audio ends while video is active and playing (isVideoPlaying: true, targetVideoId: string)', async () => {
      useTvStore.setState({
        showVideo: true,
        isVideoPlaying: true,
        targetVideoId: 'video-official-777',
      });

      render(
        <TvSoundProvider>
          <div data-testid="tv-content">TV Shell</div>
        </TvSoundProvider>,
      );

      const sound = screen.getByTestId('empirical-sound-engine');
      await userEvent.click(sound);

      expect(playbackManager.finishTrack).not.toHaveBeenCalled();
    });

    it('MUST NOT advance queue when audio ends while video is loading or buffering (isVideoPlaying: false, targetVideoId: string)', async () => {
      useTvStore.setState({
        showVideo: true,
        isVideoPlaying: false,
        targetVideoId: 'video-loading-888',
      });

      render(
        <TvSoundProvider>
          <div data-testid="tv-content">TV Shell</div>
        </TvSoundProvider>,
      );

      const sound = screen.getByTestId('empirical-sound-engine');
      await userEvent.click(sound);

      expect(playbackManager.finishTrack).not.toHaveBeenCalled();
    });

    it('MUST NOT advance queue even on 10 consecutive audio end events while video is active', async () => {
      useTvStore.setState({
        showVideo: true,
        isVideoPlaying: true,
        targetVideoId: 'video-stream-999',
      });

      render(
        <TvSoundProvider>
          <div data-testid="tv-content">TV Shell</div>
        </TvSoundProvider>,
      );

      const sound = screen.getByTestId('empirical-sound-engine');
      for (let i = 0; i < 10; i++) {
        await userEvent.click(sound);
      }

      expect(playbackManager.finishTrack).not.toHaveBeenCalled();
    });

    it('MUST NOT advance queue if video was paused by user mid-playback (isVideoPlaying: false, targetVideoId: string)', async () => {
      useTvStore.setState({
        showVideo: true,
        isVideoPlaying: false,
        targetVideoId: 'video-paused-111',
      });

      render(
        <TvSoundProvider>
          <div data-testid="tv-content">TV Shell</div>
        </TvSoundProvider>,
      );

      const sound = screen.getByTestId('empirical-sound-engine');
      await userEvent.click(sound);

      expect(playbackManager.finishTrack).not.toHaveBeenCalled();
    });
  });

  describe('Adversarial Challenge 2: Cover Art Fallback Mode (targetVideoId === null)', () => {
    it('MUST advance queue immediately when audio finishes in cover art fallback mode (targetVideoId === null, isVideoPlaying === false)', async () => {
      useTvStore.setState({
        showVideo: true,
        isVideoPlaying: false,
        targetVideoId: null,
      });

      render(
        <TvSoundProvider>
          <div data-testid="tv-content">TV Shell</div>
        </TvSoundProvider>,
      );

      const sound = screen.getByTestId('empirical-sound-engine');
      await userEvent.click(sound);

      expect(playbackManager.finishTrack).toHaveBeenCalledTimes(1);
    });

    it('MUST advance queue when user is browsing non-video sections (showVideo === false)', async () => {
      useTvStore.setState({
        showVideo: false,
        isVideoPlaying: false,
        targetVideoId: null,
      });

      render(
        <TvSoundProvider>
          <div data-testid="tv-content">TV Shell</div>
        </TvSoundProvider>,
      );

      const sound = screen.getByTestId('empirical-sound-engine');
      await userEvent.click(sound);

      expect(playbackManager.finishTrack).toHaveBeenCalledTimes(1);
    });

    it('MUST advance queue if findOfficialVideo rejected search and rendered fallback cover art', async () => {
      vi.mocked(musicVideoService.findOfficialVideo).mockResolvedValueOnce(
        null,
      );

      const fallbackTrack: Track = {
        title: 'Climbing Up the Walls',
        artists: [{ name: 'Radiohead', roles: [] }],
        source: { provider: 'test', id: 'cutw-1' },
      };

      render(
        <TvSoundProvider>
          <TvVideoPlayer track={fallbackTrack} />
        </TvSoundProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('tv-cover-art-view')).toBeInTheDocument();
      });

      expect(useTvStore.getState().targetVideoId).toBe(null);
      expect(useTvStore.getState().isVideoPlaying).toBe(false);

      const sound = screen.getByTestId('empirical-sound-engine');
      await userEvent.click(sound);

      expect(playbackManager.finishTrack).toHaveBeenCalledTimes(1);
    });

    it('MUST advance queue if findOfficialVideo encountered a network error and fell back to cover art', async () => {
      vi.mocked(musicVideoService.findOfficialVideo).mockRejectedValueOnce(
        new Error('Network offline'),
      );

      const errorTrack: Track = {
        title: 'Electioneering',
        artists: [{ name: 'Radiohead', roles: [] }],
        source: { provider: 'test', id: 'elect-1' },
      };

      render(
        <TvSoundProvider>
          <TvVideoPlayer track={errorTrack} />
        </TvSoundProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('tv-cover-art-view')).toBeInTheDocument();
      });

      expect(useTvStore.getState().targetVideoId).toBe(null);
      expect(useTvStore.getState().isVideoPlaying).toBe(false);

      const sound = screen.getByTestId('empirical-sound-engine');
      await userEvent.click(sound);

      expect(playbackManager.finishTrack).toHaveBeenCalledTimes(1);
    });
  });

  describe('Adversarial Challenge 3: YouTube Iframe Lifecycle, Error Fallback & Deduplication', () => {
    it('MUST transition to cover art and unmute audio if YouTube iframe triggers onError', async () => {
      vi.mocked(musicVideoService.findOfficialVideo).mockResolvedValueOnce({
        videoId: 'errVid404',
        title: 'Radiohead - Karma Police (Official Video)',
        channelTitle: 'Radiohead',
        score: 120,
      });

      const track: Track = {
        title: 'Karma Police',
        artists: [{ name: 'Radiohead', roles: [] }],
        source: { provider: 'test', id: 'kp-err' },
      };

      render(
        <TvSoundProvider>
          <TvVideoPlayer track={track} />
        </TvSoundProvider>,
      );

      await waitFor(() => {
        expect(
          screen.getByTitle('Radiohead - Karma Police (Official Video)'),
        ).toBeInTheDocument();
      });

      const iframe = screen.getByTitle(
        'Radiohead - Karma Police (Official Video)',
      ) as HTMLIFrameElement;

      expect(useTvStore.getState().targetVideoId).toBe('errVid404');
      expect(useTvStore.getState().isVideoPlaying).toBe(true);

      const errorEvent = new MessageEvent('message', {
        data: JSON.stringify({ event: 'onError', info: 150 }),
        source: iframe.contentWindow,
      });
      window.dispatchEvent(errorEvent);

      await waitFor(() => {
        expect(screen.getByTestId('tv-cover-art-view')).toBeInTheDocument();
      });

      expect(useTvStore.getState().targetVideoId).toBe(null);
      expect(useTvStore.getState().isVideoPlaying).toBe(false);

      const sound = screen.getByTestId('empirical-sound-engine');
      await userEvent.click(sound);

      expect(playbackManager.finishTrack).toHaveBeenCalledTimes(1);
    });

    it('deduplicates multiple YouTube onStateChange info: 0 events, calling finishTrack exactly once', async () => {
      vi.mocked(musicVideoService.findOfficialVideo).mockResolvedValueOnce({
        videoId: 'vidDedup1',
        title: 'Radiohead - No Surprises (Official Video)',
        channelTitle: 'Radiohead',
        score: 130,
      });

      const track: Track = {
        title: 'No Surprises',
        artists: [{ name: 'Radiohead', roles: [] }],
        source: { provider: 'test', id: 'ns-dedup' },
      };

      render(
        <TvSoundProvider>
          <TvVideoPlayer track={track} />
        </TvSoundProvider>,
      );

      await waitFor(() => {
        expect(
          screen.getByTitle('Radiohead - No Surprises (Official Video)'),
        ).toBeInTheDocument();
      });

      const iframe = screen.getByTitle(
        'Radiohead - No Surprises (Official Video)',
      ) as HTMLIFrameElement;

      const endEvent = new MessageEvent('message', {
        data: JSON.stringify({ event: 'onStateChange', info: 0 }),
        source: iframe.contentWindow,
      });

      for (let i = 0; i < 5; i++) {
        window.dispatchEvent(endEvent);
      }

      await waitFor(() => {
        expect(playbackManager.finishTrack).toHaveBeenCalledTimes(1);
      });

      expect(playbackManager.finishTrack).not.toHaveBeenCalledTimes(2);
    });

    it('ignores postMessages with incorrect event or payload format without throwing errors', async () => {
      vi.mocked(musicVideoService.findOfficialVideo).mockResolvedValueOnce({
        videoId: 'vidIgnore1',
        title: 'Radiohead - Lucky (Official Video)',
        channelTitle: 'Radiohead',
        score: 110,
      });

      const track: Track = {
        title: 'Lucky',
        artists: [{ name: 'Radiohead', roles: [] }],
        source: { provider: 'test', id: 'lucky-1' },
      };

      render(
        <TvSoundProvider>
          <TvVideoPlayer track={track} />
        </TvSoundProvider>,
      );

      await waitFor(() => {
        expect(
          screen.getByTitle('Radiohead - Lucky (Official Video)'),
        ).toBeInTheDocument();
      });

      const iframe = screen.getByTitle(
        'Radiohead - Lucky (Official Video)',
      ) as HTMLIFrameElement;

      const garbageEvents = [
        new MessageEvent('message', {
          data: 'not-json',
          source: iframe.contentWindow,
        }),
        new MessageEvent('message', {
          data: null,
          source: iframe.contentWindow,
        }),
        new MessageEvent('message', {
          data: {},
          source: iframe.contentWindow,
        }),
        new MessageEvent('message', {
          data: JSON.stringify({ event: 'unknown' }),
          source: iframe.contentWindow,
        }),
        new MessageEvent('message', {
          data: JSON.stringify({ event: 'onStateChange', info: 99 }),
          source: iframe.contentWindow,
        }),
      ];

      for (const ev of garbageEvents) {
        window.dispatchEvent(ev);
      }

      expect(playbackManager.finishTrack).not.toHaveBeenCalled();
      expect(useTvStore.getState().targetVideoId).toBe('vidIgnore1');
    });

    it('resets hasEndedRef when switching to a new track so the subsequent video can also finish cleanly', async () => {
      const track1: Track = {
        title: 'Airbag',
        artists: [{ name: 'Radiohead', roles: [] }],
        source: { provider: 'test', id: 'ab-1' },
      };
      const track2: Track = {
        title: 'The Tourist',
        artists: [{ name: 'Radiohead', roles: [] }],
        source: { provider: 'test', id: 'tt-2' },
      };

      vi.mocked(musicVideoService.findOfficialVideo)
        .mockResolvedValueOnce({
          videoId: 'vidAirbag',
          title: 'Radiohead - Airbag (Official Video)',
          channelTitle: 'Radiohead',
          score: 120,
        })
        .mockResolvedValueOnce({
          videoId: 'vidTourist',
          title: 'Radiohead - The Tourist (Official Video)',
          channelTitle: 'Radiohead',
          score: 120,
        });

      const { rerender } = render(
        <TvSoundProvider>
          <TvVideoPlayer track={track1} />
        </TvSoundProvider>,
      );

      await waitFor(() => {
        expect(
          screen.getByTitle('Radiohead - Airbag (Official Video)'),
        ).toBeInTheDocument();
      });

      const iframe1 = screen.getByTitle(
        'Radiohead - Airbag (Official Video)',
      ) as HTMLIFrameElement;

      const endEvent1 = new MessageEvent('message', {
        data: JSON.stringify({ event: 'onStateChange', info: 0 }),
        source: iframe1.contentWindow,
      });
      window.dispatchEvent(endEvent1);

      await waitFor(() => {
        expect(playbackManager.finishTrack).toHaveBeenCalledTimes(1);
      });

      rerender(
        <TvSoundProvider>
          <TvVideoPlayer track={track2} />
        </TvSoundProvider>,
      );

      await waitFor(() => {
        expect(
          screen.getByTitle('Radiohead - The Tourist (Official Video)'),
        ).toBeInTheDocument();
      });

      const iframe2 = screen.getByTitle(
        'Radiohead - The Tourist (Official Video)',
      ) as HTMLIFrameElement;

      const endEvent2 = new MessageEvent('message', {
        data: JSON.stringify({ event: 'onStateChange', info: 0 }),
        source: iframe2.contentWindow,
      });
      window.dispatchEvent(endEvent2);

      await waitFor(() => {
        expect(playbackManager.finishTrack).toHaveBeenCalledTimes(2);
      });
    });
  });
});
