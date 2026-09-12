import type { DashboardProvider, PlaylistRef } from '@aurora/plugin-sdk';

export const DASHBOARD_PROVIDER_ID = 'spotify-dashboard';

const PUBLIC_PLAYLISTS: PlaylistRef[] = [
  {
    id: '37i9dQZF1DXcBWIGoYBM5M',
    name: 'Today’s Top Hits',
    source: {
      provider: 'spotify',
      id: 'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M',
      url: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
    },
  },
  {
    id: '37i9dQZF1DX0XUsuxWHRQd',
    name: 'RapCaviar',
    source: {
      provider: 'spotify',
      id: 'spotify:playlist:37i9dQZF1DX0XUsuxWHRQd',
      url: 'https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd',
    },
  },
];

export const createDashboardProvider = (): DashboardProvider => ({
  id: DASHBOARD_PROVIDER_ID,
  kind: 'dashboard',
  name: 'Spotify',
  metadataProviderId: 'spotify',
  capabilities: ['editorialPlaylists'],
  fetchEditorialPlaylists: async () => PUBLIC_PLAYLISTS,
});
