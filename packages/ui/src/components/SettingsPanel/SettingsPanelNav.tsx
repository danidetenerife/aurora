import { FC, ReactNode } from 'react';

import { SettingsTab } from './SettingsPanel';
import { SettingsPanelNavItem } from './SettingsPanelNavItem';

type SettingsPanelNavProps = {
  tabs: SettingsTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  footer?: ReactNode;
};

export const SettingsPanelNav: FC<SettingsPanelNavProps> = ({
  tabs,
  activeTab,
  onTabChange,
  footer,
}) => (
  <nav className="border-border flex w-60 shrink-0 flex-col border-r-(length:--border-width) p-4 gap-2 overflow-y-auto max-sm:w-full max-sm:flex-row max-sm:border-r-0 max-sm:border-b-(length:--border-width) max-sm:overflow-x-auto max-sm:pr-16 max-sm:p-2 scrollbar-none">
    <div className="flex flex-col gap-1.5 w-full items-stretch max-sm:flex-row max-sm:items-center max-sm:w-auto">
      {tabs.map((tab) => (
        <SettingsPanelNavItem
          key={tab.id}
          id={tab.id}
          label={tab.label}
          icon={tab.icon}
          isActive={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
        />
      ))}
    </div>
    {footer && <div className="mt-auto pt-4 border-t-(length:--border-width) border-border/40 w-full max-sm:hidden">{footer}</div>}
  </nav>
);
