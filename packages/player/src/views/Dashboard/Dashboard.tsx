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

const getTimeOfDayGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return 'Buenos días';
  }
  if (hour >= 12 && hour < 20) {
    return 'Buenas tardes';
  }
  return 'Buenas noches';
};

const DashboardContent: FC<{ isStartingUp: boolean }> = ({ isStartingUp }) => {
  const { t } = useTranslation('dashboard');
  const [selectedSection, setSelectedSection] = useState('all');
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
    const filterPills = [
      { id: 'all', title: t('all', 'Todo') },
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

    const currentSection =
      filterPills.find((section) => section.id === selectedSection) ??
      filterPills[0];

    return (
      <div className="aurora-mobile-dashboard-content flex flex-col gap-4">
        {/* Dynamic Spotify Greeting */}
        <div
          data-testid="mobile-dashboard-greeting"
          className="flex shrink-0 items-center justify-between px-1 pt-2"
        >
          <h1 className="text-foreground text-2xl font-black tracking-tight">
            {getTimeOfDayGreeting()}
          </h1>
        </div>

        {/* Spotify-style Horizontal Filter Pills */}
        <div
          data-testid="mobile-filter-pills"
          className="no-scrollbar flex shrink-0 items-center gap-2 overflow-x-auto pb-1 select-none"
        >
          {filterPills.map((pill) => {
            const isActive =
              selectedSection === pill.id ||
              (selectedSection === 'all' && pill.id === 'all');
            return (
              <button
                key={pill.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setSelectedSection(pill.id)}
                className={`flex-none cursor-pointer rounded-full px-4 py-1.5 text-xs font-bold transition-all active:scale-95 ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'bg-background-secondary text-foreground-secondary border-border/70 hover:text-foreground border'
                }`}
              >
                {pill.title}
              </button>
            );
          })}
        </div>

        <div
          className={
            selectedSection === 'all'
              ? 'aurora-mobile-dashboard-feed flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto pb-32'
              : 'aurora-mobile-dashboard-single flex min-h-0 flex-1 flex-col overflow-hidden pb-4'
          }
        >
          {selectedSection === 'all' ? (
            <>
              {metadataProviders.length > 0 && <PersonalizedMixWidget />}
              {activeWidgets.map((widget) => {
                const WidgetComponent = widget.component;
                return <WidgetComponent key={widget.capability} />;
              })}
            </>
          ) : (
            <div className="flex h-full min-h-0 flex-1 flex-col">
              {currentSection?.content}
            </div>
          )}
        </div>
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
