import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PodcastRef } from '@aurora/model';

import { podcastService } from '../../services/podcastService';
import { initSpatialNavigation } from '../../services/spatialNavigation';
import { usePodcastStore } from '../../stores/podcastStore';
import { tvI18n } from './tvI18n';
import { playTvTracks } from './tvPlayback';
import { TvPodcastDetail } from './TvPodcastDetail';

vi.mock('./tvPlayback', () => ({
  playTvTracks: vi.fn(),
}));

vi.mock('../../services/podcastService', () => ({
  podcastService: {
    getPodcastDetails: vi.fn(),
    getFeaturedPodcasts: vi.fn().mockResolvedValue([]),
  },
}));

const mockPodcast: PodcastRef = {
  id: 'yt-test-podcast-1',
  name: 'Aurora Tech Talks',
  publisher: 'Aurora Team',
  artworkUrl: 'https://example.com/podcast.jpg',
  sourceUrl: 'https://music.youtube.com/browse/test-podcast-1',
};

const mockDetail = {
  id: 'yt-test-podcast-1',
  title: 'Aurora Tech Talks',
  publisher: 'Aurora Team',
  description: 'Deep conversations about high performance audio architecture.',
  artwork: 'https://example.com/podcast.jpg',
  source: 'youtube-music' as const,
  episodes: [
    {
      title: 'Episode 1: Audio Engine Internals',
      artists: [{ name: 'Aurora Team', roles: [] }],
      source: { provider: 'youtube-music', id: 'ep-1' },
      durationMs: 3600000,
      isPodcast: true,
    },
    {
      title: 'Episode 2: Spatial Navigation on Android TV',
      artists: [{ name: 'Aurora Team', roles: [] }],
      source: { provider: 'youtube-music', id: 'ep-2' },
      durationMs: 1800000,
      isPodcast: true,
    },
  ],
};

const renderWithClient = (uiComponent: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <I18nextProvider i18n={tvI18n}>
      <QueryClientProvider client={queryClient}>
        {uiComponent}
      </QueryClientProvider>
    </I18nextProvider>,
  );
};

describe('TvPodcastDetail', () => {
  beforeAll(() => {
    initSpatialNavigation();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    usePodcastStore.setState({ favorites: [], loaded: true });
    vi.mocked(podcastService.getPodcastDetails).mockResolvedValue(mockDetail);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders podcast metadata, hero banner and episode list', async () => {
    const handleBack = vi.fn();
    renderWithClient(
      <TvPodcastDetail podcast={mockPodcast} onBack={handleBack} />,
    );

    expect(
      await screen.findByText('Episode 1: Audio Engine Internals'),
    ).toBeInTheDocument();
    expect(screen.getByText('Aurora Tech Talks')).toBeInTheDocument();
    expect(screen.getByText('Aurora Team')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Deep conversations about high performance audio architecture.',
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByText('Episode 2: Spatial Navigation on Android TV'),
    ).toBeInTheDocument();
    expect(screen.getByText('1h 0m')).toBeInTheDocument();
    expect(screen.getByText('30:00')).toBeInTheDocument();
  });

  it('toggles favorite state in podcastStore when clicking favorite button', async () => {
    const handleBack = vi.fn();
    renderWithClient(
      <TvPodcastDetail podcast={mockPodcast} onBack={handleBack} />,
    );

    const favButton = await screen.findByTestId('tv-podcast-fav-btn');
    expect(favButton).toHaveTextContent('Guardar favorito');

    await userEvent.click(favButton);
    expect(usePodcastStore.getState().favorites).toHaveLength(1);
    expect(usePodcastStore.getState().favorites[0].id).toBe(mockPodcast.id);
    expect(favButton).toHaveTextContent('En Favoritos');

    await userEvent.click(favButton);
    expect(usePodcastStore.getState().favorites).toHaveLength(0);
    expect(favButton).toHaveTextContent('Guardar favorito');
  });

  it('plays the selected episode when clicking an episode row', async () => {
    const handleBack = vi.fn();
    renderWithClient(
      <TvPodcastDetail podcast={mockPodcast} onBack={handleBack} />,
    );

    const episodeRow = await screen.findByTestId('tv-podcast-episode-1');
    await userEvent.click(episodeRow);

    expect(playTvTracks).toHaveBeenCalledWith(mockDetail.episodes, 1);
  });

  it('plays the latest episode when clicking play latest button', async () => {
    const handleBack = vi.fn();
    renderWithClient(
      <TvPodcastDetail podcast={mockPodcast} onBack={handleBack} />,
    );

    const playLatestButton = await screen.findByTestId(
      'tv-podcast-play-latest-btn',
    );
    await userEvent.click(playLatestButton);

    expect(playTvTracks).toHaveBeenCalledWith(mockDetail.episodes, 0);
  });

  it('calls onBack when clicking the back button', async () => {
    const handleBack = vi.fn();
    renderWithClient(
      <TvPodcastDetail podcast={mockPodcast} onBack={handleBack} />,
    );

    const backButton = await screen.findByTestId('tv-podcast-back-button');
    await userEvent.click(backButton);

    expect(handleBack).toHaveBeenCalledTimes(1);
  });

  it('shows error message and allows retry when details fail to load', async () => {
    vi.mocked(podcastService.getPodcastDetails).mockRejectedValueOnce(
      new Error('Network error'),
    );

    const handleBack = vi.fn();
    renderWithClient(
      <TvPodcastDetail podcast={mockPodcast} onBack={handleBack} />,
    );

    expect(
      await screen.findByText('No se pudieron cargar los episodios.'),
    ).toBeInTheDocument();

    vi.mocked(podcastService.getPodcastDetails).mockResolvedValue(mockDetail);
    const retryButton = screen.getByRole('button', { name: 'Reintentar' });
    await userEvent.click(retryButton);

    expect(
      await screen.findByText('Episode 1: Audio Engine Internals'),
    ).toBeInTheDocument();
  });
});
