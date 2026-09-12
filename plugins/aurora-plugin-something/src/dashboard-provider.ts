import type { DashboardProvider, PlaylistRef } from '@aurora/plugin-sdk';

export const DASHBOARD_PROVIDER_ID = 'spotify-dashboard';

export const PUBLIC_PLAYLISTS: PlaylistRef[] = [
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
    id: '37i9dQZF1DX4JAvHpjipBk',
    name: 'Rock Classics',
    source: {
      provider: 'spotify',
      id: 'spotify:playlist:37i9dQZF1DX4JAvHpjipBk',
      url: 'https://open.spotify.com/playlist/37i9dQZF1DX4JAvHpjipBk',
    },
  },
  {
    id: '37i9dQZF1DX10zKzsJ2jva',
    name: 'Viva Latino',
    source: {
      provider: 'spotify',
      id: 'spotify:playlist:37i9dQZF1DX10zKzsJ2jva',
      url: 'https://open.spotify.com/playlist/37i9dQZF1DX10zKzsJ2jva',
    },
  },
  {
    id: '37i9dQZF1DX1lVhptIYRda',
    name: 'Mood Booster',
    source: {
      provider: 'spotify',
      id: 'spotify:playlist:37i9dQZF1DX1lVhptIYRda',
      url: 'https://open.spotify.com/playlist/37i9dQZF1DX1lVhptIYRda',
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
