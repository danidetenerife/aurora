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
  const activeWidgets = DASHBOARD_WIDGETS.filter(
    (widget) =>
      widget.capability !== 'editorialPlaylists' &&
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
      <div className="aurora-mobile-dashboard-content flex flex-col gap-5 pt-1">
        <div data-testid="mobile-dashboard-greeting" className="hidden" />
        {/* YouTube Music Horizontal Filter Chips */}
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
                className={`flex-none cursor-pointer rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all active:scale-95 ${
                  isActive
                    ? 'border border-white bg-white font-bold text-zinc-950 shadow-xs'
                    : 'border border-white/10 bg-white/[0.08] text-white/90 hover:bg-white/[0.14]'
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
              ? 'aurora-mobile-dashboard-feed flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-0.5 pb-36'
              : 'aurora-mobile-dashboard-single flex min-h-0 flex-1 flex-col overflow-y-auto px-0.5 pb-36'
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
            <div className="flex min-h-0 flex-1 flex-col">
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
