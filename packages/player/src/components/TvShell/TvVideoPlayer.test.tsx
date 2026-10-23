import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('TvVideoPlayer', () => {
  beforeAll(() => {
    initSpatialNavigation();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    useTvStore.setState({ showVideo: true, isVideoPlaying: false });
    useSoundStore.setState({
      status: 'playing',
      src: { url: 'https://youtube.com/watch?v=rawAudioStreamId123' },
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
      ],
      currentIndex: 0,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders clean TvCoverArtView and does not embed audio YouTube ID when findOfficialVideo returns null', async () => {
    vi.mocked(musicVideoService.findOfficialVideo).mockResolvedValueOnce(null);

    const mockTrack: Track = {
      title: 'Paranoid Android',
      artists: [{ name: 'Radiohead', roles: [] }],
      source: { provider: 'test', id: 'audio-id-xyz' },
      artwork: {
        items: [
          {
            url: 'https://example.com/okcomputer.jpg',
            purpose: 'thumbnail',
          },
        ],
      },
    };

    render(<TvVideoPlayer track={mockTrack} />);

    await waitFor(() => {
      expect(screen.getByTestId('tv-cover-art-view')).toBeInTheDocument();
    });

    expect(screen.queryByTitle(/Videoclip/i)).not.toBeInTheDocument();
    expect(
      screen.getByText('Sin videoclip disponible · Mostrando carátula'),
    ).toBeInTheDocument();
    expect(screen.getByText('Paranoid Android')).toBeInTheDocument();
    expect(screen.getByText('Radiohead')).toBeInTheDocument();
    expect(useTvStore.getState().isVideoPlaying).toBe(false);
  });

  it('embeds official YouTube video in iframe when findOfficialVideo returns a verified match', async () => {
    vi.mocked(musicVideoService.findOfficialVideo).mockResolvedValueOnce({
      videoId: 'officialVid123',
      title: 'Radiohead - Paranoid Android (Official Video)',
      channelTitle: 'Radiohead',
      score: 125,
    });

    const mockTrack: Track = {
      title: 'Paranoid Android',
      artists: [{ name: 'Radiohead', roles: [] }],
      source: { provider: 'test', id: 'rh-1' },
    };

    render(<TvVideoPlayer track={mockTrack} />);

    await waitFor(() => {
      expect(
        screen.getByTitle('Radiohead - Paranoid Android (Official Video)'),
      ).toBeInTheDocument();
    });

    const iframe = screen.getByTitle(
      'Radiohead - Paranoid Android (Official Video)',
    );
    expect(iframe).toHaveAttribute(
      'src',
      expect.stringContaining('officialVid123'),
    );
    expect(useTvStore.getState().isVideoPlaying).toBe(true);
    expect(screen.getByText('🎬 Videoclip Oficial')).toBeInTheDocument();
  });

  it('allows user to toggle playback from fallback view', async () => {
    vi.mocked(musicVideoService.findOfficialVideo).mockResolvedValueOnce(null);

    const mockTrack: Track = {
      title: 'No Surprises',
      artists: [{ name: 'Radiohead', roles: [] }],
      source: { provider: 'test', id: 'ns-1' },
    };

    render(<TvVideoPlayer track={mockTrack} />);

    await waitFor(() => {
      expect(screen.getByTestId('tv-cover-art-view')).toBeInTheDocument();
    });

    const pauseButton = screen.getByRole('button', { name: 'Pausar' });
    await userEvent.click(pauseButton);

    expect(playbackManager.toggle).toHaveBeenCalled();
  });

  it('resets video playing state and closes video view when back button is clicked', async () => {
    vi.mocked(musicVideoService.findOfficialVideo).mockResolvedValueOnce(null);

    const mockTrack: Track = {
      title: 'Karma Police',
      artists: [{ name: 'Radiohead', roles: [] }],
      source: { provider: 'test', id: 'kp-1' },
    };

    render(<TvVideoPlayer track={mockTrack} />);

    await waitFor(() => {
      expect(screen.getByTestId('tv-cover-art-view')).toBeInTheDocument();
    });

    const closeButton = screen.getByRole('button', {
      name: 'Cerrar vista de vídeo',
    });
    await userEvent.click(closeButton);

    expect(useTvStore.getState().isVideoPlaying).toBe(false);
    expect(useTvStore.getState().showVideo).toBe(false);
    expect(useTvStore.getState().targetVideoId).toBe(null);
  });

  it('advances track when onStateChange info: 0 is received from active iframe', async () => {
    vi.mocked(musicVideoService.findOfficialVideo).mockResolvedValueOnce({
      videoId: 'officialVid123',
      title: 'Radiohead - Paranoid Android (Official Video)',
      channelTitle: 'Radiohead',
      score: 125,
    });

    const mockTrack: Track = {
      title: 'Paranoid Android',
      artists: [{ name: 'Radiohead', roles: [] }],
      source: { provider: 'test', id: 'rh-1' },
    };

    render(<TvVideoPlayer track={mockTrack} />);

    await waitFor(() => {
      expect(
        screen.getByTitle('Radiohead - Paranoid Android (Official Video)'),
      ).toBeInTheDocument();
    });

    const iframe = screen.getByTitle(
      'Radiohead - Paranoid Android (Official Video)',
    ) as HTMLIFrameElement;
    expect(useTvStore.getState().targetVideoId).toBe('officialVid123');

    const messageEvent = new MessageEvent('message', {
      data: JSON.stringify({ event: 'onStateChange', info: 0 }),
      source: iframe.contentWindow,
    });
    window.dispatchEvent(messageEvent);

    await waitFor(() => {
      expect(playbackManager.finishTrack).toHaveBeenCalledTimes(1);
    });

    expect(useTvStore.getState().isVideoPlaying).toBe(false);
  });

  it('guards against duplicate info: 0 messages from active iframe so finishTrack is only called once', async () => {
    vi.mocked(musicVideoService.findOfficialVideo).mockResolvedValueOnce({
      videoId: 'officialVid123',
      title: 'Radiohead - Paranoid Android (Official Video)',
      channelTitle: 'Radiohead',
      score: 125,
    });

    const mockTrack: Track = {
      title: 'Paranoid Android',
      artists: [{ name: 'Radiohead', roles: [] }],
      source: { provider: 'test', id: 'rh-1' },
    };

    render(<TvVideoPlayer track={mockTrack} />);

    await waitFor(() => {
      expect(
        screen.getByTitle('Radiohead - Paranoid Android (Official Video)'),
      ).toBeInTheDocument();
    });

    const iframe = screen.getByTitle(
      'Radiohead - Paranoid Android (Official Video)',
    ) as HTMLIFrameElement;

    const messageEvent1 = new MessageEvent('message', {
      data: JSON.stringify({ event: 'onStateChange', info: 0 }),
      source: iframe.contentWindow,
    });
    const messageEvent2 = new MessageEvent('message', {
      data: JSON.stringify({ event: 'onStateChange', info: 0 }),
      source: iframe.contentWindow,
    });
    const messageEvent3 = new MessageEvent('message', {
      data: JSON.stringify({ event: 'onStateChange', info: 0 }),
      source: iframe.contentWindow,
    });

    window.dispatchEvent(messageEvent1);
    window.dispatchEvent(messageEvent2);
    window.dispatchEvent(messageEvent3);

    await waitFor(() => {
      expect(playbackManager.finishTrack).toHaveBeenCalledTimes(1);
    });

    expect(playbackManager.finishTrack).not.toHaveBeenCalledTimes(2);
  });

  it('ignores message events originating from invalid sources or window instead of iframe', async () => {
    vi.mocked(musicVideoService.findOfficialVideo).mockResolvedValueOnce({
      videoId: 'officialVid123',
      title: 'Radiohead - Paranoid Android (Official Video)',
      channelTitle: 'Radiohead',
      score: 125,
    });

    const mockTrack: Track = {
      title: 'Paranoid Android',
      artists: [{ name: 'Radiohead', roles: [] }],
      source: { provider: 'test', id: 'rh-1' },
    };

    render(<TvVideoPlayer track={mockTrack} />);

    await waitFor(() => {
      expect(
        screen.getByTitle('Radiohead - Paranoid Android (Official Video)'),
      ).toBeInTheDocument();
    });

    const eventFromWindow = new MessageEvent('message', {
      data: JSON.stringify({ event: 'onStateChange', info: 0 }),
      source: window,
    });
    window.dispatchEvent(eventFromWindow);

    const eventWithoutSource = new MessageEvent('message', {
      data: JSON.stringify({ event: 'onStateChange', info: 0 }),
      source: null,
    });
    window.dispatchEvent(eventWithoutSource);

    expect(playbackManager.finishTrack).not.toHaveBeenCalled();
    expect(useTvStore.getState().isVideoPlaying).toBe(true);
  });

  it('synchronizes targetVideoId in useTvStore on resolution, and clears it on unmount', async () => {
    vi.mocked(musicVideoService.findOfficialVideo).mockResolvedValueOnce({
      videoId: 'syncVid777',
      title: 'Radiohead - Paranoid Android (Official Video)',
      channelTitle: 'Radiohead',
      score: 125,
    });

    const mockTrack: Track = {
      title: 'Paranoid Android',
      artists: [{ name: 'Radiohead', roles: [] }],
      source: { provider: 'test', id: 'rh-1' },
    };

    const { unmount } = render(<TvVideoPlayer track={mockTrack} />);

    await waitFor(() => {
      expect(useTvStore.getState().targetVideoId).toBe('syncVid777');
    });

    unmount();

    expect(useTvStore.getState().targetVideoId).toBe(null);
    expect(useTvStore.getState().isVideoPlaying).toBe(false);
  });
});
