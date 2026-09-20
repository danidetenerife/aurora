import {
  useCanGoBack,
  useRouter,
  useRouterState,
} from '@tanstack/react-router';
import { Bell, ChevronLeft } from 'lucide-react';
import { FC } from 'react';

import { TopBar, TopBarLogo, TopBarNavigation } from '@aurora/ui';

import AuroraWavesLogo from '../../../ui/src/assets/logo-icon-waves.png';
import { useCanGoForward } from '../hooks/useCanGoForward';
import { isCapacitorEnvironment } from '../services/universalStore';
import { useAccountModalStore } from '../stores/accountModalStore';
import { useNotificationStore } from '../stores/notificationStore';
import { SearchBox } from './SearchBox';
import { UpdateBadge } from './UpdateBadge';

export const ConnectedTopBar: FC = () => {
  const router = useRouter();
  const routerState = useRouterState();
  const canGoBack = useCanGoBack();
  const canGoForward = useCanGoForward();
  const openNotifications = useNotificationStore((state) => state.open);
  const unreadNotifications = useNotificationStore((state) =>
    state.notifications.some((notif) => !notif.isRead),
  );
  const openAccount = useAccountModalStore((state) => state.open);
  const userName = useAccountModalStore((state) => state.userName);

  const currentPath = routerState.location.pathname;
  const isRootTab =
    currentPath === '/dashboard' ||
    currentPath === '/' ||
    currentPath === '/favorites/tracks' ||
    currentPath === '/playlists';
  const showBackButton = canGoBack && !isRootTab;

  if (isCapacitorEnvironment()) {
    return (
      <TopBar draggable={false} className="aurora-apk-topbar">
        <div className="flex min-w-0 items-center justify-between gap-3 py-1">
          <div className="flex min-w-0 items-center gap-2.5">
            {showBackButton && (
              <button
                type="button"
                onClick={() => router.history.back()}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800/80 text-white transition-transform active:scale-95"
                aria-label="Volver"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-zinc-900 p-1 shadow-[0_0_12px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500/30">
              <img
                src={AuroraWavesLogo}
                role="img"
                aria-label="Aurora"
                className="h-full w-full object-contain"
              />
            </div>
            <span className="font-heading text-2xl font-black tracking-tight text-white select-none">
              Aurora
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={openNotifications}
              data-testid="topbar-notifications-button"
              className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-zinc-300 transition-colors hover:text-white active:scale-95"
              aria-label="Notificaciones"
            >
              <Bell className="h-5 w-5" />
              {unreadNotifications && (
                <span className="absolute top-1 right-1 flex h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-[#030303]" />
              )}
            </button>
            <button
              type="button"
              onClick={openAccount}
              data-testid="topbar-account-button"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 via-orange-600 to-rose-600 text-xs font-black text-white shadow-md ring-2 shadow-orange-500/20 ring-white/20 transition-transform active:scale-95"
              aria-label="Cuenta y perfil"
            >
              {userName.charAt(0).toUpperCase()}
            </button>
            <UpdateBadge />
          </div>
        </div>
        <SearchBox />
      </TopBar>
    );
  }

  return (
    <TopBar draggable={false} className="aurora-topbar">
      <div className="flex flex-row items-center gap-4">
        <div className="flex items-center gap-2">
          <TopBarLogo />
          <span className="font-heading hidden bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-sm font-extrabold tracking-wider text-transparent select-none sm:inline">
            AURORA
          </span>
        </div>
        <TopBarNavigation
          onBack={() => router.history.back()}
          onForward={() => router.history.forward()}
          canGoBack={canGoBack}
          canGoForward={canGoForward}
        />
        <UpdateBadge />
      </div>
      <SearchBox />
      <div className="flex flex-row items-center justify-end gap-2">
        <button
          type="button"
          onClick={openNotifications}
          data-testid="desktop-notifications-button"
          className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-zinc-300 transition-colors hover:text-white active:scale-95"
          aria-label="Notificaciones"
        >
          <Bell className="h-4 w-4" />
          {unreadNotifications && (
            <span className="ring-background absolute top-1 right-1 flex h-2 w-2 rounded-full bg-emerald-500 ring-2" />
          )}
        </button>
        <button
          type="button"
          onClick={openAccount}
          data-testid="desktop-account-button"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 via-orange-600 to-rose-600 text-xs font-black text-white shadow-md ring-2 shadow-orange-500/20 ring-white/20 transition-transform active:scale-95"
          aria-label="Cuenta y perfil"
        >
          {userName.charAt(0).toUpperCase()}
        </button>
      </div>
    </TopBar>
  );
};
