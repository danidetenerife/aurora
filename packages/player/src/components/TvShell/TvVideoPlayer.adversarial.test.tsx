import { cleanup, render, screen, waitFor } from '@testing-library/react';
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
import { TvVideoPlayer } from './TvVideoPlayer';

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

describe('TvVideoPlayer Adversarial Challenge (M2 - R2)', () => {
  beforeAll(() => {
    initSpatialNavigation();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    useTvStore.setState({
      showVideo: true,
      isVideoPlaying: false,
      targetVideoId: null,
      activeSection: 'dashboard',
    });
    useSoundStore.setState({
      status: 'playing',
      src: { url: 'https://youtube.com/watch?v=rawAudioStreamId123' },
    });
    useQueueStore.setState({
      items: [
        {
          id: 'item-1',
          track: {
            title: 'Track One',
            artists: [{ name: 'Artist A', roles: [] }],
            source: { provider: 'test', id: 't-1' },
          },
          status: 'playing',
          addedAtIso: '',
        },
        {
          id: 'item-2',
          track: {
            title: 'Track Two',
            artists: [{ name: 'Artist B', roles: [] }],
            source: { provider: 'test', id: 't-2' },
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

  describe('Adversarial Dimension 1: Rapid Duplicate info: 0 Ended Events & Race Conditions', () => {
    it('suppresses rapid burst of 10 identical info: 0 ended events to exactly 1 track finish', async () => {
      vi.mocked(musicVideoService.findOfficialVideo).mockResolvedValueOnce({
        videoId: 'rapidBurstVid',
        title: 'Rapid Burst Artist - Track (Official Video)',
        channelTitle: 'Rapid Burst Artist',
        score: 120,
      });

      const track: Track = {
        title: 'Burst Track',
        artists: [{ name: 'Burst Artist', roles: [] }],
        source: { provider: 'test', id: 'burst-1' },
      };

      render(<TvVideoPlayer track={track} />);

      await waitFor(() => {
        expect(
          screen.getByTitle('Rapid Burst Artist - Track (Official Video)'),
        ).toBeInTheDocument();
      });

      const iframe = screen.getByTitle(
        'Rapid Burst Artist - Track (Official Video)',
      ) as HTMLIFrameElement;
      expect(useTvStore.getState().targetVideoId).toBe('rapidBurstVid');

      for (let i = 0; i < 10; i++) {
        const event = new MessageEvent('message', {
          data: JSON.stringify({ event: 'onStateChange', info: 0 }),
          source: iframe.contentWindow,
        });
        window.dispatchEvent(event);
      }

      await waitFor(() => {
        expect(playbackManager.finishTrack).toHaveBeenCalledTimes(1);
      });

      expect(playbackManager.finishTrack).not.toHaveBeenCalledTimes(2);
      expect(useTvStore.getState().isVideoPlaying).toBe(false);
    });

    it('suppresses asynchronous staggered info: 0 events spread across microtasks', async () => {
      vi.mocked(musicVideoService.findOfficialVideo).mockResolvedValueOnce({
        videoId: 'asyncStaggerVid',
        title: 'Async Stagger - Track (Official Video)',
        channelTitle: 'Async Stagger',
        score: 110,
      });

      const track: Track = {
        title: 'Stagger Track',
        artists: [{ name: 'Async Stagger', roles: [] }],
        source: { provider: 'test', id: 'stagger-1' },
      };

      render(<TvVideoPlayer track={track} />);

      await waitFor(() => {
        expect(
          screen.getByTitle('Async Stagger - Track (Official Video)'),
        ).toBeInTheDocument();
      });

      const iframe = screen.getByTitle(
        'Async Stagger - Track (Official Video)',
      ) as HTMLIFrameElement;

      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ event: 'onStateChange', info: 0 }),
          source: iframe.contentWindow,
        }),
      );

      await Promise.resolve();

      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ event: 'onStateChange', info: 0 }),
          source: iframe.contentWindow,
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ event: 'onStateChange', info: 0 }),
          source: iframe.contentWindow,
        }),
      );

      await waitFor(() => {
        expect(playbackManager.finishTrack).toHaveBeenCalledTimes(1);
      });

      expect(playbackManager.finishTrack).not.toHaveBeenCalledTimes(2);
    });

    it('ignores duplicate info: 0 even if followed by a rogue info: 1 (playing) event', async () => {
      vi.mocked(musicVideoService.findOfficialVideo).mockResolvedValueOnce({
        videoId: 'stateFlipVid',
        title: 'State Flip - Track (Official Video)',
        channelTitle: 'State Flip',
        score: 115,
      });

      const track: Track = {
        title: 'State Flip Track',
        artists: [{ name: 'State Flip', roles: [] }],
        source: { provider: 'test', id: 'flip-1' },
      };

      render(<TvVideoPlayer track={track} />);

      await waitFor(() => {
        expect(
          screen.getByTitle('State Flip - Track (Official Video)'),
        ).toBeInTheDocument();
      });

      const iframe = screen.getByTitle(
        'State Flip - Track (Official Video)',
      ) as HTMLIFrameElement;

      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ event: 'onStateChange', info: 0 }),
          source: iframe.contentWindow,
        }),
      );

      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ event: 'onStateChange', info: 1 }),
          source: iframe.contentWindow,
        }),
      );

      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ event: 'onStateChange', info: 0 }),
          source: iframe.contentWindow,
        }),
      );

      await waitFor(() => {
        expect(playbackManager.finishTrack).toHaveBeenCalledTimes(1);
      });

      expect(playbackManager.finishTrack).not.toHaveBeenCalledTimes(2);
    });
  });

  describe('Adversarial Dimension 2: Untrusted Sources, Origin Spoofing & Malformed Payloads', () => {
    it('strictly rejects postMessages originating from window', async () => {
      vi.mocked(musicVideoService.findOfficialVideo).mockResolvedValueOnce({
        videoId: 'untrustedVid1',
        title: 'Band - Untrusted (Official Video)',
        channelTitle: 'Band',
        score: 100,
      });

      const track: Track = {
        title: 'Untrusted Track',
        artists: [{ name: 'Band', roles: [] }],
        source: { provider: 'test', id: 'untrusted-1' },
      };

      render(<TvVideoPlayer track={track} />);

      await waitFor(() => {
        expect(
          screen.getByTitle('Band - Untrusted (Official Video)'),
        ).toBeInTheDocument();
      });

      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ event: 'onStateChange', info: 0 }),
          source: window,
        }),
      );

      expect(playbackManager.finishTrack).not.toHaveBeenCalled();
      expect(useTvStore.getState().isVideoPlaying).toBe(true);
    });

    it('strictly rejects postMessages originating from rogue external iframe windows', async () => {
      vi.mocked(musicVideoService.findOfficialVideo).mockResolvedValueOnce({
        videoId: 'rogueVid',
        title: 'Band - Rogue Test (Official Video)',
        channelTitle: 'Band',
        score: 100,
      });

      const track: Track = {
        title: 'Rogue Test Track',
        artists: [{ name: 'Band', roles: [] }],
        source: { provider: 'test', id: 'rogue-1' },
      };

      render(<TvVideoPlayer track={track} />);

      await waitFor(() => {
        expect(
          screen.getByTitle('Band - Rogue Test (Official Video)'),
        ).toBeInTheDocument();
      });

      const rogueIframe = document.createElement('iframe');
      document.body.appendChild(rogueIframe);

      try {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: JSON.stringify({ event: 'onStateChange', info: 0 }),
            source: rogueIframe.contentWindow,
          }),
        );

        expect(playbackManager.finishTrack).not.toHaveBeenCalled();
        expect(useTvStore.getState().isVideoPlaying).toBe(true);
      } finally {
        document.body.removeChild(rogueIframe);
      }
    });

    it('strictly rejects postMessages with null or undefined source', async () => {
      vi.mocked(musicVideoService.findOfficialVideo).mockResolvedValueOnce({
        videoId: 'nullSourceVid',
        title: 'Band - Null Source (Official Video)',
        channelTitle: 'Band',
        score: 100,
      });

      const track: Track = {
        title: 'Null Source Track',
        artists: [{ name: 'Band', roles: [] }],
        source: { provider: 'test', id: 'null-src-1' },
      };

      render(<TvVideoPlayer track={track} />);

      await waitFor(() => {
        expect(
          screen.getByTitle('Band - Null Source (Official Video)'),
        ).toBeInTheDocument();
      });

      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ event: 'onStateChange', info: 0 }),
          source: null,
        }),
      );

      expect(playbackManager.finishTrack).not.toHaveBeenCalled();
      expect(useTvStore.getState().isVideoPlaying).toBe(true);
    });

    it('gracefully handles malformed JSON strings, binary data, numbers, and null payloads without crashing', async () => {
      vi.mocked(musicVideoService.findOfficialVideo).mockResolvedValueOnce({
        videoId: 'malformedPayloadVid',
        title: 'Band - Malformed (Official Video)',
        channelTitle: 'Band',
        score: 100,
      });

      const track: Track = {
        title: 'Malformed Track',
        artists: [{ name: 'Band', roles: [] }],
        source: { provider: 'test', id: 'mal-1' },
      };

      render(<TvVideoPlayer track={track} />);

      await waitFor(() => {
        expect(
          screen.getByTitle('Band - Malformed (Official Video)'),
        ).toBeInTheDocument();
      });

      const iframe = screen.getByTitle(
        'Band - Malformed (Official Video)',
      ) as HTMLIFrameElement;

      window.dispatchEvent(
        new MessageEvent('message', {
          data: 'NOT_VALID_JSON{::: broken',
          source: iframe.contentWindow,
        }),
      );

      window.dispatchEvent(
        new MessageEvent('message', {
          data: 42,
          source: iframe.contentWindow,
        }),
      );
      window.dispatchEvent(
        new MessageEvent('message', {
          data: null,
          source: iframe.contentWindow,
        }),
      );
      window.dispatchEvent(
        new MessageEvent('message', {
          data: undefined,
          source: iframe.contentWindow,
        }),
      );

      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ event: 'onStateChange', info: '0' }),
          source: iframe.contentWindow,
        }),
      );

      expect(playbackManager.finishTrack).not.toHaveBeenCalled();
      expect(useTvStore.getState().isVideoPlaying).toBe(true);
    });
  });

  describe('Adversarial Dimension 3: Track Switch Ended-Guard Reset & Multi-Video Sequential Lifecycles', () => {
    it('properly resets hasEndedRef so track 2 can end normally after track 1 completed', async () => {
      const track1: Track = {
        title: 'Song One',
        artists: [{ name: 'Artist 1', roles: [] }],
        source: { provider: 'test', id: 's-1' },
      };
      const track2: Track = {
        title: 'Song Two',
        artists: [{ name: 'Artist 2', roles: [] }],
        source: { provider: 'test', id: 's-2' },
      };

      vi.mocked(musicVideoService.findOfficialVideo)
        .mockResolvedValueOnce({
          videoId: 'vidTrack1',
          title: 'Artist 1 - Song One (Official Video)',
          channelTitle: 'Artist 1',
          score: 120,
        })
        .mockResolvedValueOnce({
          videoId: 'vidTrack2',
          title: 'Artist 2 - Song Two (Official Video)',
          channelTitle: 'Artist 2',
          score: 125,
        });

      const { rerender } = render(<TvVideoPlayer track={track1} />);

      await waitFor(() => {
        expect(
          screen.getByTitle('Artist 1 - Song One (Official Video)'),
        ).toBeInTheDocument();
      });

      const iframe1 = screen.getByTitle(
        'Artist 1 - Song One (Official Video)',
      ) as HTMLIFrameElement;
      expect(useTvStore.getState().targetVideoId).toBe('vidTrack1');

      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ event: 'onStateChange', info: 0 }),
          source: iframe1.contentWindow,
        }),
      );

      await waitFor(() => {
        expect(playbackManager.finishTrack).toHaveBeenCalledTimes(1);
      });
      expect(useTvStore.getState().isVideoPlaying).toBe(false);

      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ event: 'onStateChange', info: 0 }),
          source: iframe1.contentWindow,
        }),
      );
      expect(playbackManager.finishTrack).toHaveBeenCalledTimes(1);

      rerender(<TvVideoPlayer track={track2} />);

      await waitFor(() => {
        expect(
          screen.getByTitle('Artist 2 - Song Two (Official Video)'),
        ).toBeInTheDocument();
      });

      const iframe2 = screen.getByTitle(
        'Artist 2 - Song Two (Official Video)',
      ) as HTMLIFrameElement;
      expect(useTvStore.getState().targetVideoId).toBe('vidTrack2');
      expect(useTvStore.getState().isVideoPlaying).toBe(true);

      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ event: 'onStateChange', info: 0 }),
          source: iframe2.contentWindow,
        }),
      );

      await waitFor(() => {
        expect(playbackManager.finishTrack).toHaveBeenCalledTimes(2);
      });
      expect(useTvStore.getState().isVideoPlaying).toBe(false);

      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ event: 'onStateChange', info: 0 }),
          source: iframe2.contentWindow,
        }),
      );
      expect(playbackManager.finishTrack).toHaveBeenCalledTimes(2);
    });

    it('resets hasEndedRef and handles 3 consecutive official music videos ending in sequence', async () => {
      const tracks: Track[] = [
        {
          title: 'Sequence 1',
          artists: [{ name: 'Band S', roles: [] }],
          source: { provider: 'test', id: 'seq-1' },
        },
        {
          title: 'Sequence 2',
          artists: [{ name: 'Band S', roles: [] }],
          source: { provider: 'test', id: 'seq-2' },
        },
        {
          title: 'Sequence 3',
          artists: [{ name: 'Band S', roles: [] }],
          source: { provider: 'test', id: 'seq-3' },
        },
      ];

      vi.mocked(musicVideoService.findOfficialVideo)
        .mockResolvedValueOnce({
          videoId: 'seqVid1',
          title: 'Band S - Sequence 1 (Official Video)',
          channelTitle: 'Band S',
          score: 100,
        })
        .mockResolvedValueOnce({
          videoId: 'seqVid2',
          title: 'Band S - Sequence 2 (Official Video)',
          channelTitle: 'Band S',
          score: 100,
        })
        .mockResolvedValueOnce({
          videoId: 'seqVid3',
          title: 'Band S - Sequence 3 (Official Video)',
          channelTitle: 'Band S',
          score: 100,
        });

      const { rerender } = render(<TvVideoPlayer track={tracks[0]} />);

      await waitFor(() => {
        expect(
          screen.getByTitle('Band S - Sequence 1 (Official Video)'),
        ).toBeInTheDocument();
      });
      const iframe1 = screen.getByTitle(
        'Band S - Sequence 1 (Official Video)',
      ) as HTMLIFrameElement;

      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ event: 'onStateChange', info: 0 }),
          source: iframe1.contentWindow,
        }),
      );
      await waitFor(() => {
        expect(playbackManager.finishTrack).toHaveBeenCalledTimes(1);
      });

      rerender(<TvVideoPlayer track={tracks[1]} />);
      await waitFor(() => {
        expect(
          screen.getByTitle('Band S - Sequence 2 (Official Video)'),
        ).toBeInTheDocument();
      });
      const iframe2 = screen.getByTitle(
        'Band S - Sequence 2 (Official Video)',
      ) as HTMLIFrameElement;

      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ event: 'onStateChange', info: 0 }),
          source: iframe2.contentWindow,
        }),
      );
      await waitFor(() => {
        expect(playbackManager.finishTrack).toHaveBeenCalledTimes(2);
      });

      rerender(<TvVideoPlayer track={tracks[2]} />);
      await waitFor(() => {
        expect(
          screen.getByTitle('Band S - Sequence 3 (Official Video)'),
        ).toBeInTheDocument();
      });
      const iframe3 = screen.getByTitle(
        'Band S - Sequence 3 (Official Video)',
      ) as HTMLIFrameElement;

      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ event: 'onStateChange', info: 0 }),
          source: iframe3.contentWindow,
        }),
      );
      await waitFor(() => {
        expect(playbackManager.finishTrack).toHaveBeenCalledTimes(3);
      });
    });

    it('correctly transitions from official video to cover art fallback and back to official video', async () => {
      const trackVideo1: Track = {
        title: 'Video Track 1',
        artists: [{ name: 'Artist V1', roles: [] }],
        source: { provider: 'test', id: 'tv-1' },
      };
      const trackCover: Track = {
        title: 'Cover Track',
        artists: [{ name: 'Artist C', roles: [] }],
        source: { provider: 'test', id: 'tc-1' },
      };
      const trackVideo2: Track = {
        title: 'Video Track 2',
        artists: [{ name: 'Artist V2', roles: [] }],
        source: { provider: 'test', id: 'tv-2' },
      };

      vi.mocked(musicVideoService.findOfficialVideo)
        .mockResolvedValueOnce({
          videoId: 'vid111',
          title: 'Artist V1 - Video Track 1 (Official Video)',
          channelTitle: 'Artist V1',
          score: 110,
        })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          videoId: 'vid222',
          title: 'Artist V2 - Video Track 2 (Official Video)',
          channelTitle: 'Artist V2',
          score: 110,
        });

      const { rerender, container } = render(
        <TvVideoPlayer track={trackVideo1} />,
      );

      await waitFor(() => {
        expect(
          screen.getByTitle('Artist V1 - Video Track 1 (Official Video)'),
        ).toBeInTheDocument();
      });
      expect(useTvStore.getState().targetVideoId).toBe('vid111');
      expect(useTvStore.getState().isVideoPlaying).toBe(true);

      const iframe1 = screen.getByTitle(
        'Artist V1 - Video Track 1 (Official Video)',
      ) as HTMLIFrameElement;
      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ event: 'onStateChange', info: 0 }),
          source: iframe1.contentWindow,
        }),
      );
      await waitFor(() => {
        expect(playbackManager.finishTrack).toHaveBeenCalledTimes(1);
      });

      rerender(<TvVideoPlayer track={trackCover} />);
      await waitFor(() => {
        expect(screen.getByTestId('tv-cover-art-view')).toBeInTheDocument();
      });
      expect(container.querySelector('iframe')).not.toBeInTheDocument();
      expect(useTvStore.getState().targetVideoId).toBe(null);
      expect(useTvStore.getState().isVideoPlaying).toBe(false);

      rerender(<TvVideoPlayer track={trackVideo2} />);
      await waitFor(() => {
        expect(
          screen.getByTitle('Artist V2 - Video Track 2 (Official Video)'),
        ).toBeInTheDocument();
      });
      expect(useTvStore.getState().targetVideoId).toBe('vid222');
      expect(useTvStore.getState().isVideoPlaying).toBe(true);

      const iframe2 = screen.getByTitle(
        'Artist V2 - Video Track 2 (Official Video)',
      ) as HTMLIFrameElement;
      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ event: 'onStateChange', info: 0 }),
          source: iframe2.contentWindow,
        }),
      );
      await waitFor(() => {
        expect(playbackManager.finishTrack).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Adversarial Dimension 4: Error Handling & Teardown Integrity', () => {
    it('handles onError postMessage by marking error state and resetting targetVideoId and isVideoPlaying', async () => {
      vi.mocked(musicVideoService.findOfficialVideo).mockResolvedValueOnce({
        videoId: 'errorVid101',
        title: 'Error Artist - Song (Official Video)',
        channelTitle: 'Error Artist',
        score: 100,
      });

      const track: Track = {
        title: 'Error Song',
        artists: [{ name: 'Error Artist', roles: [] }],
        source: { provider: 'test', id: 'err-1' },
      };

      const { container } = render(<TvVideoPlayer track={track} />);

      await waitFor(() => {
        expect(
          screen.getByTitle('Error Artist - Song (Official Video)'),
        ).toBeInTheDocument();
      });

      const iframe = screen.getByTitle(
        'Error Artist - Song (Official Video)',
      ) as HTMLIFrameElement;

      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ event: 'onError', data: 150 }),
          source: iframe.contentWindow,
        }),
      );

      await waitFor(() => {
        expect(screen.getByTestId('tv-cover-art-view')).toBeInTheDocument();
      });

      expect(useTvStore.getState().targetVideoId).toBe(null);
      expect(useTvStore.getState().isVideoPlaying).toBe(false);
      expect(container.querySelector('iframe')).not.toBeInTheDocument();
    });

    it('clears targetVideoId and isVideoPlaying on component unmount while video is actively playing', async () => {
      vi.mocked(musicVideoService.findOfficialVideo).mockResolvedValueOnce({
        videoId: 'unmountVid',
        title: 'Unmount Artist - Song (Official Video)',
        channelTitle: 'Unmount Artist',
        score: 100,
      });

      const track: Track = {
        title: 'Unmount Song',
        artists: [{ name: 'Unmount Artist', roles: [] }],
        source: { provider: 'test', id: 'unm-1' },
      };

      const { unmount } = render(<TvVideoPlayer track={track} />);

      await waitFor(() => {
        expect(useTvStore.getState().targetVideoId).toBe('unmountVid');
        expect(useTvStore.getState().isVideoPlaying).toBe(true);
      });

      unmount();

      expect(useTvStore.getState().targetVideoId).toBe(null);
      expect(useTvStore.getState().isVideoPlaying).toBe(false);
    });
  });
});
