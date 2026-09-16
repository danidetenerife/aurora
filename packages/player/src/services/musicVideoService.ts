import type { Track } from '@aurora/model';

import { httpHost } from './httpHost';
import { Logger } from './logger';

export type OfficialVideoResult = {
  videoId: string;
  title: string;
  channelTitle?: string;
  thumbnailUrl?: string;
};

class MusicVideoService {
  private cache = new Map<string, OfficialVideoResult | null>();

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
      const result = await this.searchYouTubeForOfficialVideo(artist, title);
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
    artist: string,
    title: string,
  ): Promise<OfficialVideoResult | null> {
    const cleanTitle = title
      .replace(
        /\s*\([^)]*(?:official|audio|video|feat|ft|remastered)[^)]*\)/gi,
        '',
      )
      .replace(
        /\s*\[[^\]]*(?:official|audio|video|feat|ft|remastered)[^\]]*\]/gi,
        '',
      )
      .trim();

    const query = `${artist} ${cleanTitle} official music video`.trim();

    const requestBody = {
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20240101.01.00',
          hl: 'es',
          gl: 'ES',
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
    const contents =
      primary?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer
        ?.contents || [];

    const candidates: Array<{
      videoId: string;
      title: string;
      channelTitle: string;
      thumbnailUrl?: string;
      score: number;
    }> = [];

    const lowerArtist = artist.toLowerCase();
    const lowerTitle = cleanTitle.toLowerCase();

    for (const item of contents) {
      const vr = item.videoRenderer;
      if (!vr || !vr.videoId) {
        continue;
      }

      const videoId = vr.videoId;
      const vTitle = vr.title?.runs?.[0]?.text ?? '';
      const vChannel = vr.ownerText?.runs?.[0]?.text ?? '';
      const vThumb = vr.thumbnail?.thumbnails?.slice(-1)[0]?.url;

      const lowerVTitle = vTitle.toLowerCase();
      const lowerVChannel = vChannel.toLowerCase();

      if (
        lowerVChannel.includes('- topic') ||
        lowerVTitle.includes('(audio)') ||
        lowerVTitle.includes('[audio]') ||
        lowerVTitle.includes('karaoke') ||
        lowerVTitle.includes('instrumental') ||
        lowerVTitle.includes('cover')
      ) {
        continue;
      }

      let score = 0;

      if (
        lowerVTitle.includes('official music video') ||
        lowerVTitle.includes('official video') ||
        lowerVTitle.includes('videoclip oficial') ||
        lowerVTitle.includes('video oficial')
      ) {
        score += 50;
      } else if (
        lowerVTitle.includes('official') ||
        lowerVTitle.includes('oficial')
      ) {
        score += 25;
      }

      if (
        (lowerArtist && lowerVChannel.includes(lowerArtist)) ||
        lowerVChannel.includes('vevo')
      ) {
        score += 30;
      }

      if (lowerTitle && lowerVTitle.includes(lowerTitle)) {
        score += 20;
      }

      candidates.push({
        videoId,
        title: vTitle,
        channelTitle: vChannel,
        thumbnailUrl: vThumb,
        score,
      });
    }

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];

    Logger.streaming.info(
      `MusicVideoService: Selected official video "${best.title}" (${best.videoId}) with score ${best.score}`,
    );

    return {
      videoId: best.videoId,
      title: best.title,
      channelTitle: best.channelTitle,
      thumbnailUrl: best.thumbnailUrl,
    };
  }
}

export const musicVideoService = new MusicVideoService();
