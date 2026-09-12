import { Link, useRouterState } from '@tanstack/react-router';
import {
  GaugeIcon,
  ListMusicIcon,
  Mic2Icon,
  MusicIcon,
  SettingsIcon,
  UserIcon,
} from 'lucide-react';
import { FC } from 'react';

import { cn } from '@aurora/ui';

import { useSettingsModalStore } from '../stores/settingsModalStore';

export const ConnectedMobileNav: FC = () => {
  const openSettings = useSettingsModalStore((state) => state.open);
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const navItems = [
    {
      to: '/dashboard',
      icon: <GaugeIcon className="size-6" />,
      label: 'Panel',
      isActive: currentPath === '/dashboard' || currentPath === '/',
    },
    {
      to: '/favorites/tracks',
      icon: <MusicIcon className="size-6" />,
      label: 'Canciones',
      isActive: currentPath === '/favorites/tracks',
    },
    {
      to: '/favorites/artists',
      icon: <UserIcon className="size-6" />,
      label: 'Artistas',
      isActive: currentPath === '/favorites/artists',
    },
    {
      to: '/playlists',
      icon: <ListMusicIcon className="size-6" />,
      label: 'Playlists',
      isActive: currentPath.startsWith('/playlists'),
    },
    {
      to: '/podcasts',
      icon: <Mic2Icon className="size-6" />,
      label: 'Podcasts',
      isActive: currentPath.startsWith('/podcasts'),
    },
  ];

  return (
    <nav className="aurora-mobile-nav bg-background-secondary border-border z-50 flex shrink-0 items-center justify-around border-t-(length:--border-width) select-none md:hidden">
      {navItems.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          aria-current={item.isActive ? 'page' : undefined}
          className={cn(
            'flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1 font-medium transition-all',
            item.isActive
              ? 'text-primary scale-105 font-bold'
              : 'text-foreground-secondary hover:text-foreground active:scale-95',
          )}
        >
          {item.icon}
          <span className="text-center text-[11px] leading-tight whitespace-nowrap sm:text-xs">
            {item.label}
          </span>
        </Link>
      ))}

      <button
        onClick={() => openSettings()}
        className="text-foreground-secondary hover:text-foreground flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl py-1 font-medium transition-all active:scale-95"
      >
        <SettingsIcon className="size-6" />
        <span className="text-center text-[11px] leading-tight whitespace-nowrap sm:text-xs">
          Ajustes
        </span>
      </button>
    </nav>
  );
};
