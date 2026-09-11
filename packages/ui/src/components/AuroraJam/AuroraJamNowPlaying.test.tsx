import { render, screen } from '@testing-library/react';

import { AuroraJamNowPlaying } from './AuroraJamNowPlaying';

describe('AuroraJamNowPlaying', () => {
  it('(Snapshot) renders with cover art', () => {
    const { container } = render(
      <AuroraJamNowPlaying
        title="Weird Fishes"
        artist="Radiohead"
        coverUrl="https://example.com/cover.jpg"
      />,
    );
    expect(container).toMatchSnapshot();
  });

  it('omits the artist when none is given', () => {
    render(<AuroraJamNowPlaying title="Weird Fishes" />);

    expect(screen.queryByTestId('now-playing-artist')).not.toBeInTheDocument();
  });

  it('shows a placeholder when there is no cover art', () => {
    render(<AuroraJamNowPlaying title="Weird Fishes" />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
