import { useMemo, useState } from 'react';

import type { PlaylistIndexEntry } from '@aurora/model';

export const usePlaylistFilter = (playlists: PlaylistIndexEntry[]) => {
  const [filter, setFilter] = useState('');
  const query = filter.trim().toLowerCase();

  const filteredPlaylists = useMemo(() => {
    const seen = new Set<string>();
    const unique = (playlists || []).filter((playlistItem) => {
      if (!playlistItem || !playlistItem.name) {
        return false;
      }
      const dedupeKey =
        playlistItem.id || playlistItem.name.toLowerCase().trim();
      if (seen.has(dedupeKey)) {
        return false;
      }
      seen.add(dedupeKey);
      return true;
    });

    if (query.length === 0) {
      return unique;
    }
    return unique.filter((playlist) =>
      playlist.name.toLowerCase().includes(query),
    );
  }, [playlists, query]);

  return {
    filter,
    setFilter,
    filteredPlaylists,
    hasFilter: query.length > 0,
  };
};
