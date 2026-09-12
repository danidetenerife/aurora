import { useCanGoBack, useRouter } from '@tanstack/react-router';
import { FC } from 'react';

import { TopBar, TopBarLogo, TopBarNavigation } from '@aurora/ui';

import AuroraLogo from '../../../ui/src/assets/logo-full.svg?react';
import { useCanGoForward } from '../hooks/useCanGoForward';
import { isCapacitorEnvironment } from '../services/universalStore';
import { SearchBox } from './SearchBox';
import { UpdateBadge } from './UpdateBadge';

export const ConnectedTopBar: FC = () => {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const canGoForward = useCanGoForward();

  if (isCapacitorEnvironment()) {
    return (
      <TopBar draggable={false} className="aurora-apk-topbar">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <AuroraLogo
            role="img"
            aria-label="Aurora"
            className="h-9 w-auto max-w-[55%]"
          />
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <TopBarNavigation
              onBack={() => router.history.back()}
              onForward={() => router.history.forward()}
              canGoBack={canGoBack}
              canGoForward={canGoForward}
            />
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
      <div className="flex flex-row items-center justify-end gap-2" />
    </TopBar>
  );
};
