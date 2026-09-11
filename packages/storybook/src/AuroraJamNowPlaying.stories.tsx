import type { Meta } from '@storybook/react-vite';

import { AuroraJam } from '@aurora/ui';

const meta = {
  title: 'Remote/AuroraJam/NowPlaying',
  component: AuroraJam.NowPlaying,
  tags: ['autodocs'],
} satisfies Meta<typeof AuroraJam.NowPlaying>;

export default meta;

const cover = 'https://picsum.photos/208';

export const WithCoverArt = {
  render: () => (
    <div className="bg-background">
      <AuroraJam.NowPlaying
        title="Everything In Its Right Place"
        artist="Radiohead"
        coverUrl={cover}
      />
    </div>
  ),
};

export const Loading = {
  render: () => (
    <div className="bg-background">
      <AuroraJam.NowPlaying
        title="Everything In Its Right Place"
        artist="Radiohead"
        coverUrl={cover}
        isLoading
      />
    </div>
  ),
};

export const NoCoverArt = {
  render: () => (
    <div className="bg-background">
      <AuroraJam.NowPlaying title="No Cover Art" artist="Unknown Artist" />
    </div>
  ),
};
