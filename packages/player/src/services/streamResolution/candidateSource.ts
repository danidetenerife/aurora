import type { StreamCandidate, Track } from '@aurora/model';

import { isStreamExpired, streamingHost } from '../streamingHost';

export const candidatesForTrack = async (
  track: Track,
): Promise<StreamCandidate[] | undefined> => {
  if (
    track.source.provider === 'podcast-audio' &&
    track.source.url &&
    /^https?:\/\//.test(track.source.url)
  ) {
    return [
      {
        id: track.source.id,
        title: track.title,
        source: track.source,
        failed: false,
        lastResolvedAtIso: new Date().toISOString(),
        durationMs: track.durationMs,
        stream: {
          url: track.source.url,
          protocol: track.source.url.startsWith('https:') ? 'https' : 'http',
          source: track.source,
          durationMs: track.durationMs,
        },
      },
    ];
  }

  const isDirectYoutube =
    (track.source.provider === 'youtube' ||
      track.source.provider === 'youtube-music' ||
      track.source.provider === 'aurora-plugin-youtube' ||
      track.source.provider === 'aurora-plugin-youtube-music') &&
    track.source.id &&
    /^[a-zA-Z0-9_-]{11}$/.test(track.source.id);

  if (isDirectYoutube) {
    const cached = track.streamCandidates;
    if (
      cached?.length &&
      !cached.some(isStreamExpired) &&
      cached.some((candidate) => candidate.id === track.source.id)
    ) {
      return cached;
    }

    return [
      {
        id: track.source.id,
        title: track.title,
        source: track.source,
        failed: false,
        lastResolvedAtIso: new Date().toISOString(),
        durationMs: track.durationMs,
      },
    ];
  }

  const cached = track.streamCandidates;
  if (cached?.length && !cached.some(isStreamExpired)) {
    return cached;
  }

  if (track.isPodcast) {
    return undefined;
  }

  const result = await streamingHost.resolveCandidatesForTrack(track);
  if (result.success) {
    return result.candidates;
  }
  return undefined;
};

