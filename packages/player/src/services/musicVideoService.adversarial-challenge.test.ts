import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Track } from '@aurora/model';

import { httpHost } from './httpHost';
import {
  hasNoiseTerms,
  isOfficialChannel,
  musicVideoService,
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

describe('Empirical Challenger: Anti-Subtitle & Junk Filtering Adversarial Matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    musicVideoService.clearCache();
  });

  const baseTrack: Track = {
    title: 'Levitating',
    artists: [{ name: 'Dua Lipa', roles: [] }],
    source: { provider: 'test', id: 'track-lev-adv' },
    durationMs: 203000,
  };

  const officialArtistBadges = [
    {
      metadataBadgeRenderer: {
        style: 'BADGE_STYLE_TYPE_VERIFIED_ARTIST',
      },
    },
  ];

  describe('Adversarial Permutations of Subtitle Indicators', () => {
    const subtitlePermutations = [
      // sub español variants
      'Dua Lipa - Levitating sub español',
      'Dua Lipa - Levitating (sub español)',
      'Dua Lipa - Levitating [SUB ESPAÑOL]',
      'Dua Lipa - Levitating {Sub Español}',
      'Dua Lipa - Levitating / Sub Español /',
      'Dua Lipa - Levitating - Sub Español',
      'Dua Lipa - Levitating | Sub Español',
      'Dua Lipa - Levitating (Sub.Español)',
      'Dua Lipa - Levitating (Sub-Español)',
      'Dua Lipa - Levitating Sub Espanol (Sin Acento)',
      'Dua Lipa - Levitating [sub espanol]',

      // subtitulado / subtitulos variants
      'Dua Lipa - Levitating (Subtitulado)',
      'Dua Lipa - Levitating [SUBTITULADA]',
      'Dua Lipa - Levitating (Subtitulada al Español)',
      'Dua Lipa - Levitating con Subtitulos',
      'Dua Lipa - Levitating con Subtítulos',
      'Dua Lipa - Levitating (Subtitulo en español)',
      'Dua Lipa - Levitating [Subtítulo]',
      'Dua Lipa - Levitating (English Subtitles)',
      'Dua Lipa - Levitating [Subtitle]',

      // con letra variants
      'Dua Lipa - Levitating con letra',
      'Dua Lipa - Levitating (Con Letra)',
      'Dua Lipa - Levitating [CON LETRA]',
      'Dua Lipa - Levitating - Con Letra -',
      'Dua Lipa - Levitating (Con-Letra)',
      'Dua Lipa - Levitating con letras',
      'Dua Lipa - Levitating [Con Letras]',

      // lyrics variants
      'Dua Lipa - Levitating lyrics',
      'Dua Lipa - Levitating (Lyrics)',
      'Dua Lipa - Levitating [LYRICS]',
      'Dua Lipa - Levitating (Official Lyric Video)',
      'Dua Lipa - Levitating [Lyric Video]',
      'Dua Lipa - Levitating Lyric Video 4K',
      'Dua Lipa - Levitating (Lyric)',
      'Dua Lipa - Levitating [Lyric]',
      'Dua Lipa - Levitating with Lyrics on screen',

      // subbed variants
      'Dua Lipa - Levitating subbed',
      'Dua Lipa - Levitating (Subbed)',
      'Dua Lipa - Levitating [ENG SUBBED]',
      'Dua Lipa - Levitating (English Subbed)',
      'Dua Lipa - Levitating [Spanish Subbed]',

      // traducida variants
      'Dua Lipa - Levitating traducida',
      'Dua Lipa - Levitating (Traducida)',
      'Dua Lipa - Levitating [TRADUCIDA AL ESPAÑOL]',
      'Dua Lipa - Levitating traducido',
      'Dua Lipa - Levitating (Traducido)',
      'Dua Lipa - Levitating traducción',
      'Dua Lipa - Levitating (Traducción)',
      'Dua Lipa - Levitating traduccion',
      'Dua Lipa - Levitating [TRADUCCION]',

      // cc (closed captions) variants
      'Dua Lipa - Levitating cc',
      'Dua Lipa - Levitating (CC)',
      'Dua Lipa - Levitating [cc]',
      'Dua Lipa - Levitating (Closed Captions - cc)',
      'Dua Lipa - Levitating | CC |',
    ];

    for (const titleVariant of subtitlePermutations) {
      it(`empirically rejects subtitle indicator: "${titleVariant}"`, async () => {
        // Direct noise detector check
        expect(
          hasNoiseTerms(
            titleVariant,
            'Dua Lipa',
            baseTrack.artists[0].name,
            baseTrack.title,
          ),
        ).toBe(true);

        // End-to-end service search rejection
        musicVideoService.clearCache();
        vi.mocked(httpHost.fetch).mockResolvedValueOnce(
          createSearchResponse([
            {
              videoId: 'sub-test-reject',
              title: titleVariant,
              channelTitle: 'Dua Lipa',
              durationText: '3:25',
              ownerBadges: officialArtistBadges,
            },
          ]),
        );

        const result = await musicVideoService.findOfficialVideo(baseTrack);
        expect(result).toBeNull();
      });
    }
  });

  describe('Adversarial Permutations of Low-Resolution Tags', () => {
    const lowResPermutations = [
      // 240p
      'Dua Lipa - Levitating 240p',
      'Dua Lipa - Levitating (240p)',
      'Dua Lipa - Levitating [240p]',
      'Dua Lipa - Levitating [240P]',
      'Dua Lipa - Levitating 240p Official Video',
      'Dua Lipa - Levitating - 240p -',

      // 360p
      'Dua Lipa - Levitating 360p',
      'Dua Lipa - Levitating (360p)',
      'Dua Lipa - Levitating [360p]',
      'Dua Lipa - Levitating [360P]',
      'Dua Lipa - Levitating 360p HQ',

      // 480p
      'Dua Lipa - Levitating 480p',
      'Dua Lipa - Levitating (480p)',
      'Dua Lipa - Levitating [480p]',
      'Dua Lipa - Levitating [480P]',
      'Dua Lipa - Levitating 480p DVD Rip',
      'Dua Lipa - Levitating (Video Oficial 480p)',
    ];

    for (const titleVariant of lowResPermutations) {
      it(`empirically rejects low-res tag: "${titleVariant}"`, async () => {
        expect(
          hasNoiseTerms(
            titleVariant,
            'Dua Lipa',
            baseTrack.artists[0].name,
            baseTrack.title,
          ),
        ).toBe(true);

        musicVideoService.clearCache();
        vi.mocked(httpHost.fetch).mockResolvedValueOnce(
          createSearchResponse([
            {
              videoId: 'lowres-test-reject',
              title: titleVariant,
              channelTitle: 'Dua Lipa',
              durationText: '3:25',
              ownerBadges: officialArtistBadges,
            },
          ]),
        );

        const result = await musicVideoService.findOfficialVideo(baseTrack);
        expect(result).toBeNull();
      });
    }
  });

  describe('Adversarial Permutations of Fan Tags', () => {
    const fanTagPermutations = [
      // reupload / resubido
      'Dua Lipa - Levitating reupload',
      'Dua Lipa - Levitating (Reupload)',
      'Dua Lipa - Levitating [REUPLOAD]',
      'Dua Lipa - Levitating re upload',
      'Dua Lipa - Levitating (Re Upload)',
      'Dua Lipa - Levitating (Re-Upload)',
      'Dua Lipa - Levitating resubido',
      'Dua Lipa - Levitating (Resubido)',
      'Dua Lipa - Levitating [RESUBIDO EN HD]',
      'Dua Lipa - Levitating resubida',
      'Dua Lipa - Levitating (Resubida)',

      // fan made / fanmade
      'Dua Lipa - Levitating fan made',
      'Dua Lipa - Levitating (Fan Made)',
      'Dua Lipa - Levitating [FAN MADE]',
      'Dua Lipa - Levitating (Fan-Made Video)',
      'Dua Lipa - Levitating fanmade',
      'Dua Lipa - Levitating (Fanmade)',
      'Dua Lipa - Levitating [FANMADE CLIP]',

      // no oficial / unofficial
      'Dua Lipa - Levitating no oficial',
      'Dua Lipa - Levitating (No Oficial)',
      'Dua Lipa - Levitating [NO OFICIAL]',
      'Dua Lipa - Levitating - Video No Oficial',
      'Dua Lipa - Levitating unofficial',
      'Dua Lipa - Levitating (Unofficial)',
      'Dua Lipa - Levitating [UNOFFICIAL VIDEO]',

      // covers / tributes
      'Dua Lipa - Levitating (Covers)',
      'Dua Lipa - Levitating [COVERS]',
      'Dua Lipa - Levitating (Tributes)',
      'Dua Lipa - Levitating [TRIBUTES]',
    ];

    for (const titleVariant of fanTagPermutations) {
      it(`empirically rejects fan tag: "${titleVariant}"`, async () => {
        expect(
          hasNoiseTerms(
            titleVariant,
            'Dua Lipa',
            baseTrack.artists[0].name,
            baseTrack.title,
          ),
        ).toBe(true);

        musicVideoService.clearCache();
        vi.mocked(httpHost.fetch).mockResolvedValueOnce(
          createSearchResponse([
            {
              videoId: 'fan-test-reject',
              title: titleVariant,
              channelTitle: 'Dua Lipa',
              durationText: '3:25',
              ownerBadges: officialArtistBadges,
            },
          ]),
        );

        const result = await musicVideoService.findOfficialVideo(baseTrack);
        expect(result).toBeNull();
      });
    }
  });

  describe('Legitimate Songs with Similar Words & Exemption Mechanics', () => {
    it('accepts Bruce Springsteen "Cover Me" official video without false noise rejection on "cover"', async () => {
      const coverMeTrack: Track = {
        title: 'Cover Me',
        artists: [{ name: 'Bruce Springsteen', roles: [] }],
        source: { provider: 'test', id: 'bs-cover-me' },
        durationMs: 208000,
      };

      // hasNoiseTerms should return FALSE for the legitimate official title
      const isNoise = hasNoiseTerms(
        'Bruce Springsteen - Cover Me (Official Video)',
        'BruceSpringsteenVEVO',
        coverMeTrack.artists[0].name,
        coverMeTrack.title,
      );
      expect(isNoise).toBe(false);

      vi.mocked(httpHost.fetch).mockResolvedValueOnce(
        createSearchResponse([
          {
            videoId: 'bs-cover-me-official-vid',
            title: 'Bruce Springsteen - Cover Me (Official Video)',
            channelTitle: 'BruceSpringsteenVEVO',
            durationText: '3:28',
            ownerBadges: officialArtistBadges,
          },
        ]),
      );

      const result = await musicVideoService.findOfficialVideo(coverMeTrack);
      expect(result).not.toBeNull();
      expect(result?.videoId).toBe('bs-cover-me-official-vid');
    });

    it('strictly BLOCKS non-exempt junk terms for Bruce Springsteen "Cover Me"', async () => {
      const coverMeTrack: Track = {
        title: 'Cover Me',
        artists: [{ name: 'Bruce Springsteen', roles: [] }],
        source: { provider: 'test', id: 'bs-cover-me-junk' },
        durationMs: 208000,
      };

      const nonExemptAttacksOnCoverMe = [
        'Bruce Springsteen - Cover Me (Covered by Alice)',
        'Bruce Springsteen - Cover Me (Guitar Cover)',
        'Bruce Springsteen - Cover Me (Acoustic Cover)',
        'Bruce Springsteen - Cover Me (Piano Cover)',
        'Bruce Springsteen - Cover Me (Covers)',
        'Bruce Springsteen - Cover Me (Karaoke)',
        'Bruce Springsteen - Cover Me (Tribute)',
        'Bruce Springsteen - Cover Me (Sub Español)',
        'Bruce Springsteen - Cover Me [Sub Espanol]',
        'Bruce Springsteen - Cover Me (Subtitulado)',
        'Bruce Springsteen - Cover Me (Con Letra)',
        'Bruce Springsteen - Cover Me (Lyrics)',
        'Bruce Springsteen - Cover Me [Lyric Video]',
        'Bruce Springsteen - Cover Me (Subbed)',
        'Bruce Springsteen - Cover Me (Traducida)',
        'Bruce Springsteen - Cover Me (CC)',
        'Bruce Springsteen - Cover Me [240p]',
        'Bruce Springsteen - Cover Me [480p]',
        'Bruce Springsteen - Cover Me (Reupload)',
        'Bruce Springsteen - Cover Me (Fan Made)',
        'Bruce Springsteen - Cover Me (No Oficial)',
      ];

      for (const attackedTitle of nonExemptAttacksOnCoverMe) {
        expect(
          hasNoiseTerms(
            attackedTitle,
            'BruceSpringsteenVEVO',
            coverMeTrack.artists[0].name,
            coverMeTrack.title,
          ),
        ).toBe(true);

        musicVideoService.clearCache();
        vi.mocked(httpHost.fetch).mockResolvedValueOnce(
          createSearchResponse([
            {
              videoId: 'bs-cover-me-attack-vid',
              title: attackedTitle,
              channelTitle: 'BruceSpringsteenVEVO',
              durationText: '3:28',
              ownerBadges: officialArtistBadges,
            },
          ]),
        );

        const result = await musicVideoService.findOfficialVideo(coverMeTrack);
        expect(result).toBeNull();
      }
    });

    it('accepts The Strokes "Under Cover of Darkness" official video while rejecting non-exempt attacks', async () => {
      const strokesTrack: Track = {
        title: 'Under Cover of Darkness',
        artists: [{ name: 'The Strokes', roles: [] }],
        source: { provider: 'test', id: 'strokes-ucod' },
        durationMs: 235000,
      };

      // Legitimate official video is NOT noise
      expect(
        hasNoiseTerms(
          'The Strokes - Under Cover of Darkness (Official Video)',
          'TheStrokesVEVO',
          strokesTrack.artists[0].name,
          strokesTrack.title,
        ),
      ).toBe(false);

      // But attacked with (Sub Español) or [Lyrics] is BLOCKED
      expect(
        hasNoiseTerms(
          'The Strokes - Under Cover of Darkness (Official Video) [Sub Español]',
          'TheStrokesVEVO',
          strokesTrack.artists[0].name,
          strokesTrack.title,
        ),
      ).toBe(true);
      expect(
        hasNoiseTerms(
          'The Strokes - Under Cover of Darkness (Lyrics)',
          'TheStrokesVEVO',
          strokesTrack.artists[0].name,
          strokesTrack.title,
        ),
      ).toBe(true);
    });

    it('accepts Kid B "Fruit Loops" and The Loops "In The Loop" while rejecting non-exempt attacks', () => {
      // Loop exemption
      expect(
        hasNoiseTerms(
          'Kid B - Fruit Loops (Official Video)',
          'KidB',
          'Kid B',
          'Fruit Loops',
        ),
      ).toBe(false);

      // Attacked with 10 Hours Loop -> blocked
      expect(
        hasNoiseTerms(
          'Kid B - Fruit Loops (10 Hours Loop)',
          'KidB',
          'Kid B',
          'Fruit Loops',
        ),
      ).toBe(true);

      // Attacked with Sub Español -> blocked
      expect(
        hasNoiseTerms(
          'Kid B - Fruit Loops (Sub Español)',
          'KidB',
          'Kid B',
          'Fruit Loops',
        ),
      ).toBe(true);
    });

    it('accepts Cake "Short Skirt Long Jacket" without tripping on "shorts"', () => {
      expect(
        hasNoiseTerms(
          'CAKE - Short Skirt / Long Jacket (Official Music Video)',
          'CAKEVEVO',
          'Cake',
          'Short Skirt Long Jacket',
        ),
      ).toBe(false);

      // But #shorts hashtag trips noise
      expect(
        hasNoiseTerms(
          'CAKE - Short Skirt / Long Jacket #shorts',
          'CAKEVEVO',
          'Cake',
          'Short Skirt Long Jacket',
        ),
      ).toBe(true);
    });

    it('accepts BTS "Butter" without tripping on "bts", but rejects "Behind The Scenes"', () => {
      expect(
        hasNoiseTerms(
          'BTS (방탄소년단) Butter Official MV',
          'HYBE LABELS',
          'BTS',
          'Butter',
        ),
      ).toBe(false);

      // "Behind the scenes" is noise even for BTS
      expect(
        hasNoiseTerms(
          'BTS (방탄소년단) Butter (Behind The Scenes)',
          'HYBE LABELS',
          'BTS',
          'Butter',
        ),
      ).toBe(true);
    });
  });

  describe('Channel Verification Gating Adversarial Challenges', () => {
    it('rejects fan channel naming tricks (e.g. "Dua Lipa Official Video Reupload Channel")', () => {
      expect(
        isOfficialChannel({
          artist: 'Dua Lipa',
          vChannel: 'Dua Lipa Official Video Reupload Channel',
          ownerBadges: [],
        }),
      ).toBe(false);
    });

    it('rejects channel names containing "unofficial", "fan made", "no oficial"', () => {
      const spoofChannels = [
        'Dua Lipa Unofficial',
        'Dua Lipa Fan Made Channel',
        'Dua Lipa No Oficial',
        'Dua Lipa Fanpage',
        'Dua Lipa Fanclub',
        'Dua Lipa Resubido',
      ];
      for (const vChannel of spoofChannels) {
        expect(
          isOfficialChannel({
            artist: 'Dua Lipa',
            vChannel,
            ownerBadges: [],
          }),
        ).toBe(false);
      }
    });

    it('rejects generic verified channel when artist does not match (e.g. PewDiePie verified uploading Dua Lipa)', () => {
      expect(
        isOfficialChannel({
          artist: 'Dua Lipa',
          vChannel: 'PewDiePie',
          ownerBadges: [
            {
              metadataBadgeRenderer: {
                style: 'BADGE_STYLE_TYPE_VERIFIED',
              },
            },
          ],
        }),
      ).toBe(false);
    });

    it('accepts generic verified channel when artist matches channel name', () => {
      expect(
        isOfficialChannel({
          artist: 'Dua Lipa',
          vChannel: 'Dua Lipa',
          ownerBadges: [
            {
              metadataBadgeRenderer: {
                style: 'BADGE_STYLE_TYPE_VERIFIED',
              },
            },
          ],
        }),
      ).toBe(true);
    });

    it('accepts major/indie record labels even if artist is not in channel name', () => {
      const labels = [
        'Warner Records',
        'Universal Music Group',
        'Sony Music Entertainment',
        'HYBE LABELS',
        'SMTOWN',
        'JYP Entertainment',
        'Fueled By Ramen',
        'Epitaph Records',
        'Sub Pop',
        '4AD',
        'XL Recordings',
        'Rough Trade',
      ];
      for (const label of labels) {
        expect(
          isOfficialChannel({
            artist: 'Any Emerging Artist',
            vChannel: label,
            ownerBadges: [],
          }),
        ).toBe(true);
      }
    });
  });
});
