import { useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { useTranslation } from '@aurora/i18n';
import type { Playlist } from '@aurora/model';

import { usePlaylistStore } from '../../stores/playlistStore';

export const useSaveLocally = (playlist: Playlist | null) => {
  const { t } = useTranslation('playlists');
  const navigate = useNavigate();
  const importPlaylist = usePlaylistStore((state) => state.importPlaylist);

  const saveLocally = useCallback(async () => {
    if (!playlist) {
      return;
    }

    const newId = await importPlaylist(playlist);
    toast.success(t('importSuccess'));
    navigate({
      to: '/playlists/$playlistId',
      params: { playlistId: newId },
    });
  }, [playlist, importPlaylist, navigate, t]);

  return { saveLocally };
};
