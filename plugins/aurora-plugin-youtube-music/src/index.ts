import type { AuroraPlugin, AuroraPluginAPI } from '@aurora/plugin-sdk';

import { YtMusicClient } from './client';
import {
  createDashboardProvider,
  DASHBOARD_PROVIDER_ID,
} from './dashboard-provider';
import {
  createDiscoveryProvider,
  DISCOVERY_PROVIDER_ID,
} from './discovery-provider';
import {
  createMetadataProvider,
  METADATA_PROVIDER_ID,
} from './metadata-provider';
import {
  createPlaylistProvider,
  PLAYLIST_PROVIDER_ID,
} from './playlist-provider';
import {
  createStreamingProvider,
  STREAMING_PROVIDER_ID,
} from './streaming-provider';

let ytMusicClient: YtMusicClient | undefined;

const getClient = (api: AuroraPluginAPI): YtMusicClient => {
  if (!ytMusicClient) {
    ytMusicClient = new YtMusicClient(api.Http.fetch);
  }
  return ytMusicClient;
};

const plugin: AuroraPlugin = {
  onEnable(api: AuroraPluginAPI) {
    const client = getClient(api);
    api.Providers.register(createStreamingProvider(api, client));
    api.Providers.register(createMetadataProvider(client));
    api.Providers.register(createDashboardProvider(api, client));
    api.Providers.register(createPlaylistProvider(client));
    api.Providers.register(createDiscoveryProvider(client));
  },

  onDisable(api: AuroraPluginAPI) {
    api.Providers.unregister(STREAMING_PROVIDER_ID);
    api.Providers.unregister(METADATA_PROVIDER_ID);
    api.Providers.unregister(DASHBOARD_PROVIDER_ID);
    api.Providers.unregister(PLAYLIST_PROVIDER_ID);
    api.Providers.unregister(DISCOVERY_PROVIDER_ID);
  },
};

export default plugin;
