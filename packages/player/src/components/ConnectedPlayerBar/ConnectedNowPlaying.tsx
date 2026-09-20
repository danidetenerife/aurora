import { useNavigate } from '@tanstack/react-router';
import { FC } from 'react';
import { toast } from 'sonner';

import { useTranslation } from '@aurora/i18n';
import { pickArtwork } from '@aurora/model';
import { PillRatingGroup, PlayerBar } from '@aurora/ui';

import { personalizationEngine } from '../../services/personalizationEngine';
import { useFavoritesStore } from '../../stores/favoritesStore';
import { useQueueStore } from '../../stores/queueStore';

export const ConnectedNowPlaying: FC<{
  actionsOnly?: boolean;
  hideActions?: boolean;
}> = ({ actionsOnly = false, hideActions = false }) => {
  const { t: tTrack } = useTranslation('track');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const track = useQueueStore(
    (state) => state.items[state.currentIndex]?.track,
  );
  const isFavorite = useFavoritesStore((state) =>
    track
      ? state.tracks.some(
          (entry) =>
            entry.ref.source?.provider === track.source?.provider &&
            entry.ref.source?.id === track.source?.id,
        )
      : false,
  );
  const addTrack = useFavoritesStore((state) => state.addTrack);
  const removeTrack = useFavoritesStore((state) => state.removeTrack);

  const artwork = pickArtwork(track?.artwork, 'thumbnail', 64);
  const title = track?.title ?? 'Sin reproducir';
  const artist = track?.artists[0]?.name ?? '';
  const album = track?.album;

  const handleToggleFavorite = () => {
    if (!track) {
      return;
    }
    if (isFavorite) {
      void removeTrack(track.source);
    } else {
      void addTrack(track);
    }
  };

  const handleDislike = () => {
    if (!track) {
      return;
    }
    const trackId =
      track.source?.id || `${track.artists?.[0]?.name}-${track.title}`;
    void personalizationEngine.blacklistTrack(trackId);
    toast.success(tTrack('actions.trackBlacklisted'), {
      action: {
        label: tCommon('actions.undo'),
        onClick: () => {
          void personalizationEngine.unblacklistTrack(trackId);
        },
      },
    });
    useQueueStore.getState().goToNext();
  };

  const actions = track && (
    <PillRatingGroup
      size="sm"
      isFavorite={isFavorite}
      onToggleFavorite={handleToggleFavorite}
      onDislike={handleDislike}
      labels={{
        favoriteAdd: tTrack('actions.addToFavorites'),
        favoriteRemove: tTrack('actions.removeFromFavorites'),
        dislike: tTrack('actions.dislike'),
      }}
      dislikeTestId="now-playing-dislike-button"
      data-testid="now-playing-pill-rating"
    />
  );
  if (actionsOnly) {
    return <>{actions}</>;
  }

  return (
    <PlayerBar.NowPlaying
      title={title}
      artist={artist}
      coverUrl={artwork?.url}
      onArtistClick={
        artist
          ? () => {
              const artistSource = track?.artists[0]?.source;
              if (artistSource?.provider && artistSource?.id) {
                void navigate({
                  to: '/artist/$providerId/$artistId',
                  params: {
                    providerId: artistSource.provider,
                    artistId: artistSource.id,
                  },
                });
              } else {
                void navigate({
                  to: '/search',
                  search: { q: artist },
                });
              }
            }
          : undefined
      }
      onTitleClick={
        album
          ? () =>
              navigate({
                to: '/album/$providerId/$albumId',
                params: {
                  providerId: album.source.provider,
                  albumId: album.source.id,
                },
              })
          : undefined
      }
      action={hideActions ? undefined : actions}
    />
  );
};
