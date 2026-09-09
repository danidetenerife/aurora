import { waitFor } from '@testing-library/react';

import { HistoryLinksWrapper as Wrapper } from './HistoryLinks.test-wrapper';

describe('History name actions', () => {
  it('plays a song using its resolved metadata', async () => {
    await Wrapper.mount();
    await Wrapper.click('Amor Total');
    await waitFor(() =>
      expect(Wrapper.currentTrack?.source.id).toBe('track-id'),
    );
    expect(Wrapper.currentTrack?.title).toBe('Amor Total');
  });

  it('opens an album using its identifier rather than its title', async () => {
    const router = await Wrapper.mount();
    await Wrapper.click('Singles');
    expect(await Wrapper.albumPage).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(
      '/album/test-metadata-provider/album-id',
    );
    expect(Wrapper.currentTrack).toBeUndefined();
  });

  it('opens an individual artist credit without starting playback', async () => {
    const router = await Wrapper.mount();
    await Wrapper.click('Ilegales');
    expect(await Wrapper.artistPage).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(
      '/artist/test-metadata-provider/artist-id',
    );
    expect(Wrapper.currentTrack).toBeUndefined();
  });
});
