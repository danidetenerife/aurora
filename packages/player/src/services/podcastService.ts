import type { Track } from '@aurora/model';

import { httpHost } from './httpHost';

export type PodcastSearchResult = {
  id: string;
  name: string;
  publisher: string;
  artwork?: string;
  source: 'youtube-music' | 'itunes';
};

export type PodcastDetail = {
  id: string;
  title: string;
  publisher: string;
  description?: string;
  artwork?: string;
  source: 'youtube-music' | 'itunes';
  episodes: Track[];
};

type YtmInnerTubeSearchResponse = {
  contents?: {
    tabbedSearchResultsRenderer?: {
      tabs?: Array<{
        tabRenderer?: {
          content?: {
            sectionListRenderer?: {
              contents?: Array<{
                musicShelfRenderer?: {
                  contents?: Array<{
                    musicResponsiveListItemRenderer?: {
                      navigationEndpoint?: {
                        browseEndpoint?: {
                          browseId?: string;
                        };
                      };
                      flexColumns?: Array<{
                        musicResponsiveListItemFlexColumnRenderer?: {
                          text?: {
                            runs?: Array<{
                              text?: string;
                              navigationEndpoint?: {
                                browseEndpoint?: {
                                  browseId?: string;
                                };
                              };
                            }>;
                          };
                        };
                      }>;
                      thumbnail?: {
                        musicThumbnailRenderer?: {
                          thumbnail?: {
                            thumbnails?: Array<{
                              url?: string;
                            }>;
                          };
                        };
                      };
                    };
                  }>;
                };
              }>;
            };
          };
        };
      }>;
    };
  };
};

type YtmBrowseResponse = {
  contents?: {
    twoColumnBrowseResultsRenderer?: {
      tabs?: Array<{
        tabRenderer?: {
          content?: {
            sectionListRenderer?: {
              contents?: Array<{
                musicResponsiveHeaderRenderer?: {
                  title?: {
                    runs?: Array<{ text?: string }>;
                  };
                  straplineTextOne?: {
                    runs?: Array<{ text?: string }>;
                  };
                  subtitle?: {
                    runs?: Array<{ text?: string }>;
                  };
                  description?: {
                    musicDescriptionShelfRenderer?: {
                      description?: {
                        runs?: Array<{ text?: string }>;
                      };
                    };
                  };
                  thumbnail?: {
                    musicThumbnailRenderer?: {
                      thumbnail?: {
                        thumbnails?: Array<{ url?: string }>;
                      };
                    };
                  };
                };
              }>;
            };
          };
        };
      }>;
      secondaryContents?: {
        sectionListRenderer?: {
          contents?: Array<{
            musicShelfRenderer?: {
              contents?: Array<{
                musicMultiRowListItemRenderer?: {
                  title?: {
                    runs?: Array<{ text?: string }>;
                  };
                  subtitle?: {
                    runs?: Array<{ text?: string }>;
                  };
                  description?: {
                    runs?: Array<{ text?: string }>;
                  };
                  onTap?: {
                    watchEndpoint?: {
                      videoId?: string;
                    };
                  };
                  thumbnail?: {
                    musicThumbnailRenderer?: {
                      thumbnail?: {
                        thumbnails?: Array<{ url?: string }>;
                      };
                    };
                  };
                  playbackProgress?: {
                    musicPlaybackProgressRenderer?: {
                      durationText?: {
                        runs?: Array<{ text?: string }>;
                      };
                    };
                  };
                };
              }>;
            };
          }>;
        };
      };
    };
  };
};

const YTM_BASE_URL = 'https://music.youtube.com/youtubei/v1';
const YTM_CLIENT_NAME = 'WEB_REMIX';
const YTM_CLIENT_VERSION = '1.20240101.01.00';
const YTM_PODCAST_PARAMS = 'EgWKAQJQAWoSEBEQEBAEEAMQBRAJEAoQFRAO';
const DEFAULT_LOCALE = 'es';
const DEFAULT_COUNTRY = 'ES';
const SEARCH_RESULT_LIMIT = 25;
const EPISODE_LIMIT = 200;

const CURATED_YTM_PODCASTS: PodcastSearchResult[] = [
  {
    id: 'MPSPPLzuFY9Ixj9Z4G5-eRHblrmwMOY7tLUCHi',
    name: 'The Wild Project',
    publisher: 'Jordi Wild',
    source: 'youtube-music',
  },
  {
    id: 'MPSPPLlDZ74Qz5KgziPV5gTjd5QDsey1znyS_d',
    name: 'Terrores Criminales',
    publisher: 'Terrores Nocturnos Podcast',
    source: 'youtube-music',
  },
  {
    id: 'MPSPPLVYKDE9WjKYQ',
    name: 'Nadie Sabe Nada',
    publisher: 'SER Podcast',
    source: 'youtube-music',
  },
  {
    id: 'MPSPPL01FNQnUl7YKuI7iD1lwxKz8Ho3J8L8Of',
    name: 'ROCA PROJECT',
    publisher: 'Carlos Roca',
    source: 'youtube-music',
  },
  {
    id: 'MPSPPLIijRqUddPmhs7b8p_0VxYA3Dvh4629EJ',
    name: 'Extra Anormal Podcast',
    publisher: 'Podcast Extra Anormal',
    source: 'youtube-music',
  },
  {
    id: 'MPSPPL0rT9kkqIgDewaqNB7hwUJ1_TxGr4jiCt',
    name: 'Gusgri Podcast',
    publisher: 'Doble G',
    source: 'youtube-music',
  },
  {
    id: 'MPSPPLHlflR-J9dJdapDdWtWq0u--YEUc5PYki',
    name: 'Tom Segura En Español Podcast',
    publisher: 'Tom Segura',
    source: 'youtube-music',
  },
  {
    id: 'MPSPPLP7xxvt-QP_wmLIqw00IIROfaMIzSBNlk',
    name: 'Conversaciones en español',
    publisher: 'Joel Zárate',
    source: 'youtube-music',
  },
  {
    id: 'MPSPPLhLv3Z_8fvFh5lPIb-Xo-gTYjKQm0GDuv',
    name: 'Salida de Emergencia',
    publisher: 'Salida de Emergencia',
    source: 'youtube-music',
  },
];

const parseDurationToMillis = (text?: string): number | undefined => {
  if (!text) {
    return undefined;
  }
  const clean = text.replace(/^[•\s]+/, '').trim();

  if (/^\d+:\d+(:\d+)?$/.test(clean)) {
    const parts = clean.split(':').map(Number);
    if (parts.length === 3) {
      return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
    }
    if (parts.length === 2) {
      return (parts[0] * 60 + parts[1]) * 1000;
    }
  }

  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  const hMatch = clean.match(/(\d+)\s*(?:h|hr|hrs|horas?)/i);
  if (hMatch) {
    hours = parseInt(hMatch[1], 10);
  }

  const mMatch = clean.match(/(\d+)\s*(?:min|mins|minutos?|m\b)/i);
  if (mMatch) {
    minutes = parseInt(mMatch[1], 10);
  }

  const sMatch = clean.match(/(\d+)\s*(?:s|seg|secs?|segundos?)/i);
  if (sMatch) {
    seconds = parseInt(sMatch[1], 10);
  }

  const totalSecs = hours * 3600 + minutes * 60 + seconds;
  return totalSecs > 0 ? totalSecs * 1000 : undefined;
};

class PodcastService {
  private async searchYtmPodcasts(
    query: string,
  ): Promise<PodcastSearchResult[]> {
    try {
      const response = await httpHost.fetch(`${YTM_BASE_URL}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: YTM_CLIENT_NAME,
              clientVersion: YTM_CLIENT_VERSION,
              hl: DEFAULT_LOCALE,
              gl: DEFAULT_COUNTRY,
            },
          },
          query,
          params: YTM_PODCAST_PARAMS,
        }),
      });

      if (response.status !== 200) {
        return [];
      }

      const data = JSON.parse(response.body) as YtmInnerTubeSearchResponse;
      const tab =
        data.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer;
      const contents = tab?.content?.sectionListRenderer?.contents ?? [];
      const shelf = contents.find(
        (section) => section.musicShelfRenderer,
      )?.musicShelfRenderer;
      const rawItems = shelf?.contents ?? [];

      const results: PodcastSearchResult[] = [];

      for (const item of rawItems) {
        const renderer = item.musicResponsiveListItemRenderer;
        if (!renderer) {
          continue;
        }

        const title =
          renderer.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer
            ?.text?.runs?.[0]?.text;
        const author =
          renderer.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer
            ?.text?.runs?.[0]?.text ?? 'YouTube Music';
        const browseId =
          renderer.navigationEndpoint?.browseEndpoint?.browseId ||
          renderer.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer
            ?.text?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId;
        const thumbnails =
          renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails;
        const artwork = thumbnails?.[thumbnails.length - 1]?.url;

        if (title && browseId) {
          results.push({
            id: browseId,
            name: title,
            publisher: author,
            artwork,
            source: 'youtube-music',
          });
        }
      }

      return results;
    } catch {
      return [];
    }
  }

  private async searchItunesPodcasts(
    query: string,
  ): Promise<PodcastSearchResult[]> {
    try {
      const response = await httpHost.fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=podcast&limit=${SEARCH_RESULT_LIMIT}`,
      );

      if (response.status !== 200) {
        return [];
      }

      const payload = JSON.parse(response.body) as {
        results?: Array<{
          collectionId?: number;
          collectionName?: string;
          artistName?: string;
          artworkUrl600?: string;
          artworkUrl100?: string;
        }>;
      };

      return (payload.results ?? [])
        .filter((item) => item.collectionId && item.collectionName)
        .map((item) => ({
          id: String(item.collectionId),
          name: item.collectionName!,
          publisher: item.artistName ?? 'Podcast',
          artwork: item.artworkUrl600 ?? item.artworkUrl100,
          source: 'itunes',
        }));
    } catch {
      return [];
    }
  }

  async getFeaturedPodcasts(): Promise<PodcastSearchResult[]> {
    try {
      const [popularYtm, spanishYtm] = await Promise.all([
        this.searchYtmPodcasts('podcasts populares'),
        this.searchYtmPodcasts('podcasts en español'),
      ]);

      const seenIds = new Set<string>();
      const combined: PodcastSearchResult[] = [];

      for (const item of [...popularYtm, ...spanishYtm, ...CURATED_YTM_PODCASTS]) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          combined.push(item);
        }
      }

      if (combined.length > 0) {
        return combined;
      }
    } catch {
      // fallback
    }

    return CURATED_YTM_PODCASTS;
  }

  async searchPodcasts(query: string): Promise<PodcastSearchResult[]> {
    if (!query.trim()) {
      return [];
    }

    const ytmResults = await this.searchYtmPodcasts(query);
    if (ytmResults.length > 0) {
      return ytmResults;
    }

    return this.searchItunesPodcasts(query);
  }

  private async getItunesPodcastDetails(
    collectionId: string,
  ): Promise<PodcastDetail | null> {
    try {
      const lookupResponse = await httpHost.fetch(
        `https://itunes.apple.com/lookup?id=${collectionId}&entity=podcastEpisode&limit=${EPISODE_LIMIT}`,
      );

      if (lookupResponse.status !== 200) {
        return null;
      }

      const payload = JSON.parse(lookupResponse.body) as {
        results?: Array<{
          kind?: string;
          wrapperType?: string;
          collectionName?: string;
          artistName?: string;
          artworkUrl600?: string;
          trackName?: string;
          trackId?: number;
          episodeUrl?: string;
          trackTimeMillis?: number;
          releaseDate?: string;
          description?: string;
        }>;
      };

      const rawResults = payload.results ?? [];
      if (rawResults.length === 0) {
        return null;
      }

      const show = rawResults[0];
      const showTitle = show?.collectionName ?? 'Podcast';
      const showAuthor = show?.artistName ?? 'Podcast';
      const showArtwork = show?.artworkUrl600;

      const episodes: Track[] = rawResults
        .filter((entry) => entry.kind === 'podcast-episode' && entry.episodeUrl)
        .map((entry) => ({
          title: entry.trackName ?? showTitle,
          artists: [{ name: showAuthor, roles: ['host'] }],
          album: {
            title: showTitle,
            artwork: showArtwork
              ? { items: [{ url: showArtwork, purpose: 'cover' }] }
              : undefined,
            source: {
              provider: 'itunes-podcast',
              id: collectionId,
            },
          },
          source: {
            provider: 'podcast-audio',
            id: String(entry.trackId),
            url: entry.episodeUrl!,
          },
          durationMs: entry.trackTimeMillis,
          isPodcast: true,
          artwork: {
            items:
              entry.artworkUrl600 || showArtwork
                ? [
                    {
                      url: (entry.artworkUrl600 || showArtwork)!,
                      purpose: 'thumbnail',
                    },
                  ]
                : [],
          },
        }));

      return {
        id: collectionId,
        title: showTitle,
        publisher: showAuthor,
        description: show?.description,
        artwork: showArtwork,
        source: 'itunes',
        episodes,
      };
    } catch {
      return null;
    }
  }

  private async getYtmPodcastDetails(
    browseId: string,
  ): Promise<PodcastDetail | null> {
    try {
      const response = await httpHost.fetch(`${YTM_BASE_URL}/browse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: YTM_CLIENT_NAME,
              clientVersion: YTM_CLIENT_VERSION,
              hl: DEFAULT_LOCALE,
              gl: DEFAULT_COUNTRY,
            },
          },
          browseId,
        }),
      });

      if (response.status !== 200) {
        return null;
      }

      const data = JSON.parse(response.body) as YtmBrowseResponse;
      const headerSection =
        data.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer
          ?.content?.sectionListRenderer?.contents?.[0]
          ?.musicResponsiveHeaderRenderer;

      const showTitle =
        headerSection?.title?.runs?.map((run) => run.text).join('') ||
        'Podcast';
      const showAuthor =
        headerSection?.straplineTextOne?.runs
          ?.map((run) => run.text)
          .join('') ||
        headerSection?.subtitle?.runs?.map((run) => run.text).join('') ||
        'YouTube Music';
      const showDescription =
        headerSection?.description?.musicDescriptionShelfRenderer?.description?.runs
          ?.map((run) => run.text)
          .join('');
      const headerThumbnails =
        headerSection?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails;
      const initialArtwork = headerThumbnails?.[headerThumbnails.length - 1]?.url;

      const secondarySection =
        data.contents?.twoColumnBrowseResultsRenderer?.secondaryContents;
      const episodeShelf =
        secondarySection?.sectionListRenderer?.contents?.[0]
          ?.musicShelfRenderer;
      const rawEpisodeList = episodeShelf?.contents ?? [];
      const firstEpThumb =
        rawEpisodeList[0]?.musicMultiRowListItemRenderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url;
      const showArtwork = initialArtwork || firstEpThumb;

      const episodes: Track[] = [];

      for (const item of rawEpisodeList) {
        const row = item.musicMultiRowListItemRenderer;
        const videoId = row?.onTap?.watchEndpoint?.videoId;
        const episodeTitle = row?.title?.runs?.map((run) => run.text).join('');
        const thumbnails =
          row?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails;
        const episodeThumb =
          thumbnails?.[thumbnails.length - 1]?.url ?? showArtwork;


        const durText =
          row?.playbackProgress?.musicPlaybackProgressRenderer?.durationText
            ?.runs
            ?.map((run) => run.text)
            .filter(Boolean)
            .join('') ||
          row?.subtitle?.runs
            ?.map((run) => run.text)
            .filter((text): text is string => Boolean(text))
            .find((text) =>
              /\b(?:\d+\s*(?:h|hr|hrs|horas?|min|mins|minutos?|seg|s)\b|\d+:\d+)/i.test(
                text,
              ),
            );
        const durationMs = parseDurationToMillis(durText);

        if (videoId && episodeTitle) {
          episodes.push({
            title: episodeTitle,
            artists: [{ name: showAuthor, roles: ['host'] }],
            album: {
              title: showTitle,
              artwork: showArtwork
                ? { items: [{ url: showArtwork, purpose: 'cover' }] }
                : undefined,
              source: {
                provider: 'youtube-music',
                id: browseId,
              },
            },
            source: {
              provider: 'youtube-music',
              id: videoId,
              url: `https://www.youtube.com/watch?v=${videoId}`,
            },
            durationMs,
            isPodcast: true,
            artwork: {
              items: episodeThumb
                ? [{ url: episodeThumb, purpose: 'thumbnail' }]
                : [],
            },
          });
        }
      }

      return {
        id: browseId,
        title: showTitle,
        publisher: showAuthor,
        description: showDescription,
        artwork: showArtwork,
        source: 'youtube-music',
        episodes,
      };
    } catch {
      return null;
    }
  }

  async getPodcastDetails(podcastId: string): Promise<PodcastDetail | null> {
    const isYtmId =
      podcastId.startsWith('MPSP') ||
      podcastId.startsWith('VL') ||
      podcastId.startsWith('UC') ||
      podcastId.startsWith('yt-');

    if (isYtmId) {
      const cleanBrowseId = podcastId.replace(/^yt-/, '');
      const ytmDetail = await this.getYtmPodcastDetails(cleanBrowseId);
      if (ytmDetail) {
        return ytmDetail;
      }
    }

    const cleanNumericId = podcastId.replace(/^itunes-/, '');
    if (/^\d+$/.test(cleanNumericId)) {
      const itunesDetail = await this.getItunesPodcastDetails(cleanNumericId);
      if (itunesDetail) {
        return itunesDetail;
      }
    }

    const slugQuery = podcastId.replace(/[-_]/g, ' ');
    const ytmMatches = await this.searchYtmPodcasts(slugQuery);
    if (ytmMatches.length > 0 && ytmMatches[0]?.id) {
      const ytmDetail = await this.getYtmPodcastDetails(ytmMatches[0].id);
      if (ytmDetail) {
        return ytmDetail;
      }
    }

    const itunesMatches = await this.searchItunesPodcasts(slugQuery);
    if (itunesMatches.length > 0 && itunesMatches[0]?.id) {
      return this.getItunesPodcastDetails(itunesMatches[0].id);
    }

    return null;
  }
}

export const podcastService = new PodcastService();
