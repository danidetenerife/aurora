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

  async searchPodcasts(query: string): Promise<PodcastSearchResult[]> {
    if (!query.trim()) {
      return [];
    }

    const [ytmResults, itunesResults] = await Promise.all([
      this.searchYtmPodcasts(query),
      this.searchItunesPodcasts(query),
    ]);

    const combined = [...ytmResults];
    const seenNames = new Set(
      ytmResults.map((item) => item.name.toLowerCase().trim()),
    );

    for (const itunesItem of itunesResults) {
      const normalizedName = itunesItem.name.toLowerCase().trim();
      if (!seenNames.has(normalizedName)) {
        combined.push(itunesItem);
        seenNames.add(normalizedName);
      }
    }

    return combined;
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
      const showArtwork = headerThumbnails?.[headerThumbnails.length - 1]?.url;

      const secondarySection =
        data.contents?.twoColumnBrowseResultsRenderer?.secondaryContents;
      const episodeShelf =
        secondarySection?.sectionListRenderer?.contents?.[0]
          ?.musicShelfRenderer;
      const rawEpisodeList = episodeShelf?.contents ?? [];

      const episodes: Track[] = [];

      for (const item of rawEpisodeList) {
        const row = item.musicMultiRowListItemRenderer;
        const videoId = row?.onTap?.watchEndpoint?.videoId;
        const episodeTitle = row?.title?.runs?.map((run) => run.text).join('');
        const thumbnails =
          row?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails;
        const episodeThumb =
          thumbnails?.[thumbnails.length - 1]?.url ?? showArtwork;

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
