import { FC } from 'react';

import { useTranslation } from '@aurora/i18n';
import type { DashboardProvider } from '@aurora/plugin-sdk';
import { Loader, ViewShell } from '@aurora/ui';

import { useProviders } from '../../hooks/useProviders';
import { useStartupStore } from '../../stores/startupStore';
import { DashboardEmptyState } from './components/DashboardEmptyState';
import { PersonalizedMixWidget } from './components/PersonalizedMixWidget';
import { DASHBOARD_WIDGETS } from './dashboardWidgets';

const DashboardContent: FC<{ isStartingUp: boolean }> = ({ isStartingUp }) => {
  const dashboardProviders = useProviders('dashboard') as DashboardProvider[];
  const metadataProviders = useProviders('metadata');

  if (isStartingUp) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader data-testid="dashboard-loader" size="xl" />
      </div>
    );
  }

  if (dashboardProviders.length === 0 && metadataProviders.length === 0) {
    return <DashboardEmptyState />;
  }

  const activeCapabilities = new Set(
    dashboardProviders.flatMap((provider) => provider.capabilities ?? []),
  );
  const activeWidgets = DASHBOARD_WIDGETS.filter((widget) =>
    activeCapabilities.has(widget.capability),
  );

  return (
    <div className="flex flex-col gap-6 pb-12">
      {metadataProviders.length > 0 && <PersonalizedMixWidget />}
      {activeWidgets.map((widget) => {
        const WidgetComponent = widget.component;
        return <WidgetComponent key={widget.capability} />;
      })}
    </div>
  );
};

export const Dashboard: FC = () => {
  const { t } = useTranslation('dashboard');
  const isStartingUp = useStartupStore((state) => state.isStartingUp);

  return (
    <ViewShell data-testid="dashboard-view" title={t('title')}>
      <DashboardContent isStartingUp={isStartingUp} />
    </ViewShell>
  );
};
