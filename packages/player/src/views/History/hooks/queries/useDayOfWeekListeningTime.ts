import { useQuery } from '@tanstack/react-query';
import groupBy from 'lodash-es/groupBy';
import meanBy from 'lodash-es/meanBy';
import { DateTime } from 'luxon';

import type { DayOfWeekValues } from '@aurora/ui';

import { personalizationEngine } from '../../../../services/personalizationEngine';
import type { TimeRange } from '../../../../services/tauri/bindings';
import { commands } from '../../../../services/tauri/bindings';
import { unwrapResult } from '../../../../services/tauri/results';
import { isTauriEnvironment } from '../../../../services/universalStore';
import { useFavoritesStore } from '../../../../stores/favoritesStore';

export const useDayOfWeekListeningTime = (timeRange: TimeRange) =>
  useQuery<DayOfWeekValues>({
    queryKey: ['history', 'stats', 'dayOfWeek', timeRange.from, timeRange.to],
    queryFn: async () => {
      if (isTauriEnvironment()) {
        try {
          const days = unwrapResult(
            await commands.historyDailyListeningTime(timeRange),
          );

          const byWeekday = groupBy(
            days,
            (day) => DateTime.fromISO(day.date).weekday,
          );

          const averageFor = (weekday: number) =>
            meanBy(byWeekday[weekday] ?? [{ value: 0 }], 'value');

          return [
            averageFor(1),
            averageFor(2),
            averageFor(3),
            averageFor(4),
            averageFor(5),
            averageFor(6),
            averageFor(7),
          ];
        } catch {
          // fallback
        }
      }

      const rawListens = await personalizationEngine.getListenRecords();
      const favTracks = useFavoritesStore.getState().tracks || [];
      const dayValues = [0, 0, 0, 0, 0, 0, 0];

      if (rawListens.length > 0) {
        for (const item of rawListens) {
          const timestamp =
            item.lastPlayedAt || item.firstPlayedAt || Date.now();
          const weekday = DateTime.fromMillis(timestamp).weekday;
          const duration =
            item.totalListenMs ||
            (item.playCount || 1) * (item.durationMs || 180_000);
          dayValues[weekday - 1] += duration;
        }
      } else if (favTracks.length > 0) {
        favTracks.forEach((_, index) => {
          const dayIndex = index % 7;
          dayValues[dayIndex] += 300_000;
        });
      }

      return [
        dayValues[0],
        dayValues[1],
        dayValues[2],
        dayValues[3],
        dayValues[4],
        dayValues[5],
        dayValues[6],
      ];
    },
  });
