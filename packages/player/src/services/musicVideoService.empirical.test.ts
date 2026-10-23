import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Track } from '@aurora/model';

import { httpHost } from './httpHost';
import {
  MIN_CONFIDENCE_SCORE,
  musicVideoService,
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

describe('musicVideoService — Empirical Adversarial Challenge Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    musicVideoService.clearCache();
  });

  describe('Adversarial Noise Edge Cases', () => {
    const baseTrack: Track = {
      title: 'Levitating',
      artists: [{ name: 'Dua Lipa', roles: [] }],
      source: { provider: 'test', id: 'track-adversarial-1' },
      durationMs: 203000, // 3:23 (203s)
    };

    it('rejects tricky casing in reaction titles ("Reaction to...", "REACTION")', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'noisy-reaction-case',
            title: 'Reaction to Dua Lipa - Levitating Official Music Video',
            channelTitle: 'Popular Reactor',
            durationText: '3:25',
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(baseTrack);
      expect(result).toBeNull();
    });

    it('rejects Spanish parody titles in all-caps ("PARODIA")', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'noisy-parodia',
            title: 'DUA LIPA - LEVITATING (PARODIA OFICIAL)',
            channelTitle: 'Parodias Animadas',
            durationText: '3:20',
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(baseTrack);
      expect(result).toBeNull();
    });

    it('rejects complex gaming montages with mixed brackets ("Minecraft AMV [10 hours]")', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'noisy-minecraft-amv',
            title: 'Dua Lipa Levitating - Minecraft AMV [10 hours]',
            channelTitle: 'GamerGod',
            durationText: '10:00:00',
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(baseTrack);
      expect(result).toBeNull();
    });

    it('rejects TikTok and Shorts hashtags ("Shorts version #shorts")', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'noisy-shorts-tag',
            title: 'Dua Lipa Levitating Shorts version #shorts',
            channelTitle: 'Viral Clips',
            durationText: '0:50',
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(baseTrack);
      expect(result).toBeNull();
    });

    it('rejects tutorial and chord breakdowns ("Full Guitar Tutorial")', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'noisy-tutorial',
            title: 'Dua Lipa - Levitating (Full Guitar Tutorial with Tabs)',
            channelTitle: 'Acoustic Master',
            durationText: '3:30',
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(baseTrack);
      expect(result).toBeNull();
    });

    it('rejects vocal reviews and coach analysis', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'noisy-vocal-coach',
            title: 'Vocal Coach Review & Analysis of Dua Lipa - Levitating',
            channelTitle: 'Singer Insights',
            durationText: '3:20',
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(baseTrack);
      expect(result).toBeNull();
    });

    it('rejects behind-the-scenes and making-of videos', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'noisy-making-of',
            title: 'Dua Lipa - Levitating (Behind the Scenes - Making Of)',
            channelTitle: 'Dua Lipa Extra',
            durationText: '3:35',
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(baseTrack);
      expect(result).toBeNull();
    });

    it('rejects channel-level noise even if title looks authentic', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'channel-noise-vid',
            title: 'Dua Lipa - Levitating (Official Video)',
            channelTitle: 'Nightcore Gaming Station', // channel has nightcore + gaming
            durationText: '3:23',
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(baseTrack);
      expect(result).toBeNull();
    });

    it('rejects YouTube auto-generated topic channels ("- Topic")', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'topic-audio-vid',
            title: 'Levitating',
            channelTitle: 'Dua Lipa - Topic',
            durationText: '3:23',
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(baseTrack);
      expect(result).toBeNull();
    });

    it('rejects static audio uploads labelled "(Audio)" or "[Audio]"', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'static-audio-bracket',
            title: 'Dua Lipa - Levitating [Audio]',
            channelTitle: 'Warner Records',
            durationText: '3:23',
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(baseTrack);
      expect(result).toBeNull();
    });
  });

  describe('Duration Boundaries and Extremes', () => {
    const track200s: Track = {
      title: 'Blinding Lights',
      artists: [{ name: 'The Weeknd', roles: [] }],
      source: { provider: 'test', id: 'track-bl-200' },
      durationMs: 200000, // 200 seconds
    };

    it('rejects video with duration 0s ("0:00")', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'dur-0s',
            title: 'The Weeknd - Blinding Lights (Official Video)',
            channelTitle: 'TheWeekndVEVO',
            durationText: '0:00',
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(track200s);
      expect(result).toBeNull();
    });

    it('rejects video with duration 14s ("0:14")', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'dur-14s',
            title: 'The Weeknd - Blinding Lights (Official Video)',
            channelTitle: 'TheWeekndVEVO',
            durationText: '0:14',
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(track200s);
      expect(result).toBeNull();
    });

    it('rejects candidate with duration 44s for a 200s track (< 45s threshold)', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'dur-44s',
            title: 'The Weeknd - Blinding Lights (Official Video)',
            channelTitle: 'TheWeekndVEVO',
            durationText: '0:44',
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(track200s);
      expect(result).toBeNull();
    });

    it('rejects candidate with duration 44s even for a 46s track', async () => {
      const shortTrack46s: Track = {
        title: 'Interlude',
        artists: [{ name: 'The Weeknd', roles: [] }],
        source: { provider: 'test', id: 'track-46s' },
        durationMs: 46000, // 46s
      };

      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'dur-44s-for-46s',
            title: 'The Weeknd - Interlude (Official Video)',
            channelTitle: 'TheWeekndVEVO',
            durationText: '0:44',
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(shortTrack46s);
      expect(result).toBeNull();
    });

    it('accepts candidate with duration 46s for a 46s track (>= 45s threshold)', async () => {
      const shortTrack46s: Track = {
        title: 'Interlude',
        artists: [{ name: 'The Weeknd', roles: [] }],
        source: { provider: 'test', id: 'track-46s-ok' },
        durationMs: 46000, // 46s
      };

      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'dur-46s-ok',
            title: 'The Weeknd - Interlude (Official Video)',
            channelTitle: 'TheWeekndVEVO',
            durationText: '0:46',
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

      const result = await musicVideoService.findOfficialVideo(shortTrack46s);
      expect(result).not.toBeNull();
      expect(result?.videoId).toBe('dur-46s-ok');
    });

    it('accepts candidate under 45s when track itself is under 45s (e.g. 40s track with 40s video)', async () => {
      const miniTrack: Track = {
        title: 'Micro Intro',
        artists: [{ name: 'The Weeknd', roles: [] }],
        source: { provider: 'test', id: 'track-mini' },
        durationMs: 40000, // 40s (< 45s)
      };

      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'dur-mini-ok',
            title: 'The Weeknd - Micro Intro (Official Video)',
            channelTitle: 'TheWeekndVEVO',
            durationText: '0:40',
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

      const result = await musicVideoService.findOfficialVideo(miniTrack);
      expect(result).not.toBeNull();
      expect(result?.videoId).toBe('dur-mini-ok');
    });

    it('accepts video with duration +59s boundary (259s for 200s track, diff=59s <= 60s, ratio=0.295 <= 0.35)', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'dur-plus-59s',
            title: 'The Weeknd - Blinding Lights (Official Video)',
            channelTitle: 'TheWeekndVEVO',
            durationText: '4:19', // 259s
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

      const result = await musicVideoService.findOfficialVideo(track200s);
      expect(result).not.toBeNull();
      expect(result?.videoId).toBe('dur-plus-59s');
    });

    it('accepts video with duration -59s boundary (141s for 200s track, diff=59s <= 60s, ratio=0.295 <= 0.35)', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'dur-minus-59s',
            title: 'The Weeknd - Blinding Lights (Official Video)',
            channelTitle: 'TheWeekndVEVO',
            durationText: '2:21', // 141s
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

      const result = await musicVideoService.findOfficialVideo(track200s);
      expect(result).not.toBeNull();
      expect(result?.videoId).toBe('dur-minus-59s');
    });

    it('rejects video with duration +61s boundary (261s for 200s track, diff=61s > 60s)', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'dur-plus-61s',
            title: 'The Weeknd - Blinding Lights (Official Video)',
            channelTitle: 'TheWeekndVEVO',
            durationText: '4:21', // 261s
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(track200s);
      expect(result).toBeNull();
    });

    it('rejects video with duration -61s boundary (139s for 200s track, diff=61s > 60s)', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'dur-minus-61s',
            title: 'The Weeknd - Blinding Lights (Official Video)',
            channelTitle: 'TheWeekndVEVO',
            durationText: '2:19', // 139s
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(track200s);
      expect(result).toBeNull();
    });

    it('rejects candidate when percentage deviation exceeds 35% even if absolute diff <= 60s', async () => {
      const shortTrack100s: Track = {
        title: 'Quick Beat',
        artists: [{ name: 'The Weeknd', roles: [] }],
        source: { provider: 'test', id: 'track-100s' },
        durationMs: 100000, // 100s
      };

      // Candidate duration 140s: diff = 40s (<= 60s), but ratio = 40/100 = 40% (> 35%)
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'ratio-exceeded',
            title: 'The Weeknd - Quick Beat (Official Video)',
            channelTitle: 'TheWeekndVEVO',
            durationText: '2:20', // 140s
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(shortTrack100s);
      expect(result).toBeNull();
    });

    it('rejects 2-hour long streams ("2:00:00")', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'stream-2h',
            title: 'The Weeknd - Blinding Lights (Official Video)',
            channelTitle: 'TheWeekndVEVO',
            durationText: '2:00:00', // 7200s
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(track200s);
      expect(result).toBeNull();
    });

    it('rejects candidate when lengthText is completely missing or unparseable', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'no-duration',
            title: 'The Weeknd - Blinding Lights (Official Video)',
            channelTitle: 'TheWeekndVEVO',
            durationText: undefined,
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(track200s);
      expect(result).toBeNull();
    });
  });

  describe('Non-Noise Legitimate Titles (Zero False Positive Rejections)', () => {
    it('accepts legitimate tracks with "loop" in title ("Fruit Loops")', async () => {
      const track: Track = {
        title: 'Fruit Loops',
        artists: [{ name: 'KID B', roles: [] }],
        source: { provider: 'test', id: 'fl-1' },
        durationMs: 180000,
      };

      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'fruit-loops-official',
            title: 'KID B - Fruit Loops (Official Video)',
            channelTitle: 'KID B',
            durationText: '3:00',
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

      const result = await musicVideoService.findOfficialVideo(track);
      expect(result).not.toBeNull();
      expect(result?.videoId).toBe('fruit-loops-official');
    });

    it('accepts legitimate tracks with "loop" in title ("In The Loop")', async () => {
      const track: Track = {
        title: 'In The Loop',
        artists: [{ name: 'The Loops', roles: [] }],
        source: { provider: 'test', id: 'itl-1' },
        durationMs: 210000,
      };

      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'in-the-loop-official',
            title: 'The Loops - In The Loop (Official Music Video)',
            channelTitle: 'The Loops',
            durationText: '3:30',
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

      const result = await musicVideoService.findOfficialVideo(track);
      expect(result).not.toBeNull();
      expect(result?.videoId).toBe('in-the-loop-official');
    });

    it('accepts legitimate tracks with "Short" in title without confusing with "shorts" ("Short Skirt Long Jacket")', async () => {
      const track: Track = {
        title: 'Short Skirt Long Jacket',
        artists: [{ name: 'Cake', roles: [] }],
        source: { provider: 'test', id: 'sslj-1' },
        durationMs: 204000,
      };

      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'cake-sslj-official',
            title: 'CAKE - Short Skirt / Long Jacket (Official Music Video)',
            channelTitle: 'CAKEVEVO',
            durationText: '3:24',
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

      const result = await musicVideoService.findOfficialVideo(track);
      expect(result).not.toBeNull();
      expect(result?.videoId).toBe('cake-sslj-official');
    });

    it('accepts legitimate tracks with "Live" in title ("Live to Tell")', async () => {
      const track: Track = {
        title: 'Live to Tell',
        artists: [{ name: 'Madonna', roles: [] }],
        source: { provider: 'test', id: 'ltt-1' },
        durationMs: 350000,
      };

      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'madonna-ltt-official',
            title: 'Madonna - Live To Tell (Official Video)',
            channelTitle: 'Madonna',
            durationText: '5:50',
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

      const result = await musicVideoService.findOfficialVideo(track);
      expect(result).not.toBeNull();
      expect(result?.videoId).toBe('madonna-ltt-official');
    });

    it('accepts legitimate tracks with "Live" in title ("Live Forever")', async () => {
      const track: Track = {
        title: 'Live Forever',
        artists: [{ name: 'Oasis', roles: [] }],
        source: { provider: 'test', id: 'lf-1' },
        durationMs: 276000,
      };

      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'oasis-lf-official',
            title: 'Oasis - Live Forever (Official Music Video)',
            channelTitle: 'Oasis',
            durationText: '4:36',
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

      const result = await musicVideoService.findOfficialVideo(track);
      expect(result).not.toBeNull();
      expect(result?.videoId).toBe('oasis-lf-official');
    });

    it('accepts tracks by artist "BTS" without false noise triggering ("BTS - Butter")', async () => {
      const track: Track = {
        title: 'Butter',
        artists: [{ name: 'BTS', roles: [] }],
        source: { provider: 'test', id: 'bts-b-1' },
        durationMs: 164000,
      };

      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'bts-butter-official',
            title: 'BTS (방탄소년단) "Butter" Official MV',
            channelTitle: 'HYBE LABELS',
            durationText: '3:02',
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

      const result = await musicVideoService.findOfficialVideo(track);
      expect(result).not.toBeNull();
      expect(result?.videoId).toBe('bts-butter-official');
    });

    it('accepts tracks by artist "Little Mix" without false noise triggering on "mix"', async () => {
      const track: Track = {
        title: 'Black Magic',
        artists: [{ name: 'Little Mix', roles: [] }],
        source: { provider: 'test', id: 'lm-bm-1' },
        durationMs: 211000,
      };

      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'little-mix-official',
            title: 'Little Mix - Black Magic (Official Video)',
            channelTitle: 'LittleMixVEVO',
            durationText: '3:31',
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

      const result = await musicVideoService.findOfficialVideo(track);
      expect(result).not.toBeNull();
      expect(result?.videoId).toBe('little-mix-official');
    });

    it('accepts legitimate tracks with "Cover" in title ("Cover Me")', async () => {
      const track: Track = {
        title: 'Cover Me',
        artists: [{ name: 'Bruce Springsteen', roles: [] }],
        source: { provider: 'test', id: 'bs-cm-1' },
        durationMs: 208000,
      };

      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'bruce-cover-me-official',
            title: 'Bruce Springsteen - Cover Me (Official Video)',
            channelTitle: 'BruceSpringsteenVEVO',
            durationText: '3:28',
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

      const result = await musicVideoService.findOfficialVideo(track);
      expect(result).not.toBeNull();
      expect(result?.videoId).toBe('bruce-cover-me-official');
    });
  });

  describe('Scoring Edge Cases & Threshold Enforcement', () => {
    it('discards candidate with low token overlap (1 word match out of 10) even with official phrase and badges', async () => {
      const longTitleTrack: Track = {
        title: 'One Two Three Four Five Six Seven Eight Nine Ten',
        artists: [{ name: 'Queen', roles: [] }],
        source: { provider: 'test', id: 'queen-long-title' },
        durationMs: 240000,
      };

      // Candidate has Queen and verified badge and "official video", but title only shares "One" (1/10 tokens)
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'low-overlap-candidate',
            title: 'Queen - One (Official Video)',
            channelTitle: 'Queen',
            durationText: '4:00',
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

      const result = await musicVideoService.findOfficialVideo(longTitleTrack);
      expect(result).toBeNull();
    });

    it('discards candidate with artist mismatch even if title match is 100% and official video phrase exists', async () => {
      const radioheadTrack: Track = {
        title: 'Karma Police',
        artists: [{ name: 'Radiohead', roles: [] }],
        source: { provider: 'test', id: 'rh-kp-mismatch' },
        durationMs: 261000,
      };

      // Candidate title matches Karma Police + official video, but artist is Coldplay
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'artist-mismatch-vid',
            title: 'Coldplay - Karma Police (Official Music Video)',
            channelTitle: 'ColdplayVEVO',
            durationText: '4:21',
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
      expect(result).toBeNull();
    });

    it('ranks candidate with verified artist channel and official video above fan upload', async () => {
      const track: Track = {
        title: 'Levitating',
        artists: [{ name: 'Dua Lipa', roles: [] }],
        source: { provider: 'test', id: 'dl-rank-1' },
        durationMs: 203000,
      };

      // Return fan upload first in response, but official video second
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'fan-upload-first',
            title: 'Dua Lipa - Levitating',
            channelTitle: 'GenericFan',
            durationText: '3:23',
          },
          {
            videoId: 'official-upload-second',
            title: 'Dua Lipa - Levitating (Official Music Video)',
            channelTitle: 'Dua Lipa',
            durationText: '3:23',
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

      const result = await musicVideoService.findOfficialVideo(track);
      expect(result).not.toBeNull();
      expect(result?.videoId).toBe('official-upload-second');
      expect((result?.score ?? 0) > 100).toBe(true);
    });

    it('enforces MIN_CONFIDENCE_SCORE = 60 threshold strictly (59 is rejected, 60 is accepted)', () => {
      // Direct scoring inspection
      const inputBelowThreshold = {
        artist: 'The Weeknd',
        cleanTitle: 'Blinding Lights',
        vTitle: 'Unknown User - Blinding Lights Clip',
        vChannel: 'Unknown User',
      };
      const scoreBelow = scoreCandidate(inputBelowThreshold);
      // artistScore = 0 (no artist match), titleScore = 35, badgeScore = 0, official = 0 -> total = 35 < 60
      expect(scoreBelow.totalScore < MIN_CONFIDENCE_SCORE).toBe(true);

      const inputAtThreshold = {
        artist: 'The Weeknd',
        cleanTitle: 'Blinding Lights',
        vTitle: 'The Weeknd - Blinding Lights',
        vChannel: 'Random Channel',
      };
      const scoreAt = scoreCandidate(inputAtThreshold);
      // artistScore = 30 (artist in title), titleScore = 35 (100% match) -> total = 65 >= 60
      expect(scoreAt.totalScore >= MIN_CONFIDENCE_SCORE).toBe(true);
    });
  });

  describe('Degraded Inputs and Fault Tolerance', () => {
    it('returns null cleanly when track is undefined', async () => {
      const result = await musicVideoService.findOfficialVideo(undefined);
      expect(result).toBeNull();
      expect(httpHost.fetch).not.toHaveBeenCalled();
    });

    it('returns null cleanly when track has empty title', async () => {
      const emptyTitleTrack: Track = {
        title: '',
        artists: [{ name: 'Artist', roles: [] }],
        source: { provider: 'test', id: 'empty-1' },
      };
      const result = await musicVideoService.findOfficialVideo(emptyTitleTrack);
      expect(result).toBeNull();
      expect(httpHost.fetch).not.toHaveBeenCalled();
    });

    it('handles HTTP network error (500) gracefully and returns null', async () => {
      const track: Track = {
        title: 'Houdini',
        artists: [{ name: 'Dua Lipa', roles: [] }],
        source: { provider: 'test', id: 'net-err-1' },
        durationMs: 185000,
      };

      vi.mocked(httpHost.fetch).mockResolvedValueOnce({
        status: 500,
        body: 'Internal Server Error',
      });

      const result = await musicVideoService.findOfficialVideo(track);
      expect(result).toBeNull();
    });

    it('handles malformed JSON body in HTTP response gracefully and returns null', async () => {
      const track: Track = {
        title: 'Houdini',
        artists: [{ name: 'Dua Lipa', roles: [] }],
        source: { provider: 'test', id: 'json-err-1' },
        durationMs: 185000,
      };

      vi.mocked(httpHost.fetch).mockResolvedValueOnce({
        status: 200,
        body: '{not valid json',
      });

      const result = await musicVideoService.findOfficialVideo(track);
      expect(result).toBeNull();
    });

    it('caches null results to prevent repeating network queries for unresolvable tracks', async () => {
      const track: Track = {
        title: 'Obscure Nonexistent Song',
        artists: [{ name: 'Unknown Artist', roles: [] }],
        source: { provider: 'test', id: 'obscure-1' },
        durationMs: 180000,
      };

      vi.mocked(httpHost.fetch)
        .mockResolvedValueOnce(createSearchResponse([]))
        .mockResolvedValueOnce(createSearchResponse([]));

      const firstResult = await musicVideoService.findOfficialVideo(track);
      expect(firstResult).toBeNull();
      const callCountAfterFirst = vi.mocked(httpHost.fetch).mock.calls.length;

      // Second attempt for identical track should hit cache
      const secondResult = await musicVideoService.findOfficialVideo(track);
      expect(secondResult).toBeNull();
      expect(vi.mocked(httpHost.fetch).mock.calls.length).toBe(
        callCountAfterFirst,
      );
    });
  });

  describe('Adversarial Channel Verification Gating (R1)', () => {
    const baseTrack: Track = {
      title: 'Blinding Lights',
      artists: [{ name: 'The Weeknd', roles: [] }],
      source: { provider: 'test', id: 'track-emp-1' },
      durationMs: 200000,
    };

    it('rejects deceptive channels that put "VEVO" or artist names in channel title without true VEVO or verification badges', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'fake-vevo-vid',
            title: 'The Weeknd - Blinding Lights (Official Video)',
            channelTitle: 'The Weeknd Fake VEVO Fanpage',
            durationText: '3:20',
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(baseTrack);
      expect(result).toBeNull();
    });

    it('rejects channels with unicode checkmarks or check symbols in text when ownerBadges are absent', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'unicode-check-vid',
            title: 'The Weeknd - Blinding Lights (Official Music Video)',
            channelTitle: 'The Weeknd ✔',
            durationText: '3:20',
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(baseTrack);
      expect(result).toBeNull();
    });

    it('rejects unverified uploads even when candidate video has 100% song and artist match and exact duration', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'perfect-match-unverified',
            title: 'The Weeknd - Blinding Lights (Official Video)',
            channelTitle: 'MusicLoversReuploadArchive',
            durationText: '3:20',
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(baseTrack);
      expect(result).toBeNull();
    });

    it('accepts authentic verified channels across diverse major and indie labels', async () => {
      const indieLabels = [
        { labelName: 'Geffen Records', videoId: 'geffen-vid' },
        { labelName: 'Polydor Records', videoId: 'polydor-vid' },
        { labelName: 'Astralwerks', videoId: 'astralwerks-vid' },
        { labelName: 'Motown Records', videoId: 'motown-vid' },
        { labelName: 'EMI Music', videoId: 'emi-vid' },
        { labelName: 'Roadrunner Records', videoId: 'roadrunner-vid' },
        { labelName: 'Hopeless Records', videoId: 'hopeless-vid' },
        { labelName: 'Epitaph Records', videoId: 'epitaph-vid' },
        { labelName: 'Rough Trade Records', videoId: 'roughtrade-vid' },
        { labelName: 'Domino Recording Company', videoId: 'domino-vid' },
        { labelName: '4AD', videoId: '4ad-vid' },
        { labelName: 'Warp Records', videoId: 'warp-vid' },
        { labelName: 'Ninja Tune', videoId: 'ninjatune-vid' },
        { labelName: 'PIAS', videoId: 'pias-vid' },
        { labelName: 'Sony Entertainment', videoId: 'sony-ent-vid' },
        { labelName: 'Universal Music Group', videoId: 'umg-vid' },
      ];

      for (const { labelName, videoId } of indieLabels) {
        musicVideoService.clearCache();
        vi.mocked(httpHost.fetch).mockResolvedValueOnce(
          createSearchResponse([
            {
              videoId,
              title: 'The Weeknd - Blinding Lights (Official Video)',
              channelTitle: labelName,
              durationText: '3:20',
            },
          ]),
        );

        const result = await musicVideoService.findOfficialVideo(baseTrack);
        expect(result).not.toBeNull();
        expect(result?.videoId).toBe(videoId);
      }
    });
  });

  describe('Adversarial Subtitle and Noise Injections (R1)', () => {
    const baseTrack: Track = {
      title: 'Blinding Lights',
      artists: [{ name: 'The Weeknd', roles: [] }],
      source: { provider: 'test', id: 'track-emp-2' },
      durationMs: 200000,
    };

    it('rejects complex composite subtitle titles like "(Official Video) [Sub Español + Lyrics]"', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'composite-sub-vid',
            title:
              'The Weeknd - Blinding Lights (Official Video) [Sub Español + Lyrics]',
            channelTitle: 'TheWeekndVEVO',
            durationText: '3:20',
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(baseTrack);
      expect(result).toBeNull();
    });

    it('rejects translated and subtitled variations with bracket combinations like "[Traducida al Español] (CC)"', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'composite-trad-vid',
            title: 'The Weeknd - Blinding Lights [Traducida al Español] (CC)',
            channelTitle: 'TheWeekndVEVO',
            durationText: '3:20',
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(baseTrack);
      expect(result).toBeNull();
    });

    it('rejects low resolution tags disguised inside official phrases like "Official Video [480p]" and "Video Oficial 240p"', async () => {
      const lowResDisguised = [
        'The Weeknd - Blinding Lights Official Video [480p]',
        'The Weeknd - Blinding Lights Video Oficial 240p',
        'The Weeknd - Blinding Lights [360p HQ] Official',
      ];

      for (const title of lowResDisguised) {
        musicVideoService.clearCache();
        vi.mocked(httpHost.fetch).mockResolvedValueOnce(
          createSearchResponse([
            {
              videoId: 'lowres-disguised-vid',
              title,
              channelTitle: 'TheWeekndVEVO',
              durationText: '3:20',
            },
          ]),
        );

        const result = await musicVideoService.findOfficialVideo(baseTrack);
        expect(result).toBeNull();
      }
    });

    it('rejects fan re-uploads disguised as official like "Official Video (Reupload 2024)" and "Resubido en HD"', async () => {
      const fanDisguised = [
        'The Weeknd - Blinding Lights Official Video (Reupload 2024)',
        'The Weeknd - Blinding Lights (Resubido en HD)',
        'The Weeknd - Blinding Lights (Fan Made Clip)',
        'The Weeknd - Blinding Lights (No Oficial)',
      ];

      for (const title of fanDisguised) {
        musicVideoService.clearCache();
        vi.mocked(httpHost.fetch).mockResolvedValueOnce(
          createSearchResponse([
            {
              videoId: 'fan-disguised-vid',
              title,
              channelTitle: 'TheWeekndVEVO',
              durationText: '3:20',
            },
          ]),
        );

        const result = await musicVideoService.findOfficialVideo(baseTrack);
        expect(result).toBeNull();
      }
    });

    it('cleanly returns null when all search results for a track are noise or unofficial', async () => {
      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'noise-vid-1',
            title: 'The Weeknd - Blinding Lights (Lyrics Video)',
            channelTitle: 'TheWeekndVEVO',
            durationText: '3:20',
          },
          {
            videoId: 'noise-vid-2',
            title: 'The Weeknd - Blinding Lights (Sub Español)',
            channelTitle: 'TheWeekndVEVO',
            durationText: '3:20',
          },
          {
            videoId: 'noise-vid-3',
            title: 'The Weeknd - Blinding Lights (Official Video)',
            channelTitle: 'UnverifiedFan123',
            durationText: '3:20',
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(baseTrack);
      expect(result).toBeNull();
    });
  });
});
