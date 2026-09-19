import { FC, ReactNode } from 'react';

import { Button } from '../Button';

type SettingsPanelNavItemProps = {
  id: string;
  label: string;
  icon: ReactNode;
  isActive: boolean;
  onClick: () => void;
};

export const SettingsPanelNavItem: FC<SettingsPanelNavItemProps> = ({
  id,
  label,
  icon,
  isActive,
  onClick,
}) => (
  <Button
    data-testid={`settings-tab-${id}`}
    onClick={onClick}
    variant={isActive ? 'default' : 'text'}
    size="default"
    className="w-full shrink-0 justify-start gap-2.5 px-3 text-sm font-medium whitespace-nowrap"
  >
    <span className="shrink-0">{icon}</span>
    <span className="truncate">{label}</span>
  </Button>
);
