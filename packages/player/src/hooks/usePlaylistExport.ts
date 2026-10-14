import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { useTranslation } from '@aurora/i18n';
import { PLAYLIST_EXPORT_VERSION } from '@aurora/model';

import { usePlaylistStore } from '../stores/playlistStore';
import { reportError } from '../utils/logging';

export const usePlaylistExport = (playlistId: string) => {
  const playlist = usePlaylistStore((state) => state.playlists.get(playlistId));
  const { t } = useTranslation('playlists');

  const exportAsJson = useCallback(async () => {
    try {
      const targetPlaylist =
        playlist ??
        (await usePlaylistStore.getState().loadPlaylist(playlistId));
      if (!targetPlaylist) {
        return;
      }

      const filePath = await save({
        defaultPath: `${targetPlaylist.name || 'playlist'}.json`,
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
      });

      if (!filePath) {
        return;
      }

      const exportData = {
        version: PLAYLIST_EXPORT_VERSION,
        playlist: targetPlaylist,
      };
      await writeTextFile(filePath, JSON.stringify(exportData, null, 2));
      toast.success(t('exportSuccess'));
    } catch (error) {
      await reportError('playlists', {
        userMessage: t('exportError'),
        error,
      });
    }
  }, [playlist, playlistId, t]);

  return { exportAsJson };
};
