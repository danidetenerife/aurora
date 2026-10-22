import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Track } from '@aurora/model';

import { httpHost } from './httpHost';
import {
  cleanTrackTitle,
  hasNoiseTerms,
  isNoiseMatch,
  MIN_CONFIDENCE_SCORE,
  musicVideoService,
  parseDurationToSeconds,
  scoreCandidate,
} from './musicVideoService';

vi.mock('./httpHost', () => ({
  httpHost: {
    fetch: vi.fn(),
  },
}));

const createSearchResponse = (
  items: Array<{
    videoId: string;
    title: string;
    channelTitle: string;
    durationText?: string;
    ownerBadges?: Array<{
      metadataBadgeRenderer?: {
        style?: string;
        icon?: { iconType?: string };
        tooltip?: string;
      };
    }>;
  }>,
) => {
  return {
    status: 200,
    body: JSON.stringify({
      contents: {
        twoColumnSearchResultsRenderer: {
          primaryContents: {
            sectionListRenderer: {
              contents: [
                {
                  itemSectionRenderer: {
                    contents: items.map((item) => ({
                      videoRenderer: {
                        videoId: item.videoId,
                        title: { runs: [{ text: item.title }] },
                        ownerText: { runs: [{ text: item.channelTitle }] },
                        lengthText: item.durationText
                          ? { simpleText: item.durationText }
                          : undefined,
                        thumbnail: {
                          thumbnails: [
                            { url: `https://i.ytimg.com/${item.videoId}.jpg` },
                          ],
                        },
                        ownerBadges: item.ownerBadges,
                      },
                    })),
                  },
                },
              ],
            },
          },
        },
      },
    }),
  };
};

describe('musicVideoService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    musicVideoService.clearCache();
  });

  describe('utility functions', () => {
    it('parses duration strings accurately into seconds', () => {
      expect(parseDurationToSeconds('3:45')).toBe(225);
      expect(parseDurationToSeconds('0:30')).toBe(30);
      expect(parseDurationToSeconds('1:02:15')).toBe(3735);
      expect(parseDurationToSeconds('45')).toBe(45);
      expect(parseDurationToSeconds(undefined)).toBeNull();
      expect(parseDurationToSeconds('')).toBeNull();
      expect(parseDurationToSeconds('invalid:format')).toBeNull();
    });

    it('cleans track titles by removing metadata parentheticals', () => {
      expect(
        cleanTrackTitle('Levitating (feat. DaBaby) (Official Music Video)'),
      ).toBe('Levitating');
      expect(cleanTrackTitle('Song Name [Official Video]')).toBe('Song Name');
      expect(cleanTrackTitle('Remastered [2021 Remastered]')).toBe(
        'Remastered',
      );
      expect(cleanTrackTitle('Pure Title')).toBe('Pure Title');
    });

    it('detects noise terms with word boundaries', () => {
      expect(isNoiseMatch('Reaction to track', 'reaction')).toBe(true);
      expect(isNoiseMatch('10 Hours Loop version', '10 hours')).toBe(true);
      expect(isNoiseMatch('Sloop John B', 'loop')).toBe(false);
      expect(isNoiseMatch('Song #shorts dance', '#shorts')).toBe(true);
      expect(isNoiseMatch('Clean Official Video', 'parody')).toBe(false);
    });

    it('exempts noise terms when they are part of artist or track title', () => {
      expect(
        hasNoiseTerms('BTS - Butter (Official Video)', 'BTS', 'BTS', 'Butter'),
      ).toBe(false);
      expect(
        hasNoiseTerms(
          'Dua Lipa - Levitating Behind the Scenes BTS',
          'FanChannel',
          'Dua Lipa',
          'Levitating',
        ),
      ).toBe(true);
    });
  });

  describe('anti-noise filtering', () => {
    const baseTrack: Track = {
      title: 'Levitating',
      artists: [{ name: 'Dua Lipa', roles: [] }],
      source: { provider: 'test', id: 'track-1' },
      durationMs: 203000,
    };

    it('rejects reaction videos', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'reaction-vid-1',
            title:
              'American REACTS to Dua Lipa - Levitating (Official Music Video) REACTION',
            channelTitle: 'ReactorsTV',
            durationText: '12:45',
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(baseTrack);
      expect(result).toBeNull();
    });

    it('rejects parody videos', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'parody-vid-1',
            title: 'Dua Lipa - Levitating (PARODY)',
            channelTitle: 'ComedyMusic',
            durationText: '3:20',
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(baseTrack);
      expect(result).toBeNull();
    });

    it('rejects gameplay and montage videos', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'gameplay-vid-1',
            title: 'Dua Lipa - Levitating (Roblox Gameplay Montage)',
            channelTitle: 'GamerZone',
            durationText: '3:23',
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(baseTrack);
      expect(result).toBeNull();
    });

    it('rejects 1-hour loops and compilations', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'loop-vid-1',
            title: 'Dua Lipa - Levitating (1 Hour Loop)',
            channelTitle: 'RelaxLoops',
            durationText: '1:00:00',
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(baseTrack);
      expect(result).toBeNull();
    });

    it('rejects shorts and meme versions', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'shorts-vid-1',
            title: 'Levitating viral dance #shorts',
            channelTitle: 'ShortsDaily',
            durationText: '0:35',
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(baseTrack);
      expect(result).toBeNull();
    });

    it('rejects tutorial and guitar tab videos', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'tutorial-vid-1',
            title: 'How to play Levitating on Guitar (Guitar Tab Chords)',
            channelTitle: 'GuitarTeacher',
            durationText: '8:15',
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(baseTrack);
      expect(result).toBeNull();
    });
  });

  describe('duration verification', () => {
    const standardTrack: Track = {
      title: 'Blinding Lights',
      artists: [{ name: 'The Weeknd', roles: [] }],
      source: { provider: 'test', id: 'track-bl' },
      durationMs: 200000,
    };

    it('rejects videos shorter than 45 seconds', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'short-teaser',
            title: 'The Weeknd - Blinding Lights (Official Video Teaser)',
            channelTitle: 'TheWeekndVEVO',
            durationText: '0:25',
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(standardTrack);
      expect(result).toBeNull();
    });

    it('rejects videos whose duration deviates significantly from track duration', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'deviant-duration',
            title: 'The Weeknd - Blinding Lights (Official Music Video)',
            channelTitle: 'TheWeekndVEVO',
            durationText: '7:30',
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(standardTrack);
      expect(result).toBeNull();
    });

    it('accepts videos whose duration matches track within acceptable margin', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'matching-duration',
            title: 'The Weeknd - Blinding Lights (Official Music Video)',
            channelTitle: 'TheWeekndVEVO',
            durationText: '3:45',
            ownerBadges: [
              {
                metadataBadgeRenderer: {
                  style: 'BADGE_STYLE_TYPE_VERIFIED_ARTIST',
                },
              },
            ],
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(standardTrack);
      expect(result).not.toBeNull();
      expect(result?.videoId).toBe('matching-duration');
    });
  });

  describe('candidate scoring and confidence threshold', () => {
    const radioheadTrack: Track = {
      title: 'Karma Police',
      artists: [{ name: 'Radiohead', roles: [] }],
      source: { provider: 'test', id: 'rh-kp' },
      durationMs: 261000,
    };

    it('returns null when search results do not meet minimum confidence score', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'low-conf-1',
            title: 'Radiohead fan clip',
            channelTitle: 'RandomUser123',
            durationText: '4:20',
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(radioheadTrack);
      expect(result).toBeNull();
    });

    it('returns null when candidates do not match artist or track title', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'unrelated-official',
            title: 'Coldplay - Yellow (Official Music Video)',
            channelTitle: 'ColdplayVEVO',
            durationText: '4:29',
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(radioheadTrack);
      expect(result).toBeNull();
    });

    it('accepts authentic artist video with official badges and high score', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'radiohead-official-kp',
            title: 'Radiohead - Karma Police (Official Video)',
            channelTitle: 'Radiohead',
            durationText: '4:23',
            ownerBadges: [
              {
                metadataBadgeRenderer: {
                  style: 'BADGE_STYLE_TYPE_VERIFIED_ARTIST',
                },
              },
            ],
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(radioheadTrack);
      expect(result).not.toBeNull();
      expect(result?.videoId).toBe('radiohead-official-kp');
      expect((result?.score ?? 0) >= MIN_CONFIDENCE_SCORE).toBe(true);
    });

    it('accepts record label uploads where artist name is in the video title rather than channel name', async () => {
      const topTrack: Track = {
        title: 'Stressed Out',
        artists: [{ name: 'Twenty One Pilots', roles: [] }],
        source: { provider: 'test', id: 'top-so' },
        durationMs: 202000,
      };

      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'top-stressed-out-vid',
            title: 'twenty one pilots: Stressed Out [OFFICIAL VIDEO]',
            channelTitle: 'Fueled By Ramen',
            durationText: '3:45',
            ownerBadges: [
              {
                metadataBadgeRenderer: {
                  style: 'BADGE_STYLE_TYPE_VERIFIED',
                },
              },
            ],
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(topTrack);
      expect(result).not.toBeNull();
      expect(result?.videoId).toBe('top-stressed-out-vid');
      expect((result?.score ?? 0) >= MIN_CONFIDENCE_SCORE).toBe(true);
    });
  });

  describe('tiered search query fallback', () => {
    const track: Track = {
      title: 'Houdini',
      artists: [{ name: 'Dua Lipa', roles: [] }],
      source: { provider: 'test', id: 'dl-h' },
      durationMs: 185000,
    };

    it('falls back to tiered query when first query yields no high confidence candidate', async () => {
      vi.mocked(httpHost.fetch)
        .mockResolvedValueOnce(createSearchResponse([]))
        .mockResolvedValueOnce(
          createSearchResponse([
            {
              videoId: 'houdini-tier2',
              title: 'Dua Lipa - Houdini (Official Music Video)',
              channelTitle: 'Dua Lipa',
              durationText: '3:10',
              ownerBadges: [
                {
                  metadataBadgeRenderer: {
                    icon: { iconType: 'OFFICIAL_ARTIST_BADGE' },
                  },
                },
              ],
            },
          ]),
        );

      const result = await musicVideoService.findOfficialVideo(track);
      expect(result).not.toBeNull();
      expect(result?.videoId).toBe('houdini-tier2');
      expect(httpHost.fetch).toHaveBeenCalledTimes(2);

      const firstCallBody = JSON.parse(
        vi.mocked(httpHost.fetch).mock.calls[0][1]?.body as string,
      );
      expect(firstCallBody.context.client.hl).toBe('en');
      expect(firstCallBody.context.client.gl).toBe('US');
      expect(firstCallBody.query).toBe('Dua Lipa Houdini official video');

      const secondCallBody = JSON.parse(
        vi.mocked(httpHost.fetch).mock.calls[1][1]?.body as string,
      );
      expect(secondCallBody.query).toBe(
        'Dua Lipa Houdini official music video',
      );
    });
  });

  describe('scoreCandidate scoring breakdown', () => {
    it('evaluates artist, badge, title and phrase weights accurately', () => {
      const fullScore = scoreCandidate({
        artist: 'Dua Lipa',
        cleanTitle: 'Levitating',
        vTitle: 'Dua Lipa - Levitating (Official Music Video)',
        vChannel: 'Dua Lipa',
        ownerBadges: [
          {
            metadataBadgeRenderer: {
              style: 'BADGE_STYLE_TYPE_VERIFIED_ARTIST',
            },
          },
        ],
      });

      expect(fullScore.artistScore).toBe(35);
      expect(fullScore.badgeScore).toBe(20);
      expect(fullScore.titleScore).toBe(35);
      expect(fullScore.officialPhraseScore).toBe(35);
      expect(fullScore.totalScore).toBe(125);

      const amateurCoverScore = scoreCandidate({
        artist: 'The Weeknd',
        cleanTitle: 'Blinding Lights',
        vTitle: 'The Weeknd - Blinding Lights (por Pedrito de Cuenca)',
        vChannel: 'Pedrito de Cuenca',
      });
      expect(amateurCoverScore.artistScore).toBe(0);
    });
  });
});
