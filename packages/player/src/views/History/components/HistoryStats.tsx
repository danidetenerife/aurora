import { DateTime, Info, Interval } from 'luxon';
import { FC } from 'react';

import { useTranslation } from '@aurora/i18n';
import {
  Box,
  DayOfWeekChart,
  ListeningClock,
  ScrollableArea,
  Select,
} from '@aurora/ui';

import { useFirstPlayAt } from '../hooks/queries/useFirstPlayAt';
import { useHistoryStats } from '../hooks/useHistoryStats';
import { formatHour, formatListeningDuration } from '../utils/format';
import type { RangePresetId } from '../utils/rangePresets';
import { RANGE_PRESET_IDS } from '../utils/rangePresets';
import { HistoryStatsEmptyState } from './HistoryStatsEmptyState';
import { HistoryTopLists } from './HistoryTopLists';

type HistoryStatsBodyProps = {
  firstPlayAt: number;
};

const HistoryStatsBody: FC<HistoryStatsBodyProps> = ({ firstPlayAt }) => {
  const { t } = useTranslation('history');
  const {
    presetId,
    setPresetId,
    range,
    hourlyValues,
    dayOfWeekValues,
    hasListening,
  } = useHistoryStats(firstPlayAt);

  const rangeDates = Interval.fromDateTimes(
    DateTime.fromMillis(range.from),
    DateTime.fromMillis(range.to),
  ).toLocaleString(DateTime.DATE_MED);

  const rangeLabels: Record<RangePresetId, string> = {
    last7Days: t('stats.range.last7Days'),
    last30Days: t('stats.range.last30Days'),
    last90Days: t('stats.range.last90Days'),
    last12Months: t('stats.range.last12Months'),
    allTime: t('stats.range.allTime'),
  };

  return (
    <>
      <div className="flex items-center justify-end gap-3">
        <span
          data-testid="history-stats-range-dates"
          className="text-foreground-secondary text-sm"
        >
          {rangeDates}
        </span>
        <div data-testid="history-stats-range" className="w-44">
          <Select
            options={RANGE_PRESET_IDS.map((id) => ({
              id,
              label: rangeLabels[id],
            }))}
            value={presetId}
            onValueChange={(value) => setPresetId(value as RangePresetId)}
          />
        </div>
      </div>
      <HistoryTopLists range={range} />
      {hourlyValues &&
        (hasListening ? (
          <div className="flex flex-col items-stretch gap-4 @3xl:flex-row">
            <Box variant="tertiary" className="w-auto flex-col gap-3">
              <h3 className="font-heading text-xl">{t('stats.hourOfDay')}</h3>
              <ListeningClock
                values={hourlyValues}
                labels={{
                  busiestHour: t('stats.busiestHour'),
                  busiestHourValue: t('stats.listeningTime'),
                }}
                formatValue={formatListeningDuration}
                formatHour={formatHour}
              />
            </Box>
            {dayOfWeekValues && (
              <Box variant="tertiary" className="min-w-0 flex-1 flex-col gap-3">
                <h3 className="font-heading text-xl">{t('stats.dayOfWeek')}</h3>
                <div className="min-h-0 flex-1">
                  <DayOfWeekChart
                    values={dayOfWeekValues}
                    labels={{ weekdays: Info.weekdays('short') }}
                    formatValue={formatListeningDuration}
                  />
                </div>
              </Box>
            )}
          </div>
        ) : (
          <HistoryStatsEmptyState />
        ))}
    </>
  );
};

export const HistoryStats: FC = () => {
  const { data: firstPlayAt, isPending } = useFirstPlayAt();

  return (
    <ScrollableArea
      data-testid="history-stats"
      viewportClassName="@container flex flex-col gap-4 p-4"
    >
      {!isPending &&
        (firstPlayAt ? (
          <HistoryStatsBody firstPlayAt={firstPlayAt.at} />
        ) : (
          <HistoryStatsEmptyState />
        ))}
    </ScrollableArea>
  );
};
