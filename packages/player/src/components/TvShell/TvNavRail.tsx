import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import {
  CableIcon,
  DiscIcon,
  GaugeIcon,
  ListMusic,
  ListMusicIcon,
  MusicIcon,
  PlayCircleIcon,
  SearchIcon,
  SettingsIcon,
} from 'lucide-react';
import { FC, useCallback } from 'react';

import { useTranslation } from '@nuclearplayer/i18n';
import { cn } from '@nuclearplayer/ui';

import { useSettingsModalStore } from '../../stores/settingsModalStore';
import { useTvStore } from '../../stores/tvStore';

type NavItem = {
  id: string;
  icon: React.ReactNode;
  label: string;
  action: () => void;
};

const TvNavRailItem: FC<{
  item: NavItem;
  isActive: boolean;
  focusKey: string;
}> = ({ item, isActive, focusKey }) => {
  const onEnterPress = useCallback(() => {
    item.action();
  }, [item]);

  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress,
  });

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      data-testid={`tv-nav-item-${item.id}`}
      data-focused={focused}
      onClick={item.action}
      onKeyDown={(event) => {
        if (
          event.key === 'Enter' ||
          event.key === ' ' ||
          event.keyCode === 23 ||
          event.keyCode === 13
        ) {
          event.preventDefault();
          item.action();
        }
      }}
      className={cn(
        'flex min-w-[72px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 transition-all duration-150 outline-none',
        isActive && 'bg-primary/20 text-primary',
        !isActive && 'text-zinc-400',
        focused &&
          'bg-primary/40 shadow-primary/30 ring-primary scale-110 text-white shadow-xl ring-2',
      )}
    >
      <div className="[&>svg]:size-6">{item.icon}</div>
      <span className="text-center text-[11px] leading-tight font-bold whitespace-nowrap">
        {item.label}
      </span>
    </div>
  );
};

export const TvNavRail: FC = () => {
  const { t } = useTranslation('navigation');
  const { t: tPrefs } = useTranslation('preferences');
  const activeSection = useTvStore((state) => state.activeSection);
  const setActiveSection = useTvStore((state) => state.setActiveSection);
  const openSearch = useTvStore((state) => state.openSearch);
  const toggleQueue = useTvStore((state) => state.toggleQueue);
  const openSettings = useSettingsModalStore((state) => state.open);

  const { ref, focusKey } = useFocusable({
    focusKey: 'TV_NAV_RAIL',
    trackChildren: true,
    saveLastFocusedChild: true,
  });

  const navItems: NavItem[] = [
    {
      id: 'dashboard',
      icon: <GaugeIcon />,
      label: t('dashboard'),
      action: () => setActiveSection('dashboard'),
    },
    {
      id: 'search',
      icon: <SearchIcon />,
      label: t('explore'),
      action: () => openSearch(),
    },
    {
      id: 'favorites',
      icon: <MusicIcon />,
      label: t('favoriteTracks'),
      action: () => setActiveSection('favorites'),
    },
    {
      id: 'playlists',
      icon: <ListMusicIcon />,
      label: t('playlists'),
      action: () => setActiveSection('playlists'),
    },
    {
      id: 'albums',
      icon: <DiscIcon />,
      label: t('favoriteAlbums'),
      action: () => setActiveSection('dashboard'),
    },
    {
      id: 'sources',
      icon: <CableIcon />,
      label: t('sources'),
      action: () => setActiveSection('dashboard'),
    },
    {
      id: 'queue',
      icon: <ListMusic />,
      label: 'Queue',
      action: () => toggleQueue(),
    },
    {
      id: 'player',
      icon: <PlayCircleIcon />,
      label: 'Player',
      action: () => setFocus('tv-control-play'),
    },
  ];

  const settingsItem: NavItem = {
    id: 'settings',
    icon: <SettingsIcon />,
    label: tPrefs('title'),
    action: () => openSettings(),
  };

  return (
    <FocusContext.Provider value={focusKey}>
      <nav
        ref={ref}
        data-testid="tv-nav-rail"
        className="flex w-[88px] shrink-0 flex-col items-center justify-between border-r border-zinc-800 bg-zinc-900/90 px-2 py-4 backdrop-blur-xl select-none"
      >
        <div className="flex flex-col items-center gap-1.5">
          <div className="mb-2 flex items-center justify-center">
            <span className="font-heading bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-xs font-extrabold tracking-wider text-transparent select-none">
              AURORA
            </span>
          </div>

          {navItems.map((item) => (
            <TvNavRailItem
              key={item.id}
              item={item}
              isActive={activeSection === item.id}
              focusKey={`tv-nav-${item.id}`}
            />
          ))}
        </div>

        <TvNavRailItem
          item={settingsItem}
          isActive={false}
          focusKey="tv-nav-settings"
        />
      </nav>
    </FocusContext.Provider>
  );
};
