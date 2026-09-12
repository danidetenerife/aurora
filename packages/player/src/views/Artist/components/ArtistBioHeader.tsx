import { FC } from 'react';

import { pickArtwork } from '@aurora/model';
import { Loader } from '@aurora/ui';

import { useArtistCardImage } from '../../Favorites/useArtistCardImage';
import { ConnectedFavoriteButton } from '../../../components/ConnectedFavoriteButton';
import { useArtistBio } from '../hooks/useArtistBio';
import { ArtistErrorBanner } from './ArtistErrorBanner';

const AVATAR_SIZE_PX = 300;

type ArtistBioHeaderProps = {
  providerId: string;
  artistId: string;
};

export const ArtistBioHeader: FC<ArtistBioHeaderProps> = ({
  providerId,
  artistId,
}) => {
  const {
    data: artist,
    isLoading,
    isError,
    error,
    refetch,
  } = useArtistBio(providerId, artistId);

  const avatarUrl = useArtistCardImage(artist?.name ?? '', pickArtwork(artist?.artwork, 'avatar', AVATAR_SIZE_PX)?.url, providerId);

  if (isLoading) {
    return (
      <div className="border-border bg-primary shadow-shadow m-4 flex items-center justify-center rounded-md border-(length:--border-width) p-6">
        <Loader size="xl" data-testid="artist-header-loader" />
      </div>
    );
  }

  if (isError) {
    return (
      <ArtistErrorBanner
        providerId={providerId}
        artistId={artistId}
        bioError={error}
        onRetry={() => void refetch()}
      />
    );
  }

  if (!artist) {
    return null;
  }


  return (
    <div className="border-border bg-primary shadow-shadow relative m-4 rounded-md border-(length:--border-width) p-6">
      <ConnectedFavoriteButton
        type="artist"
        source={{ provider: providerId, id: artistId }}
        data={{ name: artist.name, artwork: artist.artwork }}
        className="bg-background border-border absolute top-4 right-4 z-10 rounded-md border-(length:--border-width)"
        data-testid="artist-favorite-button"
      />
      <div className="flex items-center gap-5">
        {avatarUrl && (
          <img
            className="border-border shadow-shadow h-24 w-24 shrink-0 rounded-full border-(length:--border-width) object-cover"
            src={avatarUrl}
            alt={`${artist.name} avatar`}
          />
        )}
        <h1 className="font-heading min-w-0 pr-10 text-3xl leading-tight font-extrabold tracking-tight">
          {artist.name}
        </h1>
      </div>
    </div>
  );
};
