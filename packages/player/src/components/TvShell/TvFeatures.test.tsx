import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { p2pSyncService } from '../../services/p2pSyncService';
import { initSpatialNavigation } from '../../services/spatialNavigation';
import { TvCoverArtView } from './TvCoverArtView';
import { POPULAR_TV_PLAYLISTS, TvDashboard } from './TvDashboard';
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
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
}));

describe('Google TV Features', () => {
  beforeAll(() => {
    initSpatialNavigation();
  });

  beforeEach(() => {
    vi.clearAllMocks();
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
});
