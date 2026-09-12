import { FC, useMemo } from 'react';

import { useTranslation } from '@aurora/i18n';
import { Loader } from '@aurora/ui';

import { ConnectedTrackTable } from '../../../components/ConnectedTrackTable';
import { MobileTrackPages } from '../../../components/MobileTrackPages';
import { isCapacitorEnvironment } from '../../../services/universalStore';
import { useDashboardTopTracks } from '../hooks/useDashboardData';

export const TopTracksWidget: FC = () => {
  const { t } = useTranslation('dashboard');
  const { data: results, isLoading } = useDashboardTopTracks();

  const tracks = useMemo(
    () => results?.flatMap((result) => result.items) ?? [],
    [results],
  );

  return (
    <div
      data-testid="dashboard-top-tracks"
      className={
        isCapacitorEnvironment()
          ? 'flex min-h-0 flex-1 flex-col'
          : 'flex flex-col'
      }
    >
      <h2 className="mb-2 text-lg font-semibold">{t('top-tracks')}</h2>
      {isLoading ? (
        <div className="flex items-center justify-center p-4">
          <Loader data-testid="dashboard-top-tracks-loader" />
        </div>
      ) : isCapacitorEnvironment() ? (
        <MobileTrackPages tracks={tracks} />
      ) : (
        <ConnectedTrackTable
          tracks={tracks}
          features={{ filterable: false, playAll: true, addAllToQueue: true }}
          display={{ displayDuration: false }}
        />
      )}
    </div>
  );
};
