import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
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
import { personalizationEngine } from '../../services/personalizationEngine';
import { playbackManager } from '../../services/playback';
import { initSpatialNavigation } from '../../services/spatialNavigation';
import { useQueueStore } from '../../stores/queueStore';
import { useSoundStore } from '../../stores/soundStore';
import { useTvStore } from '../../stores/tvStore';
import { extractYouTubeId, TvSoundProvider } from './TvSoundProvider';
import { TvVideoPlayer } from './TvVideoPlayer';

let currentVolumeSetting: number | undefined = 0.8;
let currentMutedSetting = false;

vi.mock('../../hooks/useCoreSetting', () => ({
  useCoreSetting: vi.fn((key: string) => {
    if (key === 'playback.volume') {
      return [currentVolumeSetting, vi.fn()];
    }
    if (key === 'playback.muted') {
      return [currentMutedSetting, vi.fn()];
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
          data-testid="mock-sound-engine"
          data-volume={props.volume}
          data-show-video={String(props.showVideo)}
          onClick={props.onEnd}
        />
      ),
    ),
  };
});

describe('TvVideoFallbackStress & Audio Coordination', () => {
  beforeAll(() => {
    initSpatialNavigation();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    currentVolumeSetting = 0.8;
    currentMutedSetting = false;

    useTvStore.setState({
      showVideo: true,
      isVideoPlaying: false,
      activeSection: 'dashboard',
    });

    useSoundStore.setState({
      status: 'playing',
      src: { url: 'https://youtube.com/watch?v=rawAudioStream123' },
      targetSeek: null,
    });

    useQueueStore.setState({
      items: [
        {
          id: 'item-1',
          track: {
            title: 'Paranoid Android',
            artists: [{ name: 'Radiohead', roles: [] }],
            source: { provider: 'test', id: 'pa-1' },
          },
          status: 'playing',
          addedAtIso: '',
        },
        {
          id: 'item-2',
          track: {
            title: 'Karma Police',
            artists: [{ name: 'Radiohead', roles: [] }],
            source: { provider: 'test', id: 'kp-2' },
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

  describe('Adversarial Challenge 1: Noise Rejection, Timeouts & Cover Art Fallback', () => {
    it('cleanly renders TvCoverArtView and does NOT inject video iframe when findOfficialVideo rejects noise (returns null)', async () => {
      vi.mocked(musicVideoService.findOfficialVideo).mockResolvedValueOnce(
        null,
      );

      const noiseTrack: Track = {
        title: 'Song With Noise Candidates',
        artists: [{ name: 'Test Artist', roles: [] }],
        source: { provider: 'test', id: 'noise-1' },
        artwork: {
          items: [
            {
              url: 'https://images.example.com/art.jpg',
              purpose: 'thumbnail',
            },
          ],
        },
      };

      const { container } = render(<TvVideoPlayer track={noiseTrack} />);

      await waitFor(() => {
        expect(screen.getByTestId('tv-cover-art-view')).toBeInTheDocument();
      });

      expect(container.querySelector('iframe')).not.toBeInTheDocument();
      expect(screen.queryByTitle(/Videoclip/i)).not.toBeInTheDocument();
      expect(
        screen.getByText('Sin videoclip disponible · Mostrando carátula'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Song With Noise Candidates'),
      ).toBeInTheDocument();
      expect(screen.getByText('Test Artist')).toBeInTheDocument();
      expect(useTvStore.getState().isVideoPlaying).toBe(false);
    });

    it('recovers gracefully to TvCoverArtView without unhandled exceptions when findOfficialVideo rejects or times out', async () => {
      vi.mocked(musicVideoService.findOfficialVideo).mockRejectedValueOnce(
        new Error('ETIMEDOUT: YouTube search timed out after 5000ms'),
      );

      const timeoutTrack: Track = {
        title: 'Timeout Track',
        artists: [{ name: 'Slow Network Band', roles: [] }],
        source: { provider: 'test', id: 'timeout-1' },
      };

      const { container } = render(<TvVideoPlayer track={timeoutTrack} />);

      await waitFor(() => {
        expect(screen.getByTestId('tv-cover-art-view')).toBeInTheDocument();
      });

      expect(container.querySelector('iframe')).not.toBeInTheDocument();
      expect(screen.getByText('Timeout Track')).toBeInTheDocument();
      expect(screen.getByText('Slow Network Band')).toBeInTheDocument();
      expect(useTvStore.getState().isVideoPlaying).toBe(false);
    });

    it('handles degraded or missing track metadata without crashing or throwing TypeError', async () => {
      vi.mocked(musicVideoService.findOfficialVideo).mockResolvedValueOnce(
        null,
      );

      const malformedTrack: Track = {
        title: '',
        artists: [],
        source: { provider: 'test', id: 'empty-1' },
      };

      const { container } = render(<TvVideoPlayer track={malformedTrack} />);

      await waitFor(() => {
        expect(screen.getByTestId('tv-cover-art-view')).toBeInTheDocument();
      });

      expect(container.querySelector('iframe')).not.toBeInTheDocument();
      expect(screen.getByText('Sin reproducción')).toBeInTheDocument();
      expect(useTvStore.getState().isVideoPlaying).toBe(false);
    });

    it('allows full user interactivity (previous, play/pause, next, dislike, close) from fallback view', async () => {
      vi.mocked(musicVideoService.findOfficialVideo).mockResolvedValue(null);

      const interactiveTrack: Track = {
        title: 'Interactive Track',
        artists: [{ name: 'Radiohead', roles: [] }],
        source: { provider: 'test', id: 'int-1' },
      };

      render(<TvVideoPlayer track={interactiveTrack} />);

      await waitFor(() => {
        expect(screen.getByTestId('tv-cover-art-view')).toBeInTheDocument();
      });

      const playPauseBtn = screen.getByRole('button', { name: 'Pausar' });
      await userEvent.click(playPauseBtn);
      expect(playbackManager.toggle).toHaveBeenCalledTimes(1);

      const nextBtn = screen.getByRole('button', { name: 'Siguiente canción' });
      await userEvent.click(nextBtn);
      expect(useQueueStore.getState().currentIndex).toBe(1);

      const prevBtn = screen.getByRole('button', { name: 'Anterior canción' });
      await userEvent.click(prevBtn);
      expect(useQueueStore.getState().currentIndex).toBe(0);

      const dislikeBtn = screen.getByRole('button', { name: 'No me gusta' });
      await userEvent.click(dislikeBtn);
      expect(personalizationEngine.blacklistTrack).toHaveBeenCalledWith(
        'int-1',
      );

      const closeBtn = screen.getByRole('button', {
        name: 'Cerrar vista de vídeo',
      });
      await userEvent.click(closeBtn);
      expect(useTvStore.getState().showVideo).toBe(false);
      expect(useTvStore.getState().isVideoPlaying).toBe(false);
    });
  });

  describe('Adversarial Challenge 2: Rapid Sequential Track Switches & Concurrency Stress', () => {
    it('ensures rapid 5-track switch in 200ms ending on a noise track resolves to cover art and NEVER gets stuck in isVideoPlaying: true', async () => {
      const track1: Track = {
        title: 'T1 Slow Video',
        artists: [{ name: 'Band 1', roles: [] }],
        source: { provider: 'test', id: 't1' },
      };
      const track2: Track = {
        title: 'T2 Noise Track',
        artists: [{ name: 'Band 2', roles: [] }],
        source: { provider: 'test', id: 't2' },
      };
      const track3: Track = {
        title: 'T3 Fast Video',
        artists: [{ name: 'Band 3', roles: [] }],
        source: { provider: 'test', id: 't3' },
      };
      const track4: Track = {
        title: 'T4 Errored Track',
        artists: [{ name: 'Band 4', roles: [] }],
        source: { provider: 'test', id: 't4' },
      };
      const track5: Track = {
        title: 'T5 Final Noise Track',
        artists: [{ name: 'Band 5', roles: [] }],
        source: { provider: 'test', id: 't5' },
      };

      vi.mocked(musicVideoService.findOfficialVideo).mockImplementation(
        async (track?: Track) => {
          if (track?.source?.id === 't1') {
            await new Promise((resolve) => setTimeout(resolve, 150));
            return {
              videoId: 'v1-delayed',
              title: 'Band 1 - T1 (Official)',
              channelTitle: 'Band 1',
              score: 95,
            };
          }
          if (track?.source?.id === 't2') {
            await new Promise((resolve) => setTimeout(resolve, 40));
            return null;
          }
          if (track?.source?.id === 't3') {
            await new Promise((resolve) => setTimeout(resolve, 120));
            return {
              videoId: 'v3-fast',
              title: 'Band 3 - T3 (Official)',
              channelTitle: 'Band 3',
              score: 90,
            };
          }
          if (track?.source?.id === 't4') {
            await new Promise((resolve) => setTimeout(resolve, 60));
            throw new Error('Search failed');
          }
          if (track?.source?.id === 't5') {
            await new Promise((resolve) => setTimeout(resolve, 30));
            return null;
          }
          return null;
        },
      );

      const { rerender, container } = render(<TvVideoPlayer track={track1} />);

      await new Promise((resolve) => setTimeout(resolve, 20));
      rerender(<TvVideoPlayer track={track2} />);

      await new Promise((resolve) => setTimeout(resolve, 20));
      rerender(<TvVideoPlayer track={track3} />);

      await new Promise((resolve) => setTimeout(resolve, 20));
      rerender(<TvVideoPlayer track={track4} />);

      await new Promise((resolve) => setTimeout(resolve, 20));
      rerender(<TvVideoPlayer track={track5} />);

      await waitFor(
        () => {
          expect(screen.getByTestId('tv-cover-art-view')).toBeInTheDocument();
          expect(screen.getByText('T5 Final Noise Track')).toBeInTheDocument();
        },
        { timeout: 1000 },
      );

      await new Promise((resolve) => setTimeout(resolve, 250));

      expect(container.querySelector('iframe')).not.toBeInTheDocument();
      expect(screen.queryByTitle(/v1-delayed/i)).not.toBeInTheDocument();
      expect(screen.queryByTitle(/v3-fast/i)).not.toBeInTheDocument();
      expect(useTvStore.getState().isVideoPlaying).toBe(false);
      expect(screen.getByText('T5 Final Noise Track')).toBeInTheDocument();
      expect(screen.getByText('Band 5')).toBeInTheDocument();
    });

    it('ensures rapid sequential switches ending on a valid video track resolve correctly to video iframe with isVideoPlaying: true', async () => {
      const trackA: Track = {
        title: 'Track A (Noise)',
        artists: [{ name: 'Band A', roles: [] }],
        source: { provider: 'test', id: 'ta' },
      };
      const trackB: Track = {
        title: 'Track B (Error)',
        artists: [{ name: 'Band B', roles: [] }],
        source: { provider: 'test', id: 'tb' },
      };
      const trackC: Track = {
        title: 'Track C (Valid Official)',
        artists: [{ name: 'Band C', roles: [] }],
        source: { provider: 'test', id: 'tc' },
      };

      vi.mocked(musicVideoService.findOfficialVideo).mockImplementation(
        async (track?: Track) => {
          if (track?.source?.id === 'ta') {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return null;
          }
          if (track?.source?.id === 'tb') {
            await new Promise((resolve) => setTimeout(resolve, 80));
            throw new Error('Network error');
          }
          if (track?.source?.id === 'tc') {
            await new Promise((resolve) => setTimeout(resolve, 50));
            return {
              videoId: 'validVidC',
              title: 'Band C - Track C (Official Video)',
              channelTitle: 'Band C',
              score: 110,
            };
          }
          return null;
        },
      );

      const { rerender } = render(<TvVideoPlayer track={trackA} />);

      await new Promise((resolve) => setTimeout(resolve, 15));
      rerender(<TvVideoPlayer track={trackB} />);

      await new Promise((resolve) => setTimeout(resolve, 15));
      rerender(<TvVideoPlayer track={trackC} />);

      await waitFor(
        () => {
          expect(
            screen.getByTitle('Band C - Track C (Official Video)'),
          ).toBeInTheDocument();
        },
        { timeout: 1000 },
      );

      await new Promise((resolve) => setTimeout(resolve, 200));

      const iframe = screen.getByTitle('Band C - Track C (Official Video)');
      expect(iframe).toHaveAttribute(
        'src',
        expect.stringContaining('validVidC'),
      );
      expect(useTvStore.getState().isVideoPlaying).toBe(true);
      expect(screen.getByText('🎬 Videoclip Oficial')).toBeInTheDocument();
    });

    it('safely cancels in-flight search when component unmounts mid-flight without throwing or leaking isVideoPlaying', async () => {
      const slowTrack: Track = {
        title: 'Slow Loading Video',
        artists: [{ name: 'Distant Band', roles: [] }],
        source: { provider: 'test', id: 'slow-1' },
      };

      vi.mocked(musicVideoService.findOfficialVideo).mockImplementation(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 150));
          return {
            videoId: 'slowVid1',
            title: 'Distant Band - Slow (Official)',
            channelTitle: 'Distant Band',
            score: 100,
          };
        },
      );

      const { unmount } = render(<TvVideoPlayer track={slowTrack} />);

      expect(useTvStore.getState().isVideoPlaying).toBe(false);

      await new Promise((resolve) => setTimeout(resolve, 30));
      unmount();

      expect(useTvStore.getState().isVideoPlaying).toBe(false);

      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(useTvStore.getState().isVideoPlaying).toBe(false);
    });
  });

  describe('Adversarial Challenge 3: TvSoundProvider Volume Synchronization & Mute Coordination', () => {
    it('mutes audio stream to volume 0 when isVideoPlaying is true, regardless of user volume setting', () => {
      currentVolumeSetting = 0.9;
      currentMutedSetting = false;
      useTvStore.setState({ isVideoPlaying: true });

      render(
        <TvSoundProvider>
          <div data-testid="tv-child">TV Content</div>
        </TvSoundProvider>,
      );

      const sound = screen.getByTestId('mock-sound-engine');
      expect(sound).toHaveAttribute('data-volume', '0');
      expect(sound).toHaveAttribute('data-show-video', 'false');
    });

    it('unmutes audio stream to exact volume percentage when isVideoPlaying is false', () => {
      currentVolumeSetting = 0.75;
      currentMutedSetting = false;
      useTvStore.setState({ isVideoPlaying: false });

      render(
        <TvSoundProvider>
          <div data-testid="tv-child">TV Content</div>
        </TvSoundProvider>,
      );

      const sound = screen.getByTestId('mock-sound-engine');
      expect(sound).toHaveAttribute('data-volume', '75');
      expect(sound).toHaveAttribute('data-show-video', 'false');
    });

    it('keeps audio stream muted when playback.muted is true even if isVideoPlaying is false', () => {
      currentVolumeSetting = 0.85;
      currentMutedSetting = true;
      useTvStore.setState({ isVideoPlaying: false });

      render(
        <TvSoundProvider>
          <div data-testid="tv-child">TV Content</div>
        </TvSoundProvider>,
      );

      const sound = screen.getByTestId('mock-sound-engine');
      expect(sound).toHaveAttribute('data-volume', '0');
    });

    it('handles edge case volume01 values (undefined fallback to 100, zero, bounds) cleanly', () => {
      currentVolumeSetting = undefined;
      currentMutedSetting = false;
      useTvStore.setState({ isVideoPlaying: false });

      const { rerender } = render(<TvSoundProvider />);
      let sound = screen.getByTestId('mock-sound-engine');
      expect(sound).toHaveAttribute('data-volume', '100');

      currentVolumeSetting = 0;
      rerender(<TvSoundProvider />);
      sound = screen.getByTestId('mock-sound-engine');
      expect(sound).toHaveAttribute('data-volume', '0');

      currentVolumeSetting = 1.0;
      rerender(<TvSoundProvider />);
      sound = screen.getByTestId('mock-sound-engine');
      expect(sound).toHaveAttribute('data-volume', '100');
    });

    it('stays strictly in sync during rapid isVideoPlaying toggles', async () => {
      currentVolumeSetting = 0.8;
      currentMutedSetting = false;
      useTvStore.setState({ isVideoPlaying: false });

      const { rerender } = render(<TvSoundProvider />);
      let sound = screen.getByTestId('mock-sound-engine');
      expect(sound).toHaveAttribute('data-volume', '80');

      act(() => {
        useTvStore.getState().setIsVideoPlaying(true);
      });
      rerender(<TvSoundProvider />);
      sound = screen.getByTestId('mock-sound-engine');
      expect(sound).toHaveAttribute('data-volume', '0');

      act(() => {
        useTvStore.getState().setIsVideoPlaying(false);
      });
      rerender(<TvSoundProvider />);
      sound = screen.getByTestId('mock-sound-engine');
      expect(sound).toHaveAttribute('data-volume', '80');

      act(() => {
        useTvStore.getState().setIsVideoPlaying(true);
      });
      rerender(<TvSoundProvider />);
      sound = screen.getByTestId('mock-sound-engine');
      expect(sound).toHaveAttribute('data-volume', '0');

      act(() => {
        useTvStore.getState().setIsVideoPlaying(false);
      });
      rerender(<TvSoundProvider />);
      sound = screen.getByTestId('mock-sound-engine');
      expect(sound).toHaveAttribute('data-volume', '80');
    });

    it('verifies extractYouTubeId helper handles diverse URL formats and stream candidates', () => {
      expect(
        extractYouTubeId(
          undefined,
          'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        ),
      ).toBe('dQw4w9WgXcQ');
      expect(
        extractYouTubeId(undefined, 'https://youtu.be/dQw4w9WgXcQ?t=43'),
      ).toBe('dQw4w9WgXcQ');
      expect(
        extractYouTubeId(
          undefined,
          'https://www.youtube.com/embed/dQw4w9WgXcQ',
        ),
      ).toBe('dQw4w9WgXcQ');

      const trackWithCandidate: Track = {
        title: 'Song',
        artists: [],
        streamCandidates: [
          {
            source: { provider: 'youtube', id: 'candId12345' },
            url: 'https://audio.example.com',
            format: 'audio',
            failed: false,
          },
        ],
      };
      expect(extractYouTubeId(trackWithCandidate, undefined)).toBe(
        'candId12345',
      );

      const trackDirect: Track = {
        title: 'Song',
        artists: [],
        source: { provider: 'youtube', id: 'directId123' },
      };
      expect(extractYouTubeId(trackDirect, undefined)).toBe('directId123');

      expect(extractYouTubeId(undefined, 'https://example.com/audio.mp3')).toBe(
        null,
      );
      expect(extractYouTubeId(undefined, undefined)).toBe(null);
    });
  });

  describe('Adversarial Challenge 4: Coordinated End-to-End TV Video & Sound Lifecycle', () => {
    it('seamlessly coordinates video iframe embedding, fallback switching, and audio unmuting in full lifecycle', async () => {
      const trackWithVideo: Track = {
        title: 'Track A',
        artists: [{ name: 'Band A', roles: [] }],
        source: { provider: 'test', id: 'track-a' },
      };
      const trackWithoutVideo: Track = {
        title: 'Track B',
        artists: [{ name: 'Band B', roles: [] }],
        source: { provider: 'test', id: 'track-b' },
      };

      vi.mocked(musicVideoService.findOfficialVideo).mockImplementation(
        async (track?: Track) => {
          if (track?.source?.id === 'track-a') {
            return {
              videoId: 'vidA123',
              title: 'Band A - Track A (Official)',
              channelTitle: 'Band A',
              score: 100,
            };
          }
          return null;
        },
      );

      currentVolumeSetting = 0.85;
      currentMutedSetting = false;

      const { rerender } = render(
        <TvSoundProvider>
          <TvVideoPlayer track={trackWithVideo} />
        </TvSoundProvider>,
      );

      await waitFor(() => {
        expect(
          screen.getByTitle('Band A - Track A (Official)'),
        ).toBeInTheDocument();
      });

      expect(useTvStore.getState().isVideoPlaying).toBe(true);
      let sound = screen.getByTestId('mock-sound-engine');
      expect(sound).toHaveAttribute('data-volume', '0');

      rerender(
        <TvSoundProvider>
          <TvVideoPlayer track={trackWithoutVideo} />
        </TvSoundProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('tv-cover-art-view')).toBeInTheDocument();
        expect(screen.getByText('Track B')).toBeInTheDocument();
      });

      expect(useTvStore.getState().isVideoPlaying).toBe(false);
      sound = screen.getByTestId('mock-sound-engine');
      expect(sound).toHaveAttribute('data-volume', '85');
    });
  });

  describe('Adversarial Challenge 5: Anti-Premature Skip & Playback Synchronization', () => {
    it('defers track completion when background audio ends while showVideo and isVideoPlaying are active', async () => {
      useTvStore.setState({
        showVideo: true,
        isVideoPlaying: true,
        targetVideoId: 'video-123',
      });

      render(
        <TvSoundProvider>
          <div data-testid="tv-child">Child</div>
        </TvSoundProvider>,
      );

      const sound = screen.getByTestId('mock-sound-engine');
      await userEvent.click(sound);

      expect(playbackManager.finishTrack).not.toHaveBeenCalled();
    });

    it('defers track completion when background audio ends while targetVideoId is active even if video is paused/loading', async () => {
      useTvStore.setState({
        showVideo: true,
        isVideoPlaying: false,
        targetVideoId: 'video-loading-456',
      });

      render(
        <TvSoundProvider>
          <div data-testid="tv-child">Child</div>
        </TvSoundProvider>,
      );

      const sound = screen.getByTestId('mock-sound-engine');
      await userEvent.click(sound);

      expect(playbackManager.finishTrack).not.toHaveBeenCalled();
    });

    it('immediately finishes track when audio ends in cover art fallback (showVideo: true, targetVideoId: null, isVideoPlaying: false)', async () => {
      useTvStore.setState({
        showVideo: true,
        isVideoPlaying: false,
        targetVideoId: null,
      });

      render(
        <TvSoundProvider>
          <div data-testid="tv-child">Child</div>
        </TvSoundProvider>,
      );

      const sound = screen.getByTestId('mock-sound-engine');
      await userEvent.click(sound);

      expect(playbackManager.finishTrack).toHaveBeenCalledTimes(1);
    });

    it('immediately finishes track when audio ends while browsing outside video player (showVideo: false)', async () => {
      useTvStore.setState({
        showVideo: false,
        isVideoPlaying: false,
        targetVideoId: null,
      });

      render(
        <TvSoundProvider>
          <div data-testid="tv-child">Child</div>
        </TvSoundProvider>,
      );

      const sound = screen.getByTestId('mock-sound-engine');
      await userEvent.click(sound);

      expect(playbackManager.finishTrack).toHaveBeenCalledTimes(1);
    });

    it('fully synchronizes end-to-end: audio ending early does not advance track, while YouTube iframe ending advances exactly once', async () => {
      const syncTrack: Track = {
        title: 'Karma Police',
        artists: [{ name: 'Radiohead', roles: [] }],
        source: { provider: 'test', id: 'rh-kp' },
      };

      vi.mocked(musicVideoService.findOfficialVideo).mockResolvedValueOnce({
        videoId: 'kpVideoOfficial',
        title: 'Radiohead - Karma Police (Official Video)',
        channelTitle: 'Radiohead',
        score: 130,
      });

      render(
        <TvSoundProvider>
          <TvVideoPlayer track={syncTrack} />
        </TvSoundProvider>,
      );

      await waitFor(() => {
        expect(
          screen.getByTitle('Radiohead - Karma Police (Official Video)'),
        ).toBeInTheDocument();
      });

      const sound = screen.getByTestId('mock-sound-engine');
      const iframe = screen.getByTitle(
        'Radiohead - Karma Police (Official Video)',
      ) as HTMLIFrameElement;

      expect(useTvStore.getState().targetVideoId).toBe('kpVideoOfficial');
      expect(useTvStore.getState().isVideoPlaying).toBe(true);

      await userEvent.click(sound);

      expect(playbackManager.finishTrack).not.toHaveBeenCalled();

      const endedMessage = new MessageEvent('message', {
        data: JSON.stringify({ event: 'onStateChange', info: 0 }),
        source: iframe.contentWindow,
      });
      window.dispatchEvent(endedMessage);

      await waitFor(() => {
        expect(playbackManager.finishTrack).toHaveBeenCalledTimes(1);
      });

      window.dispatchEvent(endedMessage);

      expect(playbackManager.finishTrack).toHaveBeenCalledTimes(1);
      expect(useTvStore.getState().isVideoPlaying).toBe(false);
    });
  });
});
