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
  <nav className="border-border scrollbar-none flex w-60 shrink-0 flex-col gap-2 overflow-y-auto border-r-(length:--border-width) p-4 max-sm:w-full max-sm:flex-row max-sm:overflow-x-auto max-sm:border-r-0 max-sm:border-b-(length:--border-width) max-sm:p-2 max-sm:pr-16">
    <div className="flex w-full flex-col items-stretch gap-1.5 max-sm:w-auto max-sm:flex-row max-sm:items-center">
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
    {footer && (
      <div className="border-border/40 mt-auto w-full border-t-(length:--border-width) pt-4 max-sm:hidden">
        {footer}
      </div>
    )}
  </nav>
);
