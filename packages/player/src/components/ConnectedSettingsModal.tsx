import {
  BlocksIcon,
  ChevronLeft,
  KeyboardIcon,
  LaptopIcon,
  ScrollTextIcon,
  Settings2Icon,
  SparklesIcon,
  X,
} from 'lucide-react';
import { FC } from 'react';

import { useTranslation } from '@aurora/i18n';
import { SettingsPanel } from '@aurora/ui';

import { isCapacitorEnvironment } from '../services/universalStore';
import {
  useSettingsModalStore,
  type SettingsTab,
} from '../stores/settingsModalStore';
import { KeyboardShortcuts } from '../views/KeyboardShortcuts/KeyboardShortcuts';
import { Logs } from '../views/Logs/Logs';
import { Plugins } from '../views/Plugins/Plugins';
import { Settings } from '../views/Settings/Settings';
import { SyncSettingsView } from '../views/Sync/SyncSettingsView';
import { WhatsNew } from '../views/WhatsNew/WhatsNew';
import { SocialLinks } from './SocialLinks';
import { VersionString } from './VersionString';

const SETTINGS_TABS = [
  {
    id: 'general' as SettingsTab,
    icon: <Settings2Icon />,
    label: 'General',
    content: () => <Settings />,
  },
  {
    id: 'shortcuts' as SettingsTab,
    icon: <KeyboardIcon />,
    label: 'Key Shortcuts',
    content: () => <KeyboardShortcuts />,
  },
  {
    id: 'sync' as SettingsTab,
    icon: <LaptopIcon />,
    label: 'Sync',
    content: () => <SyncSettingsView />,
  },
  {
    id: 'plugins' as SettingsTab,
    icon: <BlocksIcon />,
    label: 'Plugins',
    content: () => <Plugins />,
  },
  {
    id: 'logs' as SettingsTab,
    icon: <ScrollTextIcon />,
    label: 'Logs',
    content: () => <Logs />,
  },
  {
    id: 'whats-new' as SettingsTab,
    icon: <SparklesIcon />,
    label: "What's New",
    content: () => <WhatsNew />,
  },
];

export const ConnectedSettingsModal: FC = () => {
  const { t } = useTranslation('preferences');
  const { isOpen, close, activeTab, setActiveTab } = useSettingsModalStore();

  const visibleTabs = isCapacitorEnvironment()
    ? SETTINGS_TABS.filter(
        (tab) => !['shortcuts', 'logs', 'whats-new'].includes(tab.id),
      )
    : SETTINGS_TABS;
  const tabs = visibleTabs.map((tab) => ({
    ...tab,
    label: t(`${tab.id}.title`, tab.label),
  }));

  if (isCapacitorEnvironment()) {
    if (!isOpen) {
      return null;
    }

    const currentTabId = tabs.some((tab) => tab.id === activeTab)
      ? activeTab
      : 'general';
    const currentTab = tabs.find((tab) => tab.id === currentTabId) ?? tabs[0];

    return (
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[75] flex flex-col bg-[#030303] pt-[max(2.25rem,env(safe-area-inset-top,0px))] pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] text-white"
        data-testid="mobile-settings-modal"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={close}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition-transform active:scale-95"
              aria-label="Volver"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-black tracking-tight text-white select-none">
              Ajustes
            </h1>
          </div>
          <button
            type="button"
            onClick={close}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition-colors hover:text-white active:scale-95"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Pills */}
        <div className="no-scrollbar flex shrink-0 items-center gap-2 overflow-x-auto border-b border-white/10 px-4 py-2.5 select-none">
          {tabs.map((tab) => {
            const isActive = tab.id === currentTabId;
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`settings-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id as SettingsTab)}
                className={`flex-none cursor-pointer rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all active:scale-95 ${
                  isActive
                    ? 'bg-white font-bold text-zinc-950 shadow-sm'
                    : 'border border-white/10 bg-white/[0.08] text-white/80'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4 pb-32">
          {currentTab.content()}
          <div className="mt-8 flex flex-col items-center gap-2 border-t border-white/10 pt-6 text-zinc-400">
            <SocialLinks />
            <VersionString />
          </div>
          <div
            className="pointer-events-none h-8 shrink-0 select-none"
            aria-hidden="true"
          />
        </div>
      </div>
    );
  }

  return (
    <SettingsPanel
      isOpen={isOpen}
      onClose={close}
      tabs={tabs}
      activeTab={
        tabs.some((tab) => tab.id === activeTab) ? activeTab : 'general'
      }
      onTabChange={(tabId) => setActiveTab(tabId as SettingsTab)}
      navFooter={
        <div className="flex flex-col items-center gap-2">
          <SocialLinks />
          <VersionString />
        </div>
      }
    />
  );
};
