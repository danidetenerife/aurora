import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import type { FC } from 'react';

import { useTranslation } from '@aurora/i18n';
import { Button, EmptyState, Loader, ScrollableArea } from '@aurora/ui';

import { ConnectedTrackTable } from '../../components/ConnectedTrackTable';
import { PodcastDetailHeader } from './components/PodcastDetailHeader';
import { usePodcastDetail } from './hooks/usePodcastDetail';

export const PodcastDetail: FC = () => {
  const { podcastId } = useParams({ from: '/podcast/$podcastId' });
  const { t } = useTranslation(['podcastBrowser', 'common']);
  const navigate = useNavigate();
  const {
    data: podcast,
    isLoading,
    isError,
    refetch,
  } = usePodcastDetail(podcastId);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <Loader size="xl" />
      </div>
    );
  }

  if (isError || !podcast) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <div className="text-accent-red text-center font-semibold">
          {t('podcastBrowser:loadError')}
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => {
              if (window.history.length > 1) {
                window.history.back();
              } else {
                void navigate({ to: '/podcasts' });
              }
            }}
          >
            <ArrowLeft size={16} className="mr-2" />
            {t('podcastBrowser:back')}
          </Button>
          <Button
            variant="default"
            onClick={() => {
              void refetch();
            }}
          >
            {t('common:actions.retry')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ScrollableArea className="bg-background" data-testid="podcast-detail-view">
      <PodcastDetailHeader podcast={podcast} />

      <div className="p-4 sm:p-6">
        {podcast.episodes.length === 0 ? (
          <EmptyState
            title={t('podcastBrowser:empty')}
            description={podcast.publisher}
            className="flex-1"
          />
        ) : (
          <ConnectedTrackTable
            tracks={podcast.episodes}
            rowHeight={64}
            features={{ playAll: true, addAllToQueue: true }}
            display={{
              displayThumbnail: true,
              displayDuration: true,
              displayArtist: false,
              displayQueueControls: true,
            }}
          />
        )}
      </div>
    </ScrollableArea>
  );
};
