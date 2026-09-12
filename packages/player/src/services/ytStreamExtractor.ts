import { registerPlugin } from '@capacitor/core';

type YtStreamExtractorPluginInterface = {
  extractAudioUrl(options: { videoId: string }): Promise<{ streamUrl: string }>;
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
};
