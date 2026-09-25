import { FC } from 'react';

import type { Track } from '@aurora/model';

type TrackHeaderProps = {
  track: Track;
};

export const TrackHeader: FC<TrackHeaderProps> = ({ track }) => {
  const primaryArtist = track.artists[0]?.name;

  return (
    <div
      data-testid="track-header"
      className="border-border shrink-0 border-b-2 px-3 py-2"
    >
      <div
        data-testid="track-header-title"
        className="text-foreground text-sm leading-snug font-bold break-normal [overflow-wrap:anywhere] whitespace-normal"
      >
        {track.title}
      </div>
      {primaryArtist && (
        <div
          data-testid="track-header-artist"
          className="text-foreground-secondary mt-0.5 text-xs leading-tight break-normal [overflow-wrap:anywhere] whitespace-normal"
        >
          {primaryArtist}
        </div>
      )}
    </div>
  );
};
