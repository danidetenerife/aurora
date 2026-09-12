import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { FC } from 'react';

import { useTranslation } from '@aurora/i18n';
import { TopBarLogo } from '@aurora/ui';

import { useTvStore } from '../../stores/tvStore';
import { TvButton } from './TvButton';

export const TvNavRail: FC = () => {
  const { t } = useTranslation('tv');
  const { activeSection, setActiveSection, openSearch } = useTvStore();
  const items = [
    {
      id: 'dashboard',
      label: t('home'),
      action: () => setActiveSection('dashboard'),
    },
    { id: 'search', label: t('search'), action: openSearch },
    {
      id: 'favorites',
      label: t('favorites'),
      action: () => setActiveSection('favorites'),
    },
    {
      id: 'playlists',
      label: t('playlists'),
      action: () => setActiveSection('playlists'),
    },
    { id: 'queue', label: t('queue'), action: () => setActiveSection('queue') },
    {
      id: 'player',
      label: t('player'),
      action: () => setFocus('tv-control-play'),
    },
  ];
  return (
    <nav data-testid="tv-nav-rail" className="tv-navigation">
      <div className="tv-brand">
        <TopBarLogo className="h-6 w-6" />
        <span>AURORA</span>
      </div>
      {items.map((item, index) => (
        <TvButton
          key={item.id}
          focusKey={`tv-nav-${item.id}`}
          data-testid={`tv-nav-item-${item.id}`}
          aria-current={activeSection === item.id ? 'page' : undefined}
          destinations={{
            left: `tv-nav-${items[Math.max(0, index - 1)].id}`,
            right: `tv-nav-${items[Math.min(items.length - 1, index + 1)].id}`,
            down:
              item.id === 'player' ||
              (item.id === 'dashboard' && activeSection === 'dashboard')
                ? 'tv-control-play'
                : 'TV_CONTENT',
          }}
          onClick={item.action}
        >
          {item.label}
        </TvButton>
      ))}
    </nav>
  );
};
