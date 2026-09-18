import type {
  ArtworkSet,
  DashboardProvider,
  FetchFunction,
  PlaylistRef,
} from '@aurora/plugin-sdk';

export const DASHBOARD_PROVIDER_ID = 'spotify-dashboard';

const COVER_SIZE = 640;

const createCoverArtwork = (url: string): ArtworkSet => ({
  items: [
    {
      url,
      purpose: 'cover',
      width: COVER_SIZE,
      height: COVER_SIZE,
      source: { provider: 'spotify', id: 'cover' },
    },
  ],
});

export const PUBLIC_PLAYLISTS: PlaylistRef[] = [
  {
    id: '37i9dQZF1DXcBWIGoYBM5M',
    name: 'Today’s Top Hits',
    artwork: createCoverArtwork(
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=640&auto=format&fit=crop&q=80',
    ),
    source: {
      provider: 'spotify',
      id: 'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M',
      url: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
    },
  },
  {
    id: '37i9dQZF1DX4JAvHpjipBk',
    name: 'Rock Classics',
    artwork: createCoverArtwork(
      'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=640&auto=format&fit=crop&q=80',
    ),
    source: {
      provider: 'spotify',
      id: 'spotify:playlist:37i9dQZF1DX4JAvHpjipBk',
      url: 'https://open.spotify.com/playlist/37i9dQZF1DX4JAvHpjipBk',
    },
  },
  {
    id: '37i9dQZF1DX10zKzsJ2jva',
    name: 'Viva Latino',
    artwork: createCoverArtwork(
      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=640&auto=format&fit=crop&q=80',
    ),
    source: {
      provider: 'spotify',
      id: 'spotify:playlist:37i9dQZF1DX10zKzsJ2jva',
      url: 'https://open.spotify.com/playlist/37i9dQZF1DX10zKzsJ2jva',
    },
  },
  {
    id: '37i9dQZF1DX1lVhptIYRda',
    name: 'Mood Booster',
    artwork: createCoverArtwork(
      'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=640&auto=format&fit=crop&q=80',
    ),
    source: {
      provider: 'spotify',
      id: 'spotify:playlist:37i9dQZF1DX1lVhptIYRda',
      url: 'https://open.spotify.com/playlist/37i9dQZF1DX1lVhptIYRda',
    },
  },
  {
    id: '37i9dQZF1DX0XUsuxWHRQd',
    name: 'RapCaviar',
    artwork: createCoverArtwork(
      'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=640&auto=format&fit=crop&q=80',
    ),
    source: {
      provider: 'spotify',
      id: 'spotify:playlist:37i9dQZF1DX0XUsuxWHRQd',
      url: 'https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd',
    },
  },
];

const oembedCache = new Map<string, ArtworkSet>();

const resolveOembedArtwork = async (
  fetchFunction: FetchFunction,
  playlistUrl: string,
): Promise<ArtworkSet | undefined> => {
  if (oembedCache.has(playlistUrl)) {
    return oembedCache.get(playlistUrl);
  }

  try {
    const oembedEndpoint = `https://open.spotify.com/oembed?url=${encodeURIComponent(playlistUrl)}`;
    const response = await fetchFunction(oembedEndpoint);
    if (!response.ok) {
      return undefined;
    }
    const payload = (await response.json()) as {
      thumbnail_url?: string;
      thumbnail_width?: number;
      thumbnail_height?: number;
    };
    if (payload.thumbnail_url) {
      const artwork: ArtworkSet = {
        items: [
          {
            url: payload.thumbnail_url,
            width: payload.thumbnail_width ?? COVER_SIZE,
            height: payload.thumbnail_height ?? COVER_SIZE,
            purpose: 'cover',
            source: { provider: 'spotify', id: playlistUrl },
          },
        ],
      };
      oembedCache.set(playlistUrl, artwork);
      return artwork;
    }
  } catch {
    void 0;
  }
  return undefined;
};

export const createDashboardProvider = (
  fetchFunction?: FetchFunction,
): DashboardProvider => ({
  id: DASHBOARD_PROVIDER_ID,
  kind: 'dashboard',
  name: 'Spotify',
  metadataProviderId: 'spotify',
  capabilities: ['editorialPlaylists'],
  fetchEditorialPlaylists: async () => {
    if (!fetchFunction) {
      return PUBLIC_PLAYLISTS;
    }

    const settled = await Promise.allSettled(
      PUBLIC_PLAYLISTS.map(async (playlist) => {
        if (!playlist.source.url) {
          return playlist;
        }
        const dynamicArtwork = await resolveOembedArtwork(
          fetchFunction,
          playlist.source.url,
        );
        return {
          ...playlist,
          artwork: dynamicArtwork ?? playlist.artwork,
        };
      }),
    );

    return settled.map((result, index) =>
      result.status === 'fulfilled' ? result.value : PUBLIC_PLAYLISTS[index],
    );
  },
});

