import type { Track } from '@aurora/model';

import { httpHost } from './httpHost';
import { Logger } from './logger';

export const MIN_CONFIDENCE_SCORE = 60;
const MIN_VIDEO_DURATION_SECONDS = 45;
const MAX_DURATION_DIFF_SECONDS = 60;
const MAX_DURATION_DIFF_RATIO = 0.35;

export type OfficialVideoResult = {
  videoId: string;
  title: string;
  channelTitle?: string;
  thumbnailUrl?: string;
  score?: number;
};

export type CandidateScoreInput = {
  artist: string;
  cleanTitle: string;
  vTitle: string;
  vChannel: string;
  ownerBadges?: Array<{
    metadataBadgeRenderer?: {
      style?: string;
      icon?: { iconType?: string };
      tooltip?: string;
    };
  }>;
};

export type CandidateScoreResult = {
  artistScore: number;
  titleScore: number;
  badgeScore: number;
  officialPhraseScore: number;
  totalScore: number;
};

const NOISE_TERMS = [
  'reaction',
  'reacts',
  'reacting',
  'reaccion',
  'reaccionando',
  'parody',
  'parodia',
  'gameplay',
  'walkthrough',
  'playthrough',
  'lets play',
  'roblox',
  'minecraft',
  'fortnite',
  'amv',
  'fragmovie',
  'montage',
  '1 hour',
  '10 hours',
  '10 hour',
  '1 hour loop',
  'loop',
  'compilation',
  'recopilacion',
  'mix',
  'full album',
  'extended',
  '#shorts',
  'shorts',
  'tiktok',
  'meme',
  'speed up',
  'sped up',
  'slowed',
  'reverb',
  'nightcore',
  'bass boosted',
  'tutorial',
  'how to play',
  'lesson',
  'guitar tab',
  'chords',
  'behind the scenes',
  'bts',
  'making of',
  'teaser',
  'trailer',
  'vocal coach',
  'review',
  'analysis',
  'karaoke',
  'instrumental',
  'cover',
  '- topic',
  '(audio)',
  '[audio]',
];

const RECORD_LABELS = [
  'warner',
  'atlantic',
  'universal',
  'sony music',
  'interscope',
  'columbia records',
  'rca',
  'republic records',
  'def jam',
  'epic records',
  'capitol records',
  'fueled by ramen',
  'spinnin',
  'sub pop',
  'matador',
  'virgin records',
  'island records',
  'parlophone',
  'ultra music',
  'ultra records',
];

export const parseDurationToSeconds = (text?: string): number | null => {
  if (!text || typeof text !== 'string') {
    return null;
  }
  const parts = text
    .trim()
    .split(':')
    .map((part) => Number(part.trim()));
  if (parts.some((part) => Number.isNaN(part))) {
    return null;
  }
  if (parts.length === 1) {
    return parts[0];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return null;
};

export const normalizeText = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const escapeRegex = (stringToEscape: string): string =>
  stringToEscape.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

export const isNoiseMatch = (text: string, term: string): boolean => {
  const lowerText = normalizeText(text);
  const normalizedTerm = normalizeText(term);
  if (!normalizedTerm) {
    return false;
  }
  if (
    normalizedTerm.includes(' ') ||
    term.startsWith('#') ||
    term.includes('(') ||
    term.includes('[') ||
    term.includes('-')
  ) {
    return lowerText.includes(normalizedTerm);
  }
  const regex = new RegExp(`\\b${escapeRegex(normalizedTerm)}\\b`, 'i');
  return regex.test(lowerText);
};

export const hasNoiseTerms = (
  videoTitle: string,
  channelTitle: string,
  trackArtist: string,
  trackTitle: string,
): boolean => {
  const normalizedArtist = normalizeText(trackArtist);
  const normalizedTitle = normalizeText(trackTitle);

  for (const term of NOISE_TERMS) {
    const normalizedTerm = normalizeText(term);
    if (!normalizedTerm) {
      continue;
    }
    const isExempted =
      normalizedArtist.includes(normalizedTerm) ||
      normalizedTitle.includes(normalizedTerm);
    if (isExempted) {
      continue;
    }

    if (isNoiseMatch(videoTitle, term) || isNoiseMatch(channelTitle, term)) {
      return true;
    }
  }

  return false;
};

export const cleanTrackTitle = (title: string): string => {
  const cleaned = title
    .replace(
      /\s*\([^)]*(?:official|audio|video|feat|ft|remastered)[^)]*\)/gi,
      '',
    )
    .replace(
      /\s*\[[^\]]*(?:official|audio|video|feat|ft|remastered)[^\]]*\]/gi,
      '',
    )
    .trim();
  return cleaned || title.trim();
};

export const scoreCandidate = (
  input: CandidateScoreInput,
): CandidateScoreResult => {
  const normalizedArtist = normalizeText(input.artist);
  const normalizedCleanTitle = normalizeText(input.cleanTitle);
  const normalizedVTitle = normalizeText(input.vTitle);
  const normalizedVChannel = normalizeText(input.vChannel);

  let artistScore = 0;
  const artistTokens = normalizedArtist
    .split(' ')
    .filter(
      (token) =>
        token.length > 1 && !['the', 'and', 'feat', 'ft'].includes(token),
    );

  const isLabelChannel = RECORD_LABELS.some((label) =>
    normalizedVChannel.includes(label),
  );

  const artistInChannel =
    Boolean(normalizedArtist) &&
    (normalizedVChannel.includes(normalizedArtist) ||
      (artistTokens.length > 0 &&
        artistTokens.every((token) => normalizedVChannel.includes(token))));

  const artistInTitle =
    Boolean(normalizedArtist) &&
    (normalizedVTitle.includes(normalizedArtist) ||
      (artistTokens.length > 0 &&
        artistTokens.every((token) => normalizedVTitle.includes(token))));

  if (artistInChannel) {
    artistScore = 35;
  } else if (artistInTitle) {
    artistScore = isLabelChannel ? 35 : 30;
  } else if (
    artistTokens.length > 0 &&
    artistTokens.some(
      (token) =>
        normalizedVChannel.includes(token) || normalizedVTitle.includes(token),
    )
  ) {
    artistScore = 15;
  }

  let badgeScore = 0;
  const hasVerifiedBadge = (input.ownerBadges || []).some((badge) => {
    const style = badge.metadataBadgeRenderer?.style || '';
    const iconType = badge.metadataBadgeRenderer?.icon?.iconType || '';
    const tooltip = (badge.metadataBadgeRenderer?.tooltip || '').toLowerCase();
    return (
      style.includes('VERIFIED') ||
      iconType.includes('OFFICIAL_ARTIST_BADGE') ||
      iconType.includes('CHECK') ||
      tooltip.includes('verified') ||
      tooltip.includes('oficial')
    );
  });
  const isVevo = normalizedVChannel.includes('vevo');
  if (hasVerifiedBadge || isVevo) {
    badgeScore = 20;
  }

  let titleScore = 0;
  const titleTokens = normalizedCleanTitle
    .split(' ')
    .filter(
      (token) => token.length > 0 && !['the', 'a', 'an', 'and'].includes(token),
    );
  const vTitleTokens = normalizedVTitle
    .split(' ')
    .filter((token) => token.length > 0);

  const matchedTokensCount = titleTokens.filter((token) =>
    vTitleTokens.includes(token),
  ).length;
  const tokenOverlapRatio =
    titleTokens.length > 0 ? matchedTokensCount / titleTokens.length : 0;
  const phraseMatch =
    Boolean(normalizedCleanTitle) &&
    normalizedVTitle.includes(normalizedCleanTitle);

  if (phraseMatch || tokenOverlapRatio === 1) {
    titleScore = 35;
  } else if (tokenOverlapRatio >= 0.75) {
    titleScore = 25;
  } else if (tokenOverlapRatio >= 0.5) {
    titleScore = 15;
  }

  let officialPhraseScore = 0;
  const lowerVTitle = input.vTitle.toLowerCase();
  if (
    lowerVTitle.includes('official music video') ||
    lowerVTitle.includes('official video') ||
    lowerVTitle.includes('videoclip oficial') ||
    lowerVTitle.includes('video oficial')
  ) {
    officialPhraseScore = 35;
  } else if (
    lowerVTitle.includes('official') ||
    lowerVTitle.includes('oficial')
  ) {
    officialPhraseScore = 15;
  }

  const totalScore =
    artistScore + badgeScore + titleScore + officialPhraseScore;

  return {
    artistScore,
    titleScore,
    badgeScore,
    officialPhraseScore,
    totalScore,
  };
};

class MusicVideoService {
  private cache = new Map<string, OfficialVideoResult | null>();

  clearCache(): void {
    this.cache.clear();
  }

  async findOfficialVideo(track?: Track): Promise<OfficialVideoResult | null> {
    if (!track) {
      return null;
    }

    const artist = track.artists?.[0]?.name?.trim() || '';
    const title = track.title?.trim() || '';
    if (!title) {
      return null;
    }

    const cacheKey = `${artist} - ${title}`.toLowerCase();
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      const cleanTitle = cleanTrackTitle(title);
      const result = await this.searchYouTubeForOfficialVideo(
        track,
        artist,
        cleanTitle,
      );
      this.cache.set(cacheKey, result);
      return result;
    } catch (err) {
      Logger.streaming.warn(
        `MusicVideoService search failed for "${cacheKey}": ${err}`,
      );
      this.cache.set(cacheKey, null);
      return null;
    }
  }

  private async searchYouTubeForOfficialVideo(
    track: Track,
    artist: string,
    cleanTitle: string,
  ): Promise<OfficialVideoResult | null> {
    const tieredQueries = [
      `${artist} ${cleanTitle} official video`.trim(),
      `${artist} ${cleanTitle} official music video`.trim(),
    ];

    const uniqueQueries = Array.from(
      new Set(tieredQueries.filter((query) => query.length > 0)),
    );

    for (const query of uniqueQueries) {
      const bestCandidate = await this.executeYouTubeSearch(
        track,
        query,
        artist,
        cleanTitle,
      );
      if (bestCandidate && (bestCandidate.score ?? 0) >= MIN_CONFIDENCE_SCORE) {
        return bestCandidate;
      }
    }

    return null;
  }

  private async executeYouTubeSearch(
    track: Track,
    query: string,
    artist: string,
    cleanTitle: string,
  ): Promise<OfficialVideoResult | null> {
    const requestBody = {
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20240101.01.00',
          hl: 'en',
          gl: 'US',
        },
      },
      query,
    };

    const response = await httpHost.fetch(
      'https://www.youtube.com/youtubei/v1/search',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      },
    );

    if (response.status < 200 || response.status >= 300) {
      return null;
    }

    const data = JSON.parse(response.body);
    const primary =
      data.contents?.twoColumnSearchResultsRenderer?.primaryContents;
    const sections = primary?.sectionListRenderer?.contents || [];

    type YouTubeInnertubeItem = {
      videoRenderer?: {
        videoId?: string;
        title?: { runs?: Array<{ text?: string }> };
        ownerText?: { runs?: Array<{ text?: string }> };
        thumbnail?: { thumbnails?: Array<{ url?: string }> };
        lengthText?: { simpleText?: string };
        ownerBadges?: Array<{
          metadataBadgeRenderer?: {
            style?: string;
            icon?: { iconType?: string };
            tooltip?: string;
          };
        }>;
      };
    };

    const contents: YouTubeInnertubeItem[] = [];
    for (const section of sections) {
      if (section.itemSectionRenderer?.contents) {
        contents.push(...section.itemSectionRenderer.contents);
      }
    }

    if (
      contents.length === 0 &&
      primary?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents
    ) {
      contents.push(
        ...primary.sectionListRenderer.contents[0].itemSectionRenderer.contents,
      );
    }

    const candidates: Array<{
      videoId: string;
      title: string;
      channelTitle: string;
      thumbnailUrl?: string;
      score: number;
    }> = [];

    const trackDurationSec = track.durationMs
      ? Math.round(track.durationMs / 1000)
      : 0;

    for (const item of contents) {
      const vr = item.videoRenderer;
      if (!vr || !vr.videoId) {
        continue;
      }

      const videoId = vr.videoId;
      const vTitle = vr.title?.runs?.[0]?.text ?? '';
      const vChannel = vr.ownerText?.runs?.[0]?.text ?? '';
      const vThumb = vr.thumbnail?.thumbnails?.slice(-1)[0]?.url;

      const candidateDurationSec = parseDurationToSeconds(
        vr.lengthText?.simpleText,
      );
      if (candidateDurationSec === null) {
        continue;
      }

      if (
        candidateDurationSec < MIN_VIDEO_DURATION_SECONDS &&
        (trackDurationSec === 0 ||
          trackDurationSec >= MIN_VIDEO_DURATION_SECONDS)
      ) {
        continue;
      }

      if (trackDurationSec > 0) {
        const durationDiffSec = Math.abs(
          candidateDurationSec - trackDurationSec,
        );
        const durationDiffRatio = durationDiffSec / trackDurationSec;
        if (
          durationDiffSec > MAX_DURATION_DIFF_SECONDS ||
          durationDiffRatio > MAX_DURATION_DIFF_RATIO
        ) {
          continue;
        }
      }

      if (hasNoiseTerms(vTitle, vChannel, artist, cleanTitle)) {
        continue;
      }

      const scored = scoreCandidate({
        artist,
        cleanTitle,
        vTitle,
        vChannel,
        ownerBadges: vr.ownerBadges,
      });

      if (artist && scored.artistScore === 0) {
        continue;
      }

      if (cleanTitle && scored.titleScore === 0) {
        continue;
      }

      if (scored.totalScore < MIN_CONFIDENCE_SCORE) {
        continue;
      }

      candidates.push({
        videoId,
        title: vTitle,
        channelTitle: vChannel,
        thumbnailUrl: vThumb,
        score: scored.totalScore,
      });
    }

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort(
      (firstCandidate, secondCandidate) =>
        secondCandidate.score - firstCandidate.score,
    );
    const best = candidates[0];

    Logger.streaming.info(
      `MusicVideoService: Selected official video "${best.title}" (${best.videoId}) with score ${best.score}`,
    );

    return {
      videoId: best.videoId,
      title: best.title,
      channelTitle: best.channelTitle,
      thumbnailUrl: best.thumbnailUrl,
      score: best.score,
    };
  }
}

export const musicVideoService = new MusicVideoService();
