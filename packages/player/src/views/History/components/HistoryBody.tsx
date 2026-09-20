import { FC } from 'react';

import { useTranslation } from '@aurora/i18n';
import type { HistoryRowLabels } from '@aurora/ui';
import { HistoryDayGroup, HistoryRow } from '@aurora/ui';

import type { HistoryEntry } from '../../../services/tauri/bindings';
import { formatTimeOfDay } from '../../../utils/time';
import { useDayMarker } from '../hooks/useDayMarker';
import { useHistoryRowActions } from '../hooks/useHistoryRowActions';
import { groupEntriesByDay } from '../utils/groupEntriesByDay';
import { HistoryEmptyState } from './HistoryEmptyState';
import { HistoryArtistLinks } from './HistoryLink';

type HistoryBodyProps = {
  isPending: boolean;
  entries: HistoryEntry[];
};

const formatTrackDuration = (totalMillis?: number | null) => {
  if (!totalMillis || totalMillis <= 0) {
    return '';
  }
  const totalSeconds = Math.floor(totalMillis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const HistoryBody: FC<HistoryBodyProps> = ({ isPending, entries }) => {
  const { t } = useTranslation('history');
  const markerFor = useDayMarker();
  const actionsFor = useHistoryRowActions();
  const rowLabels: HistoryRowLabels = {
    favorite: t('row.favorite'),
    unfavorite: t('row.unfavorite'),
    addToQueue: t('row.addToQueue'),
    duration: t('row.duration', 'Duración'),
    playedAt: t('row.playedAt', 'Hora'),
  };

  if (isPending) {
    return <div className="flex-1" data-testid="history-loading" />;
  }

  if (entries.length === 0) {
    return <HistoryEmptyState />;
  }

  return (
    <div className="flex w-full flex-1 flex-col gap-6 pb-6">
      {groupEntriesByDay(entries).map((group) => (
        <HistoryDayGroup
          key={group.day.toISODate()}
          marker={markerFor(group.day)}
        >
          {group.entries.map((entry) => (
            <HistoryRow
              key={entry.playId}
              title={entry.title}
              artist={entry.artists.join(', ')}
              artistContent={<HistoryArtistLinks artists={entry.artists} />}
              time={formatTimeOfDay(entry.startedAt)}
              duration={
                entry.durationMs
                  ? `${formatTrackDuration(entry.durationMs)} min`
                  : undefined
              }
              artworkUrl={entry.artworkUrl}
              labels={rowLabels}
              {...(actionsFor(entry) ?? {})}
            />
          ))}
        </HistoryDayGroup>
      ))}
    </div>
  );
};
