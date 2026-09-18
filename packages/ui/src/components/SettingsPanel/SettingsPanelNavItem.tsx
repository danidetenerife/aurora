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
    className="w-full justify-start gap-2.5 whitespace-nowrap shrink-0 text-sm font-medium px-3"
  >
    <span className="shrink-0">{icon}</span>
    <span className="truncate">{label}</span>
  </Button>
);
