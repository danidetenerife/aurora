import { FC, useState } from 'react';

import { useTranslation } from '@aurora/i18n';
import type { DashboardProvider } from '@aurora/plugin-sdk';
import { Loader, ViewShell } from '@aurora/ui';

import { useProviders } from '../../hooks/useProviders';
import { isCapacitorEnvironment } from '../../services/universalStore';
import { useStartupStore } from '../../stores/startupStore';
import { DashboardEmptyState } from './components/DashboardEmptyState';
import { PersonalizedMixWidget } from './components/PersonalizedMixWidget';
import { DASHBOARD_WIDGETS } from './dashboardWidgets';

const DashboardContent: FC<{ isStartingUp: boolean }> = ({ isStartingUp }) => {
  const { t } = useTranslation('dashboard');
  const [selectedSection, setSelectedSection] = useState('mix');
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

  if (isCapacitorEnvironment()) {
    const sections = [
      ...(metadataProviders.length
        ? [
            {
              id: 'mix',
              title: t('personalizedMix.title'),
              content: <PersonalizedMixWidget />,
            },
          ]
        : []),
      ...activeWidgets.map((widget) => ({
        id: widget.capability,
        title: t(
          widget.capability.replace(
            /[A-Z]/g,
            (letter) => `-${letter.toLowerCase()}`,
          ),
        ),
        content: <widget.component />,
      })),
    ];
    const current =
      sections.find((section) => section.id === selectedSection) ?? sections[0];
    return (
      <div className="aurora-mobile-dashboard-content">
        {sections.length > 1 && (
          <select
            aria-label={t('title')}
            value={current.id}
            onChange={(event) => setSelectedSection(event.target.value)}
          >
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.title}
              </option>
            ))}
          </select>
        )}
        {current?.content}
      </div>
    );
  }

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

  if (isCapacitorEnvironment()) {
    return (
      <div data-testid="dashboard-view" className="aurora-mobile-dashboard">
        <DashboardContent isStartingUp={isStartingUp} />
      </div>
    );
  }

  return (
    <ViewShell
      data-testid="dashboard-view"
      title={isCapacitorEnvironment() ? undefined : t('title')}
    >
      <DashboardContent isStartingUp={isStartingUp} />
    </ViewShell>
  );
};
