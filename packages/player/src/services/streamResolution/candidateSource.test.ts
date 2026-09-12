import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Track } from '@aurora/model';

import { streamingHost } from '../streamingHost';
import { candidatesForTrack } from './candidateSource';

vi.mock('../streamingHost', () => ({
  isStreamExpired: vi.fn().mockReturnValue(false),
  streamingHost: {
    resolveCandidatesForTrack: vi.fn(),
  },
}));

describe('candidateSource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns direct stream candidate for podcast-audio with URL', async () => {
    const track: Track = {
      title: 'Episode 1',
      artists: [{ name: 'Host' }],
      source: {
        provider: 'podcast-audio',
        id: 'ep-123',
        url: 'https://example.com/audio.mp3',
      },
      durationMs: 60000,
    };

    const candidates = await candidatesForTrack(track);

    expect(candidates).toEqual([
      expect.objectContaining({
        id: 'ep-123',
        title: 'Episode 1',
        stream: expect.objectContaining({
          url: 'https://example.com/audio.mp3',
          protocol: 'https',
        }),
      }),
    ]);
    expect(streamingHost.resolveCandidatesForTrack).not.toHaveBeenCalled();
  });

  it('returns direct candidate for youtube track with 11-character videoId without searching', async () => {
    const track: Track = {
      title: 'Rachel Barber: la inquietante obsesión de su NIÑERA',
      artists: [{ name: 'Terrores Nocturnos Podcast' }],
      source: {
        provider: 'youtube-music',
        id: 'wGZuNGVuU-8',
        url: 'https://www.youtube.com/watch?v=wGZuNGVuU-8',
      },
      durationMs: 2700000,
    };

    const candidates = await candidatesForTrack(track);

    expect(candidates).toEqual([
      expect.objectContaining({
        id: 'wGZuNGVuU-8',
        title: 'Rachel Barber: la inquietante obsesión de su NIÑERA',
        failed: false,
      }),
    ]);
    expect(streamingHost.resolveCandidatesForTrack).not.toHaveBeenCalled();
  });

  it('calls streamingHost.resolveCandidatesForTrack for tracks without direct stream or ID', async () => {
    vi.mocked(streamingHost.resolveCandidatesForTrack).mockResolvedValue({
      success: true,
      candidates: [
        {
          id: 'resolved-yt-id',
          title: 'Radiohead - Creep',
          source: { provider: 'youtube', id: 'resolved-yt-id' },
          failed: false,
        },
      ],
    });

    const track: Track = {
      title: 'Creep',
      artists: [{ name: 'Radiohead' }],
      source: {
        provider: 'spotify',
        id: 'spotify-track-id',
      },
      durationMs: 238000,
    };

    const candidates = await candidatesForTrack(track);

    expect(streamingHost.resolveCandidatesForTrack).toHaveBeenCalledWith(track);
    expect(candidates).toHaveLength(1);
    expect(candidates?.[0]?.id).toBe('resolved-yt-id');
  });
});
