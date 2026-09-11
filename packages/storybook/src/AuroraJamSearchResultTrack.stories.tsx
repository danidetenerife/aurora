import type { Meta } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import type { Track } from '@aurora/model';
import { AuroraJam } from '@aurora/ui';

const track = (title: string, artist: string, durationMs: number): Track => ({
  title,
  artists: [{ name: artist, roles: ['main'] }],
  durationMs,
  artwork: {
    items: [
      {
        url: `https://picsum.photos/seed/${encodeURIComponent(title)}/96`,
        width: 96,
        height: 96,
        purpose: 'thumbnail',
      },
    ],
  },
  source: { provider: 'mock', id: title },
});

const noArtworkTrack: Track = {
  title: 'Some Bootleg Recording',
  artists: [{ name: 'Unknown Artist', roles: ['main'] }],
  source: { provider: 'mock', id: 'bootleg' },
};

const meta = {
  title: 'Remote/AuroraJam/SearchResultTrack',
  component: AuroraJam.SearchResultTrack,
  tags: ['autodocs'],
} satisfies Meta<typeof AuroraJam.SearchResultTrack>;

export default meta;

export const ResultList = {
  render: () => (
    <div className="bg-background">
      <AuroraJam.SearchResultTrack
        track={track('Alberto Balsalm', 'Aphex Twin', 305000)}
        onAdd={fn()}
      />
      <AuroraJam.SearchResultTrack
        track={track('Xtal', 'Aphex Twin', 294000)}
        onAdd={fn()}
      />
      <AuroraJam.SearchResultTrack
        track={track(
          'Stone in Focus (with a very long title that should truncate)',
          'Aphex Twin featuring a Very Long Artist Name That Truncates',
          599000,
        )}
        onAdd={fn()}
      />
      <AuroraJam.SearchResultTrack track={noArtworkTrack} onAdd={fn()} />
    </div>
  ),
};
