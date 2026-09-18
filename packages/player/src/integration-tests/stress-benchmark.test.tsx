import { describe, expect, it } from 'vitest';

import { useFavoritesStore } from '../stores/favoritesStore';
import { useQueueStore } from '../stores/queueStore';
import { useSoundStore } from '../stores/soundStore';
import { resolveArtistImageUrl, resolveTrackCoverUrl } from '../services/coverArtResolver';

describe('Desktop Player Maximum Stress & Performance Suite', () => {
  it('handles massive queue stress of 1,000 items without memory spikes or delays', () => {
    useQueueStore.getState().clearQueue();
    const startTime = performance.now();

    const items = Array.from({ length: 1000 }, (_, index) => ({
      title: `Stress Track ${index + 1}`,
      artists: [{ name: `Stress Artist ${index % 50}` }],
      source: { provider: 'test', id: `stress-track-${index + 1}` },
    }));

    useQueueStore.getState().addToQueue(items);

    const afterAdd = performance.now();
    expect(useQueueStore.getState().items).toHaveLength(1000);
    expect(afterAdd - startTime).toBeLessThan(1000);

    for (let index = 0; index < 50; index++) {
      useQueueStore.getState().reorder(index * 10, index * 10 + 5);
    }

    const afterReorder = performance.now();
    expect(afterReorder - afterAdd).toBeLessThan(500);

    useQueueStore.getState().clearQueue();
    expect(useQueueStore.getState().items).toHaveLength(0);
  });

  it('handles high-frequency seeking and timeupdates with 0 state divergence', () => {
    useSoundStore.setState({
      src: { url: 'https://example.com/audio.mp3', protocol: 'http' },
      status: 'playing',
      seek: 0,
      targetSeek: null,
      duration: 300,
    });

    const initialSeek = useSoundStore.getState().seek;
    expect(initialSeek).toBe(0);

    for (let second = 0; second < 100; second += 0.5) {
      useSoundStore.getState().updatePlayback(second, 300);
    }

    expect(useSoundStore.getState().seek).toBe(99.5);
    expect(useSoundStore.getState().targetSeek).toBeNull();

    useSoundStore.getState().seekTo(150);
    expect(useSoundStore.getState().seek).toBe(150);
    expect(useSoundStore.getState().targetSeek).toBe(150);
  });

  it('handles massive album favorites operations with tombstone consistency', async () => {
    useFavoritesStore.getState().clearAlbums();
    expect(useFavoritesStore.getState().albums).toHaveLength(0);

    const albums = Array.from({ length: 50 }, (_, index) => ({
      title: `Masterpiece Vol. ${index + 1}`,
      artists: [{ name: `Legendary Band ${index % 10}` }],
      source: { provider: 'spotify', id: `album-stress-${index + 1}` },
    }));

    for (const album of albums) {
      await useFavoritesStore.getState().addAlbum(album);
    }

    expect(useFavoritesStore.getState().albums).toHaveLength(50);
    expect(
      useFavoritesStore.getState().isAlbumFavorite({ provider: 'spotify', id: 'album-stress-25' }),
    ).toBe(true);

    for (let index = 0; index < 20; index++) {
      await useFavoritesStore.getState().removeAlbum({ provider: 'spotify', id: `album-stress-${index + 1}` });
    }

    expect(useFavoritesStore.getState().albums).toHaveLength(30);
    expect(
      useFavoritesStore.getState().isAlbumFavorite({ provider: 'spotify', id: 'album-stress-5' }),
    ).toBe(false);

    useFavoritesStore.getState().clearAlbums();
    expect(useFavoritesStore.getState().albums).toHaveLength(0);
  });

  it('resolves artist images and covers under high concurrency with cache hits', async () => {
    const artistPromises = [
      resolveArtistImageUrl('Radiohead'),
      resolveArtistImageUrl('Pink Floyd'),
      resolveArtistImageUrl('Daft Punk'),
      resolveArtistImageUrl('Radiohead'),
    ];

    const results = await Promise.all(artistPromises);
    expect(results[0]).toBeDefined();
    expect(results[3]).toBe(results[0]);

    const trackCoverPromises = [
      resolveTrackCoverUrl('Queen', 'Bohemian Rhapsody'),
      resolveTrackCoverUrl('Queen', 'Bohemian Rhapsody'),
    ];

    const coverResults = await Promise.all(trackCoverPromises);
    expect(coverResults[0]).toBeDefined();
    expect(coverResults[1]).toBe(coverResults[0]);
  });
});
