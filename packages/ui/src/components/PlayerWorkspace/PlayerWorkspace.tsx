import { FC, ReactNode } from 'react';

import { cn } from '../../utils';
import { PlayerWorkspaceLeftSidebar } from './PlayerWorkspaceLeftSidebar';
import { PlayerWorkspaceRightSidebar } from './PlayerWorkspaceRightSidebar';

type PlayerWorkspaceProps = {
  children: ReactNode;
  className?: string;
};

type MainProps = {
  children?: ReactNode;
  className?: string;
};

const PlayerWorkspaceMain: FC<MainProps> = ({ children, className = '' }) => {
  return (
    <main
      data-testid="player-workspace-main"
      className={cn(
        'bg-background-secondary min-h-0 w-full flex-1 overflow-y-auto',
        className,
      )}
    >
      {children}
    </main>
  );
};

type PlayerWorkspaceComponent = FC<PlayerWorkspaceProps> & {
  LeftSidebar: typeof PlayerWorkspaceLeftSidebar;
  RightSidebar: typeof PlayerWorkspaceRightSidebar;
  Main: typeof PlayerWorkspaceMain;
};

const PlayerWorkspaceImpl: FC<PlayerWorkspaceProps> = ({
  children,
  className = '',
}) => {
  return (
    <div
      className={cn(
        'bg-background-secondary relative flex h-full min-h-0 flex-1 overflow-hidden md:grid md:grid-cols-[auto_1fr_auto]',
        className,
      )}
    >
      {children}
    </div>
  );
};

export const PlayerWorkspace = PlayerWorkspaceImpl as PlayerWorkspaceComponent;
PlayerWorkspace.LeftSidebar = PlayerWorkspaceLeftSidebar;
PlayerWorkspace.RightSidebar = PlayerWorkspaceRightSidebar;
PlayerWorkspace.Main = PlayerWorkspaceMain;
