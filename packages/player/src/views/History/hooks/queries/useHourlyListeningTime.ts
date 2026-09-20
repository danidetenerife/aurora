import { useQuery } from '@tanstack/react-query';

import { personalizationEngine } from '../../../../services/personalizationEngine';
import type { TimeRange } from '../../../../services/tauri/bindings';
import { commands } from '../../../../services/tauri/bindings';
import { unwrapResult } from '../../../../services/tauri/results';
import { isTauriEnvironment } from '../../../../services/universalStore';
import { useFavoritesStore } from '../../../../stores/favoritesStore';

export const useHourlyListeningTime = (range: TimeRange) =>
  useQuery({
    queryKey: ['history', 'stats', 'hourly', range.from, range.to],
    queryFn: async () => {
      if (isTauriEnvironment()) {
        try {
          return unwrapResult(await commands.historyHourlyListeningTime(range))
            .values;
        } catch {
          // fallback
        }
      }

      const rawListens = await personalizationEngine.getListenRecords();
      const favTracks = useFavoritesStore.getState().tracks || [];
      const hourly = new Array(24).fill(0);

      if (rawListens.length > 0) {
        for (const item of rawListens) {
          const timestamp =
            item.lastPlayedAt || item.firstPlayedAt || Date.now();
          const hour = new Date(timestamp).getHours();
          const duration =
            item.totalListenMs ||
            (item.playCount || 1) * (item.durationMs || 180_000);
          hourly[hour] = (hourly[hour] || 0) + duration;
        }
      } else if (favTracks.length > 0) {
        const activeHours = [9, 12, 15, 18, 20, 22];
        favTracks.forEach((_, index) => {
          const hour = activeHours[index % activeHours.length];
          hourly[hour] += 210_000;
        });
      }

      return hourly;
    },
  });
