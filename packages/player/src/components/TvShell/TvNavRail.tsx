import {
  FolderHeart,
  Github,
  Heart,
  Home,
  ListMusic,
  Radio,
  Search,
} from 'lucide-react';
import { FC, useState } from 'react';

import { useTranslation } from '@aurora/i18n';
import { TopBarLogo } from '@aurora/ui';

import { useTvStore } from '../../stores/tvStore';
import { TvButton } from './TvButton';

export const TvNavRail: FC = () => {
  const { t } = useTranslation('tv');
  const { activeSection, setActiveSection, openSearch } = useTvStore();
  const [isExpanded, setIsExpanded] = useState(false);

  const items = [
    {
      id: 'dashboard',
      label: t('home'),
      icon: Home,
      action: () => setActiveSection('dashboard'),
    },
    { id: 'search', label: t('search'), icon: Search, action: openSearch },
    {
      id: 'favorites',
      label: t('favorites'),
      icon: Heart,
      action: () => setActiveSection('favorites'),
    },
    {
      id: 'playlists',
      label: t('playlists'),
      icon: FolderHeart,
      action: () => setActiveSection('playlists'),
    },
    {
      id: 'podcasts',
      label: 'Podcasts',
      icon: Radio,
      action: () => setActiveSection('podcasts'),
    },
    {
      id: 'queue',
      label: t('queue'),
      icon: ListMusic,
      action: () => setActiveSection('queue'),
    },
    {
      id: 'settings',
      label: 'GitHub',
      icon: Github,
      action: () => setActiveSection('settings'),
    },
  ];

  return (
    <nav
      data-testid="tv-nav-rail"
      className="tv-navigation"
      data-expanded={isExpanded ? 'true' : undefined}
      onFocus={() => setIsExpanded(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setIsExpanded(false);
        }
      }}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className="tv-brand">
        <TopBarLogo className="h-9 w-9 flex-shrink-0" />
        <span className="tv-brand-title">AURORA</span>
      </div>
      <div className="tv-nav-items">
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <TvButton
              key={item.id}
              focusKey={`tv-nav-${item.id}`}
              data-testid={`tv-nav-item-${item.id}`}
              aria-current={activeSection === item.id ? 'page' : undefined}
              className="tv-nav-btn"
              destinations={{
                up: index > 0 ? `tv-nav-${items[index - 1].id}` : undefined,
                down:
                  index < items.length - 1
                    ? `tv-nav-${items[index + 1].id}`
                    : undefined,
                right: 'TV_CONTENT',
              }}
              onClick={item.action}
            >
              <Icon className="tv-nav-icon" />
              <span className="tv-nav-label">{item.label}</span>
            </TvButton>
          );
        })}
      </div>
    </nav>
  );
};
