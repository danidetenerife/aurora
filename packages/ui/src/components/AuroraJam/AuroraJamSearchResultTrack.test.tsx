import { render } from '@testing-library/react';

import type { Track } from '@aurora/model';

import { AuroraJamSearchResultTrack } from './AuroraJamSearchResultTrack';

const fullTrack: Track = {
  title: 'Windowlicker',
  artists: [{ name: 'Aphex Twin', roles: ['main'] }],
  durationMs: 366000,
  artwork: {
    items: [
      {
        url: 'https://example.com/cover.jpg',
        purpose: 'thumbnail',
        width: 48,
        height: 48,
      },
    ],
  },
  source: { provider: 'mock', id: '1' },
};

const minimalTrack: Track = {
  title: 'Untitled',
  artists: [],
  source: { provider: 'mock', id: '2' },
};

describe('AuroraJamSearchResultTrack', () => {
  it('(Snapshot) renders a full track', () => {
    const { container } = render(
      <AuroraJamSearchResultTrack track={fullTrack} onAdd={() => {}} />,
    );
    expect(container).toMatchSnapshot();
  });

  it('(Snapshot) renders a minimal track', () => {
    const { container } = render(
      <AuroraJamSearchResultTrack track={minimalTrack} onAdd={() => {}} />,
    );
    expect(container).toMatchSnapshot();
  });
});
