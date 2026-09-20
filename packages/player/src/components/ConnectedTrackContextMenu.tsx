import { useNavigate } from '@tanstack/react-router';
import {
  Disc,
  Heart,
  ListEnd,
  ListMusicIcon,
  ListStart,
  Play,
  ThumbsDown,
  UserX,
} from 'lucide-react';
import {
  cloneElement,
  FC,
  isValidElement,
  ReactElement,
  ReactNode,
} from 'react';
import { toast } from 'sonner';

import { useTranslation } from '@aurora/i18n';
import { pickArtwork, Track } from '@aurora/model';
import { Input, TrackContextMenu } from '@aurora/ui';

import { usePlaylistSubmenu } from '../hooks/usePlaylistSubmenu';
import { useTrackActions } from '../hooks/useTrackActions';
import { personalizationEngine } from '../services/personalizationEngine';
import { isCapacitorEnvironment } from '../services/universalStore';
import { useFavoritesStore } from '../stores/favoritesStore';
import { useMobilePlayerStore } from '../stores/mobilePlayerStore';

type ConnectedTrackContextMenuProps = {
  track: Track;
  children: ReactNode;
};

export const ConnectedTrackContextMenu: FC<ConnectedTrackContextMenuProps> = ({
  track,
  children,
}) => {
  const { t } = useTranslation('track');
  const { t: tCommon } = useTranslation('common');
  const { t: tPlaylists } = useTranslation('playlists');
  const navigate = useNavigate();
  const trackActions = useTrackActions();
  const playlistSubmenu = usePlaylistSubmenu();

  const isAlbumFavorite = useFavoritesStore((state) =>
    track.album
      ? state.albums.some(
          (entry) =>
            entry.ref.source.provider === track.album?.source.provider &&
            entry.ref.source.id === track.album?.source.id,
        )
      : false,
  );
  const addAlbum = useFavoritesStore((state) => state.addAlbum);
  const removeAlbum = useFavoritesStore((state) => state.removeAlbum);

  const isFavorite = trackActions.isFavorite(track);
  const thumbnail = pickArtwork(track.artwork, 'thumbnail', 64)?.url;
  const artistNames = track.artists.map((artist) => artist.name).join(', ');

  const handleBlacklistTrack = () => {
    const trackId =
      track.source?.id || `${track.artists?.[0]?.name}-${track.title}`;
    void personalizationEngine.blacklistTrack(trackId);
    toast.success(t('actions.trackBlacklisted'), {
      action: {
        label: tCommon('actions.undo'),
        onClick: () => {
          void personalizationEngine.unblacklistTrack(trackId);
        },
      },
    });
  };

  const handleBlacklistArtist = () => {
    const artistName = track.artists[0]?.name;
    if (!artistName) {
      return;
    }
    void personalizationEngine.blacklistArtist(artistName);
    toast.success(t('actions.artistBlacklisted'), {
      action: {
        label: tCommon('actions.undo'),
        onClick: () => {
          void personalizationEngine.unblacklistArtist(artistName);
        },
      },
    });
  };

  if (isCapacitorEnvironment()) {
    if (isValidElement(children)) {
      return cloneElement(
        children as ReactElement<{ onClick?: (e: React.MouseEvent) => void }>,
        {
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            useMobilePlayerStore.getState().openContextMenu(track);
          },
        },
      );
    }
    return (
      <div
        role="button"
        tabIndex={0}
        onClickCapture={(e) => {
          e.stopPropagation();
          useMobilePlayerStore.getState().openContextMenu(track);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
            useMobilePlayerStore.getState().openContextMenu(track);
          }
        }}
        className="inline-flex cursor-pointer"
        data-testid="mobile-context-menu-trigger"
      >
        {children}
      </div>
    );
  }

  return (
    <TrackContextMenu>
      <TrackContextMenu.Trigger>{children}</TrackContextMenu.Trigger>
      <TrackContextMenu.Content>
        <TrackContextMenu.Header
          title={track.title}
          subtitle={artistNames}
          coverUrl={thumbnail}
        />
        <TrackContextMenu.HeroGrid>
          <TrackContextMenu.HeroItem
            icon={<Play size={18} />}
            onClick={() => trackActions.playNow(track)}
            data-testid="track-hero-play-now"
          >
            {t('actions.playNow')}
          </TrackContextMenu.HeroItem>
          <TrackContextMenu.HeroItem
            icon={<ListStart size={18} />}
            onClick={() => trackActions.addNext(track)}
            data-testid="track-hero-play-next"
          >
            {t('actions.playNext')}
          </TrackContextMenu.HeroItem>
          <TrackContextMenu.HeroItem
            icon={<ListEnd size={18} />}
            onClick={() => trackActions.addToQueue(track)}
            data-testid="track-hero-add-queue"
          >
            {t('actions.addToQueue')}
          </TrackContextMenu.HeroItem>
        </TrackContextMenu.HeroGrid>
        <TrackContextMenu.Action
          icon={<Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />}
          onClick={() => trackActions.toggleFavorite(track)}
        >
          {isFavorite
            ? t('actions.removeFromFavorites')
            : t('actions.addToFavorites')}
        </TrackContextMenu.Action>
        <TrackContextMenu.Action
          icon={<ThumbsDown size={16} />}
          onClick={handleBlacklistTrack}
          data-testid="track-blacklist-track"
        >
          {t('actions.dislike')}
        </TrackContextMenu.Action>
        {track.artists[0]?.name && (
          <TrackContextMenu.Action
            icon={<UserX size={16} />}
            onClick={handleBlacklistArtist}
            data-testid="track-blacklist-artist"
          >
            {t('actions.blacklistArtist')}
          </TrackContextMenu.Action>
        )}
        {track.album && (
          <>
            <TrackContextMenu.Action
              icon={
                <Heart
                  size={16}
                  fill={isAlbumFavorite ? 'currentColor' : 'none'}
                />
              }
              onClick={() => {
                if (isAlbumFavorite) {
                  void removeAlbum(track.album!.source);
                } else {
                  void addAlbum(track.album!);
                }
              }}
              data-testid="track-favorite-album"
            >
              {isAlbumFavorite
                ? t('actions.removeAlbumFromFavorites')
                : t('actions.addAlbumToFavorites')}
            </TrackContextMenu.Action>
            <TrackContextMenu.Action
              icon={<Disc size={16} />}
              onClick={() => {
                void navigate({
                  to: '/album/$providerId/$albumId',
                  params: {
                    providerId: track.album!.source.provider,
                    albumId: track.album!.source.id,
                  },
                });
              }}
              data-testid="track-go-to-album"
            >
              {t('actions.goToAlbum')}
            </TrackContextMenu.Action>
          </>
        )}
        {playlistSubmenu.hasPlaylists && (
          <TrackContextMenu.Submenu>
            <TrackContextMenu.Submenu.Trigger
              icon={<ListMusicIcon size={16} />}
            >
              {tPlaylists('addToPlaylist')}
            </TrackContextMenu.Submenu.Trigger>
            <TrackContextMenu.Submenu.Content>
              {playlistSubmenu.showFilter && (
                <div onKeyDown={(event) => event.stopPropagation()}>
                  <Input
                    size="sm"
                    variant="borderless"
                    placeholder={tPlaylists('filterPlaylists')}
                    value={playlistSubmenu.filterText}
                    onChange={(event) =>
                      playlistSubmenu.setFilterText(event.target.value)
                    }
                    data-testid="playlist-filter-input"
                  />
                </div>
              )}
              {playlistSubmenu.playlists.map((entry) => (
                <TrackContextMenu.Action
                  key={entry.id}
                  onClick={() => playlistSubmenu.addTracks(entry.id, [track])}
                  data-testid="playlist-submenu-item"
                >
                  {entry.name}
                </TrackContextMenu.Action>
              ))}
            </TrackContextMenu.Submenu.Content>
          </TrackContextMenu.Submenu>
        )}
      </TrackContextMenu.Content>
    </TrackContextMenu>
  );
};
