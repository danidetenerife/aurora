import { Music, VideoOff } from 'lucide-react';
import type { FC } from 'react';

import { pickArtwork, type Track } from '@aurora/model';

type TvCoverArtViewProps = {
  track?: Track;
};

export const TvCoverArtView: FC<TvCoverArtViewProps> = ({ track }) => {
  const artwork = track ? pickArtwork(track.artwork, 'thumbnail', 600) : null;
  const coverUrl = artwork?.url;
  const artistNames = track?.artists?.map((artist) => artist.name).join(', ') || '';

  return (
    <div
      data-testid="tv-cover-art-view"
      className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-emerald-500/40 bg-zinc-950 p-6 shadow-2xl"
      style={{
        width: '100%',
        maxWidth: '860px',
        aspectRatio: '16/9',
        margin: '0 auto',
      }}
    >
      {coverUrl && (
        <div
          className="absolute inset-0 scale-110 opacity-25 blur-2xl filter"
          style={{
            backgroundImage: `url(${coverUrl})`,
            backgroundPosition: 'center',
            backgroundSize: 'cover',
          }}
        />
      )}

      <div className="relative z-10 flex flex-col items-center gap-4 text-center">
        <div className="relative flex aspect-square w-48 items-center justify-center overflow-hidden rounded-xl border-2 border-white/10 bg-zinc-900 shadow-2xl sm:w-56">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={track?.title || ''}
              className="h-full w-full object-cover"
            />
          ) : (
            <Music className="h-16 w-16 text-emerald-400 opacity-60" />
          )}
        </div>

        <div className="flex max-w-md flex-col items-center gap-1">
          <h2 className="line-clamp-1 text-xl font-black text-white sm:text-2xl">
            {track?.title || 'Sin reproducción'}
          </h2>
          <p className="line-clamp-1 text-sm font-medium text-zinc-400 sm:text-base">
            {artistNames}
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/70 px-3 py-1 text-xs font-semibold text-emerald-300 backdrop-blur-md">
          <VideoOff className="h-3.5 w-3.5" />
          <span>Sin videoclip disponible · Mostrando carátula</span>
        </div>
      </div>
    </div>
  );
};
