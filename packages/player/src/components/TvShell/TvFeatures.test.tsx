import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { eventBus } from '../../services/eventBus';
import { p2pSyncService } from '../../services/p2pSyncService';
import { personalizationEngine } from '../../services/personalizationEngine';
import { initSpatialNavigation } from '../../services/spatialNavigation';
import { useFavoritesStore } from '../../stores/favoritesStore';
import { useQueueStore } from '../../stores/queueStore';
import { TvCoverArtView } from './TvCoverArtView';
import { POPULAR_TV_PLAYLISTS, TvDashboard } from './TvDashboard';
import { TvNowPlayingBar } from './TvNowPlayingBar';
import { TvSyncSection } from './TvSyncSection';

vi.mock('../../services/p2pSyncService', () => ({
  p2pSyncService: {
    getGistConfig: vi.fn().mockResolvedValue({ token: '' }),
    setGistConfig: vi.fn().mockResolvedValue(undefined),
    getSyncProvider: vi.fn().mockResolvedValue('none'),
    setSyncProvider: vi.fn().mockResolvedValue(undefined),
    getLastSyncTime: vi.fn().mockResolvedValue(null),
    isAutoSyncEnabled: vi.fn().mockResolvedValue(true),
    setAutoSyncEnabled: vi.fn().mockResolvedValue(undefined),
    syncNow: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('../../hooks/useProviders', () => ({
  useProviders: vi.fn().mockReturnValue([]),
}));

vi.mock('../../services/personalizationEngine', () => ({
  personalizationEngine: {
    getTopArtists: vi.fn().mockResolvedValue([]),
    getTopGenres: vi.fn().mockResolvedValue([]),
    getSeedTracks: vi.fn().mockResolvedValue([]),
    getListenRecords: vi.fn().mockResolvedValue([]),
    getBlacklist: vi.fn().mockResolvedValue({ tracks: [], artists: [] }),
    subscribe: vi.fn().mockReturnValue(() => {}),
    blacklistTrack: vi.fn().mockResolvedValue(undefined),
    blacklistArtist: vi.fn().mockResolvedValue(undefined),
    notify: vi.fn(),
  },
  normalizeArtistKey: (name: string) =>
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim(),
}));

describe('Google TV Features', () => {
  beforeAll(() => {
    initSpatialNavigation();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    useFavoritesStore.setState({ tracks: [], artists: [], albums: [] });
    useQueueStore.setState({ items: [], currentIndex: 0 });
  });

  afterEach(() => {
    cleanup();
  });

  describe('TvDashboard', () => {
    it('renders recommended music and popular playlists without being empty', async () => {
      render(<TvDashboard />);

      expect(
        screen.getByText('Música recomendada para ti'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Listas Populares y Tendencias'),
      ).toBeInTheDocument();

      // Verify all popular playlists are rendered
      for (const playlist of POPULAR_TV_PLAYLISTS) {
        expect(screen.getByText(playlist.title)).toBeInTheDocument();
      }

      // Verify search quick access card
      expect(screen.getByText('Buscar más música')).toBeInTheDocument();
    });

    it('uses first favorite track as hero track fallback when recommended tracks are empty', () => {
      useFavoritesStore.setState({
        tracks: [
          {
            key: 'fav-1',
            addedAtIso: new Date().toISOString(),
            ref: {
              title: 'Subterranean Homesick Alien',
              artists: [{ name: 'Radiohead', roles: [] }],
              source: { provider: 'test', id: 'sha-1' },
            },
          },
        ],
        artists: [],
        albums: [],
      });

      render(<TvDashboard />);

      expect(
        screen.getByText('Subterranean Homesick Alien'),
      ).toBeInTheDocument();
      expect(screen.getByText('Radiohead')).toBeInTheDocument();
    });

    it('filters userFallbackHeroTrack against blacklists and picks the next non-blacklisted favorite track', async () => {
      vi.mocked(personalizationEngine.getBlacklist).mockResolvedValueOnce({
        tracks: ['blacklisted-1'],
        artists: ['evil artist'],
      });

      useFavoritesStore.setState({
        tracks: [
          {
            key: 'fav-blacklisted-track',
            addedAtIso: new Date().toISOString(),
            ref: {
              title: 'Blacklisted Track Title',
              artists: [{ name: 'Allowed Artist', roles: [] }],
              source: { provider: 'test', id: 'blacklisted-1' },
            },
          },
          {
            key: 'fav-blacklisted-artist',
            addedAtIso: new Date().toISOString(),
            ref: {
              title: 'Evil Song',
              artists: [{ name: 'Evil Artist', roles: [] }],
              source: { provider: 'test', id: 'evil-1' },
            },
          },
          {
            key: 'fav-clean',
            addedAtIso: new Date().toISOString(),
            ref: {
              title: 'Weird Fishes',
              artists: [{ name: 'Radiohead', roles: [] }],
              source: { provider: 'test', id: 'wf-1' },
            },
          },
        ],
        artists: [],
        albums: [],
      });

      render(<TvDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Weird Fishes')).toBeInTheDocument();
      });
      expect(
        screen.queryByText('Blacklisted Track Title'),
      ).not.toBeInTheDocument();
      expect(screen.queryByText('Evil Song')).not.toBeInTheDocument();
    });
  });

  describe('TvCoverArtView', () => {
    it('renders track title, artist and cover fallback badge', () => {
      const mockTrack = {
        title: 'Karma Police',
        artists: [{ name: 'Radiohead', roles: [] }],
        source: { provider: 'test', id: '123' },
        artwork: {
          items: [
            {
              url: 'https://example.com/cover.jpg',
              purpose: 'thumbnail' as const,
            },
          ],
        },
      };

      render(<TvCoverArtView track={mockTrack} />);

      expect(screen.getByText('Karma Police')).toBeInTheDocument();
      expect(screen.getByText('Radiohead')).toBeInTheDocument();
      expect(
        screen.getByText('Sin videoclip disponible · Mostrando carátula'),
      ).toBeInTheDocument();
    });

    it('renders fallback placeholder when track has no cover', () => {
      render(<TvCoverArtView />);

      expect(screen.getByText('Sin reproducción')).toBeInTheDocument();
    });
  });

  describe('TvSyncSection (GitHub connection)', () => {
    it('renders input for GitHub PAT and connects successfully', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ login: 'danidetenerife' }),
        }),
      );

      render(<TvSyncSection />);

      expect(screen.getByText('Sincronización con GitHub')).toBeInTheDocument();
      expect(screen.getByText('Sin conectar')).toBeInTheDocument();

      const input = screen.getByTestId('tv-github-token-input');
      await userEvent.type(input, 'ghp_secret_token_123');
      expect(input).toHaveValue('ghp_secret_token_123');

      const connectBtn = screen.getByRole('button', {
        name: 'Conectar y Sincronizar',
      });
      await userEvent.click(connectBtn);

      expect(p2pSyncService.setGistConfig).toHaveBeenCalledWith({
        token: 'ghp_secret_token_123',
      });
      expect(p2pSyncService.syncNow).toHaveBeenCalled();
    });
  });

  describe('TvNowPlayingBar dislike behavior', () => {
    it('blacklists track and artist, prunes upcoming matching tracks from queue, and emits skip', async () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');
      const currentTrack = {
        title: 'Annoying Song',
        artists: [{ name: 'Spam Artist', roles: [] }],
        source: { provider: 'test', id: 'bad-track-id' },
      };
      const upcomingBadTrack = {
        title: 'Another Annoying Song',
        artists: [{ name: 'Spam Artist', roles: [] }],
        source: { provider: 'test', id: 'bad-track-2' },
      };
      const upcomingGoodTrack = {
        title: 'Good Song',
        artists: [{ name: 'Great Artist', roles: [] }],
        source: { provider: 'test', id: 'good-track-1' },
      };

      useQueueStore.setState({
        items: [
          {
            id: 'item-1',
            track: currentTrack,
            status: 'playing',
            addedAtIso: '',
          },
          {
            id: 'item-2',
            track: upcomingBadTrack,
            status: 'idle',
            addedAtIso: '',
          },
          {
            id: 'item-3',
            track: upcomingGoodTrack,
            status: 'idle',
            addedAtIso: '',
          },
        ],
        currentIndex: 0,
      });

      render(<TvNowPlayingBar />);

      const dislikeButton = screen.getByRole('button', {
        name: 'No me gusta',
      });
      await userEvent.click(dislikeButton);

      expect(personalizationEngine.blacklistTrack).toHaveBeenCalledWith(
        'bad-track-id',
      );
      expect(personalizationEngine.blacklistArtist).toHaveBeenCalledWith(
        'Spam Artist',
      );
      expect(emitSpy).toHaveBeenCalledWith(
        'playbackSkipped',
        expect.any(Object),
      );

      const remainingItems = useQueueStore.getState().items;
      expect(
        remainingItems.some(
          (item) => item.track.title === 'Another Annoying Song',
        ),
      ).toBe(false);
      expect(
        remainingItems.some((item) => item.track.title === 'Good Song'),
      ).toBe(true);
      expect(personalizationEngine.notify).toHaveBeenCalledWith('local');
    });

    it('prunes upcoming tracks by artist even with diacritic mismatches (e.g. Beyoncé vs Beyonce)', async () => {
      const currentTrack = {
        title: 'Halo',
        artists: [{ name: 'Beyoncé', roles: [] }],
        source: { provider: 'test', id: 'halo-1' },
      };
      const upcomingAccentTrack = {
        title: 'Single Ladies',
        artists: [{ name: 'Beyonce', roles: [] }],
        source: { provider: 'test', id: 'sl-1' },
      };
      const upcomingOtherTrack = {
        title: 'Other Song',
        artists: [{ name: 'Other Artist', roles: [] }],
        source: { provider: 'test', id: 'other-1' },
      };

      useQueueStore.setState({
        items: [
          {
            id: 'item-1',
            track: currentTrack,
            status: 'playing',
            addedAtIso: '',
          },
          {
            id: 'item-2',
            track: upcomingAccentTrack,
            status: 'idle',
            addedAtIso: '',
          },
          {
            id: 'item-3',
            track: upcomingOtherTrack,
            status: 'idle',
            addedAtIso: '',
          },
        ],
        currentIndex: 0,
      });

      render(<TvNowPlayingBar />);

      const dislikeButton = screen.getByRole('button', {
        name: 'No me gusta',
      });
      await userEvent.click(dislikeButton);

      const remainingItems = useQueueStore.getState().items;
      expect(
        remainingItems.some((item) => item.track.title === 'Single Ladies'),
      ).toBe(false);
      expect(
        remainingItems.some((item) => item.track.title === 'Other Song'),
      ).toBe(true);
    });
  });
});
