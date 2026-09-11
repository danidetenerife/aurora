import {
  BlocksIcon,
  KeyboardIcon,
  LaptopIcon,
  ScrollTextIcon,
  Settings2Icon,
  SparklesIcon,
} from 'lucide-react';
import { FC } from 'react';

import { useTranslation } from '@aurora/i18n';
import { SettingsPanel } from '@aurora/ui';

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
    label: 'Ajustes',
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
    label: 'Sincronización',
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

  const tabs = SETTINGS_TABS.map((tab) => ({
    ...tab,
    label:
      tab.id === 'sync' ? 'Sincronización' : t(`${tab.id}.title`, tab.label),
  }));

  return (
    <SettingsPanel
      isOpen={isOpen}
      onClose={close}
      tabs={tabs}
      activeTab={activeTab}
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
