import { useNavigate } from '@tanstack/react-router';
import { ThumbsDown } from 'lucide-react';
import { FC } from 'react';
import { toast } from 'sonner';

import { useTranslation } from '@aurora/i18n';
import { pickArtwork } from '@aurora/model';
import { Button, FavoriteButton, PlayerBar } from '@aurora/ui';

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
  const currentItem = useQueueStore((state) => state.getCurrentItem());
  const { isTrackFavorite, addTrack, removeTrack } = useFavoritesStore();

  const track = currentItem?.track;
  const isFavorite = track ? isTrackFavorite(track.source) : false;

  const artwork = pickArtwork(track?.artwork, 'thumbnail', 64);
  const title = track?.title ?? 'Sin reproducir';
  const artist = track?.artists[0]?.name ?? '';
  const album = track?.album;

  const handleToggleFavorite = () => {
    if (!track) {
      return;
    }
    if (isFavorite) {
      removeTrack(track.source);
    } else {
      addTrack(track);
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
    <div className="flex items-center gap-0.5 sm:gap-1">
      <FavoriteButton
        size="sm"
        isFavorite={isFavorite}
        onToggle={handleToggleFavorite}
        ariaLabelAdd={tTrack('actions.addToFavorites')}
        ariaLabelRemove={tTrack('actions.removeFromFavorites')}
      />
      <Button
        size="icon-sm"
        variant="text"
        onClick={handleDislike}
        aria-label={tTrack('actions.dislike')}
        title={tTrack('actions.dislike')}
        data-testid="now-playing-dislike-button"
      >
        <ThumbsDown
          size={16}
          className="text-foreground-secondary hover:text-accent-red transition-colors"
        />
      </Button>
    </div>
  );
  if (actionsOnly) return <>{actions}</>;

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
