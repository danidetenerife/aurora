import { createRootRoute, Outlet } from '@tanstack/react-router';
import {
  CableIcon,
  ChevronDown,
  DiscIcon,
  GaugeIcon,
  HistoryIcon,
  ListMusicIcon,
  Mic2Icon,
  MusicIcon,
  SettingsIcon,
  UserIcon,
  X,
} from 'lucide-react';
import { useEffect } from 'react';

import { useTranslation } from '@aurora/i18n';
import {
  PlayerShell,
  PlayerWorkspace,
  SidebarNavigation,
  SidebarNavigationItem,
  Toaster,
} from '@aurora/ui';

import { CarModeOverlay } from '../components/CarMode/CarModeOverlay';
import { ConnectedMobileNav } from '../components/ConnectedMobileNav';
import { ConnectedPlayerBar } from '../components/ConnectedPlayerBar';
import { MobileExpandedPlayer } from '../components/ConnectedPlayerBar/MobileExpandedPlayer';
import {
  ConnectedQueuePanel,
  QueueHeaderActions,
} from '../components/ConnectedQueuePanel';
import { ConnectedSettingsModal } from '../components/ConnectedSettingsModal';
import { ConnectedTitleBar } from '../components/ConnectedTitleBar';
import { ConnectedTopBar } from '../components/ConnectedTopBar';
import { FlatpakWarningBanner } from '../components/FlatpakWarningBanner';
import { MobileAccountSheet } from '../components/MobileAccountSheet';
import { MobileNotificationsSheet } from '../components/MobileNotificationsSheet';
import { MobileTrackContextMenuSheet } from '../components/MobileTrackContextMenuSheet';
import { SoundProvider } from '../components/SoundProvider';
import { StreamResolver } from '../components/StreamResolver';
import { TvShell } from '../components/TvShell';
import { isGoogleTVEnvironment } from '../services/tvDetection';
import {
  isCapacitorEnvironment,
  isTauriEnvironment,
} from '../services/universalStore';
import { GlobalShortcuts } from '../shortcuts';
import { useLayoutStore } from '../stores/layoutStore';
import { useSettingsModalStore } from '../stores/settingsModalStore';
import { useStartupStore } from '../stores/startupStore';
import { useUpdaterStore } from '../stores/updaterStore';

import '../styles/workspace.css';
import '../styles/mobile-dashboard.css';

const MOBILE_UPDATE_INTERVAL_MS = 60 * 60 * 1000;

const DesktopMobileRootComponent = () => {
  const { t } = useTranslation('navigation');
  const { t: tPrefs } = useTranslation('preferences');
  const isTauri = isTauriEnvironment();
  const {
    leftSidebar,
    rightSidebar,
    toggleLeftSidebar,
    toggleRightSidebar,
    setLeftSidebarWidth,
    setRightSidebarWidth,
  } = useLayoutStore();
  const openSettings = useSettingsModalStore((state) => state.open);
  const isStartingUp = useStartupStore((state) => state.isStartingUp);
  useEffect(() => {
    if (!isCapacitorEnvironment() || isStartingUp) {
      return;
    }
    const checkForUpdate = () => {
      const updater = useUpdaterStore.getState();
      if (
        !updater.lastChecked ||
        Date.now() - updater.lastChecked.getTime() >= MOBILE_UPDATE_INTERVAL_MS
      ) {
        void updater.checkForUpdate();
      }
    };
    const timer = window.setInterval(checkForUpdate, MOBILE_UPDATE_INTERVAL_MS);
    window.addEventListener('focus', checkForUpdate);
    window.addEventListener('online', checkForUpdate);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', checkForUpdate);
      window.removeEventListener('online', checkForUpdate);
    };
  }, [isStartingUp]);
  return (
    <PlayerShell
      className="aurora-workspace"
      data-native-mobile={isCapacitorEnvironment() || undefined}
      onContextMenu={(e) => e.preventDefault()}
    >
      <GlobalShortcuts />
      <div className="aurora-header shrink-0 pt-7 sm:pt-0">
        {isTauri && <ConnectedTitleBar />}
        {isTauri && <FlatpakWarningBanner />}
        <ConnectedTopBar />
      </div>
      {!isStartingUp && <StreamResolver />}
      <SoundProvider>
        <PlayerWorkspace>
          <PlayerWorkspace.LeftSidebar
            className="hidden md:flex"
            width={leftSidebar.width}
            isCollapsed={leftSidebar.isCollapsed}
            onWidthChange={setLeftSidebarWidth}
            onToggle={toggleLeftSidebar}
          >
            <SidebarNavigation isCompact={leftSidebar.isCollapsed}>
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
                <SidebarNavigationItem
                  to="/dashboard"
                  icon={<GaugeIcon />}
                  label={t('dashboard')}
                />
                <SidebarNavigationItem
                  to="/favorites/albums"
                  icon={<DiscIcon />}
                  label={t('favoriteAlbums')}
                />
                <SidebarNavigationItem
                  to="/favorites/tracks"
                  icon={<MusicIcon />}
                  label={t('favoriteTracks')}
                />
                <SidebarNavigationItem
                  to="/favorites/artists"
                  icon={<UserIcon />}
                  label={t('favoriteArtists')}
                />
                <SidebarNavigationItem
                  to="/playlists"
                  icon={<ListMusicIcon />}
                  label={t('playlists')}
                />
                <SidebarNavigationItem
                  to="/podcasts"
                  icon={<Mic2Icon />}
                  label="Podcasts"
                />
                <SidebarNavigationItem
                  to="/history"
                  icon={<HistoryIcon />}
                  label={t('history')}
                />
                <SidebarNavigationItem
                  to="/sources"
                  icon={<CableIcon />}
                  label={t('sources')}
                />
              </div>
              <SidebarNavigationItem
                icon={<SettingsIcon />}
                label={tPrefs('title')}
                onClick={() => openSettings()}
              />
            </SidebarNavigation>
          </PlayerWorkspace.LeftSidebar>

          <PlayerWorkspace.Main className="aurora-content w-full min-w-0">
            <Outlet />
          </PlayerWorkspace.Main>

          <PlayerWorkspace.RightSidebar
            className="hidden md:flex"
            width={rightSidebar.width}
            isCollapsed={rightSidebar.isCollapsed}
            onWidthChange={setRightSidebarWidth}
            onToggle={toggleRightSidebar}
            headerActions={<QueueHeaderActions />}
          >
            {!isCapacitorEnvironment() && (
              <ConnectedQueuePanel isCollapsed={rightSidebar.isCollapsed} />
            )}
          </PlayerWorkspace.RightSidebar>
        </PlayerWorkspace>
      </SoundProvider>

      <div className="flex shrink-0 flex-col">
        <ConnectedPlayerBar />
        <ConnectedMobileNav />
      </div>
      {isCapacitorEnvironment() && !rightSidebar.isCollapsed && (
        <div className="bg-background fixed inset-0 z-50 flex flex-col pt-[max(2.25rem,env(safe-area-inset-top,0px))] pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] md:hidden">
          <div className="border-border flex items-center justify-between border-b px-4 py-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="border-border text-foreground hover:bg-background-secondary cursor-pointer rounded-xl border p-2 transition-all active:scale-95"
                onClick={toggleRightSidebar}
                data-testid="mobile-queue-chevron-close"
                aria-label="Cerrar cola"
              >
                <ChevronDown className="size-5" />
              </button>
              <h2 className="text-lg font-bold">
                {t('queue', { defaultValue: 'Cola' })}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <QueueHeaderActions />
              <button
                type="button"
                className="border-border text-foreground hover:bg-background-secondary cursor-pointer rounded-xl border p-2 transition-all active:scale-95"
                onClick={toggleRightSidebar}
                data-testid="mobile-queue-close"
                aria-label="Cerrar cola"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <ConnectedQueuePanel />
          </div>
        </div>
      )}
      <Toaster
        position={isTauri ? 'bottom-right' : 'top-center'}
        mobileOffset={{ top: '64px', bottom: '120px' }}
      />
      <ConnectedSettingsModal />
      <MobileNotificationsSheet />
      <MobileAccountSheet />
      <CarModeOverlay />
      <MobileExpandedPlayer />
      <MobileTrackContextMenuSheet />
    </PlayerShell>
  );
};

const RootComponent = () => {
  if (isGoogleTVEnvironment()) {
    return <TvShell />;
  }
  return <DesktopMobileRootComponent />;
};

export const Route = createRootRoute({
  component: RootComponent,
});
