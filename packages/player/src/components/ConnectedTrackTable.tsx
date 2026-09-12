import { useNavigate } from '@tanstack/react-router';
import { FC } from 'react';

import type { Track } from '@aurora/model';
import { TrackTable, TrackTableActions, TrackTableProps } from '@aurora/ui';

import { useQueueActions } from '../hooks/useQueueActions';
import { useTrackActions } from '../hooks/useTrackActions';
import { useTrackTableLabels } from '../hooks/useTrackTableLabels';
import { useProvidersStore } from '../stores/providersStore';
import { ConnectedTrackContextMenu } from './ConnectedTrackContextMenu';

type ConnectedTrackTableProps = Omit<
  TrackTableProps<Track>,
  'actions' | 'meta' | 'labels'
> & {
  actions?: Pick<TrackTableActions<Track>, 'onRemove' | 'onReorder'>;
  playbackTracks?: Track[];
  meta?: TrackTableProps<Track>['meta'];
};

export const ConnectedTrackTable: FC<ConnectedTrackTableProps> = (props) => {
  const { actions: externalActions, playbackTracks, ...restProps } = props;
  const queueTracks = playbackTracks ?? restProps.tracks;
  const trackActions = useTrackActions();
  const queueActions = useQueueActions();
  const labels = useTrackTableLabels();
  const navigate = useNavigate();

  return (
    <TrackTable
      {...restProps}
      labels={labels}
      display={{
        displayFavorite: true,
        ...restProps.display,
      }}
      actions={{
        onAddToQueue: trackActions.addToQueue,
        onPlayNow: (track) => {
          if (queueTracks.length > 0) {
            const trackIndex = queueTracks.findIndex(
              (item) =>
                (item.source?.id && item.source?.id === track.source?.id) ||
                (item.title === track.title &&
                  item.artists?.[0]?.name === track.artists?.[0]?.name),
            );
            queueActions.playTracks(
              queueTracks,
              trackIndex >= 0 ? trackIndex : 0,
            );
          } else {
            queueActions.playTracks([track], 0);
          }
        },
        onPlayNext: trackActions.addNext,
        onToggleFavorite: trackActions.toggleFavorite,
        onRemove: externalActions?.onRemove,
        onReorder: externalActions?.onReorder,
        onPlayAll: () => {
          queueActions.playTracks(queueTracks, 0);
        },
        onAddAllToQueue: () => {
          queueActions.addToQueue(queueTracks);
        },
        onArtistClick: (artistName) => {
          const activeMetadata =
            useProvidersStore.getState().getActive('metadata') ?? 'spotify';
          void navigate({
            to: `/artist/${activeMetadata}/${encodeURIComponent(artistName)}`,
          });
        },
        onAlbumClick: (albumTitle) => {
          const activeMetadata =
            useProvidersStore.getState().getActive('metadata') ?? 'spotify';
          void navigate({
            to: `/album/${activeMetadata}/${encodeURIComponent(albumTitle)}`,
          });
        },
      }}
      meta={{
        isTrackFavorite: trackActions.isFavorite,
        ContextMenuWrapper: ConnectedTrackContextMenu,
        ...restProps.meta,
      }}
    />
  );
};
