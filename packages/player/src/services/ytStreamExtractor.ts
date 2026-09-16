import { registerPlugin } from '@capacitor/core';

type YtStreamExtractorPluginInterface = {
  extractAudioUrl(options: { videoId: string }): Promise<{ streamUrl: string }>;
  extractVideoUrl(options: { videoId: string }): Promise<{ streamUrl: string }>;
  getVideoProxyPort(): Promise<{ port: number }>;
};

const NativeYtStreamExtractor =
  registerPlugin<YtStreamExtractorPluginInterface>('YtStreamExtractor');

export const YtStreamExtractor = {
  extractAudioUrl: async (options: {
    videoId: string;
  }): Promise<{ streamUrl: string }> => {
    try {
      return await NativeYtStreamExtractor.extractAudioUrl(options);
    } catch {
      return { streamUrl: '' };
    }
  },
  extractVideoUrl: async (options: {
    videoId: string;
  }): Promise<{ streamUrl: string }> => {
    try {
      return await NativeYtStreamExtractor.extractVideoUrl(options);
    } catch {
      return { streamUrl: '' };
    }
  },
  getVideoProxyPort: async (): Promise<number> => {
    try {
      const result = await NativeYtStreamExtractor.getVideoProxyPort();
      return result.port;
    } catch {
      return 0;
    }
  },
};
