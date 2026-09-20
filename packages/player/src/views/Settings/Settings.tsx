import { useTranslation } from '@aurora/i18n';
import { ViewShell } from '@aurora/ui';

import { isCapacitorEnvironment } from '../../services/universalStore';
import { SettingsSection } from './SettingsSection';
import { useSettingsGroups } from './useSettingsGroups';

export const Settings = () => {
  const { t } = useTranslation('preferences');
  const groups = useSettingsGroups();

  return (
    <ViewShell
      title={t('general.title')}
      classes={{
        root: isCapacitorEnvironment() ? 'p-0 bg-transparent' : undefined,
        scrollableArea: isCapacitorEnvironment() ? 'px-0' : 'px-6',
      }}
    >
      <div className="w-full max-w-2xl space-y-6 pb-8">
        {groups.map((group) => (
          <SettingsSection
            key={group.name}
            title={t(`${group.name}.title`, group.name)}
            settings={group.settings}
          />
        ))}
      </div>
    </ViewShell>
  );
};
