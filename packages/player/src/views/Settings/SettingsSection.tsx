import { FC } from 'react';

import type { SettingDefinition } from '@aurora/plugin-sdk';
import { SectionShell } from '@aurora/ui';

import { isCapacitorEnvironment } from '../../services/universalStore';
import { SettingFieldWithHost } from './SettingFieldWithHost';

type SettingsSectionProps = {
  title: string;
  settings: SettingDefinition[];
};

export const SettingsSection: FC<SettingsSectionProps> = ({
  title,
  settings,
}) => {
  if (isCapacitorEnvironment()) {
    return (
      <section className="flex w-full flex-col gap-2">
        <h3 className="px-1 text-xs font-bold tracking-wider text-emerald-400 uppercase">
          {title}
        </h3>
        <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-sm backdrop-blur-xs">
          {settings.map((definition) => (
            <SettingFieldWithHost key={definition.id} definition={definition} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <SectionShell title={title}>
      <div className="flex flex-col gap-6">
        {settings.map((definition) => (
          <SettingFieldWithHost key={definition.id} definition={definition} />
        ))}
      </div>
    </SectionShell>
  );
};
