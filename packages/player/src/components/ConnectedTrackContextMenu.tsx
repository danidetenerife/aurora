import {
  Heart,
  ListEnd,
  ListMusicIcon,
  ListStart,
  Play,
  ThumbsDown,
  UserX,
} from 'lucide-react';
import { FC, ReactNode } from 'react';
import { toast } from 'sonner';

import { useTranslation } from '@aurora/i18n';
import { pickArtwork, Track } from '@aurora/model';
import { Input, TrackContextMenu } from '@aurora/ui';

import { usePlaylistSubmenu } from '../hooks/usePlaylistSubmenu';
import { useTrackActions } from '../hooks/useTrackActions';
import { personalizationEngine } from '../services/personalizationEngine';

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
  const trackActions = useTrackActions();
  const playlistSubmenu = usePlaylistSubmenu();

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

  return (
    <TrackContextMenu>
      <TrackContextMenu.Trigger>{children}</TrackContextMenu.Trigger>
      <TrackContextMenu.Content>
        <TrackContextMenu.Header
          title={track.title}
          subtitle={artistNames}
          coverUrl={thumbnail}
        />
        <TrackContextMenu.Action
          icon={<Play size={16} />}
          onClick={() => trackActions.playNow(track)}
        >
          {t('actions.playNow')}
        </TrackContextMenu.Action>
        <TrackContextMenu.Action
          icon={<ListStart size={16} />}
          onClick={() => trackActions.addNext(track)}
        >
          {t('actions.playNext')}
        </TrackContextMenu.Action>
        <TrackContextMenu.Action
          icon={<ListEnd size={16} />}
          onClick={() => trackActions.addToQueue(track)}
        >
          {t('actions.addToQueue')}
        </TrackContextMenu.Action>
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
