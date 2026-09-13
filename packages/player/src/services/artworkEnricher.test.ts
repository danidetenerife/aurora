import { useFavoritesStore } from '../stores/favoritesStore';
import { createTrack } from '../test/fixtures/queue';
import { enrichFavoriteTracks } from './artworkEnricher';

describe('favorite artwork enrichment', () => {
  it('does not trigger another favorites update for preserved YouTube artwork', async () => {
    const track = createTrack('Podcast episode');
    track.source.provider = 'youtube-music';
    track.artwork = {
      items: [{ url: 'https://i.ytimg.com/vi/episode/hqdefault.jpg' }],
    };
    const favorites = [{ ref: track, addedAtIso: '2026-09-13T08:00:00Z' }];
    useFavoritesStore.setState({ tracks: favorites });

    await enrichFavoriteTracks();
    await enrichFavoriteTracks();

    expect(useFavoritesStore.getState().tracks).toBe(favorites);
    expect(useFavoritesStore.getState().tracks[0].ref.artwork).toBe(
      track.artwork,
    );
  });
});
