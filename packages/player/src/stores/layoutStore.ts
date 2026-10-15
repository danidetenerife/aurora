import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type LayoutState = {
  leftSidebar: {
    isCollapsed: boolean;
    width: number;
  };
  rightSidebar: {
    isCollapsed: boolean;
    width: number;
  };
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  setLeftSidebarWidth: (width: number) => void;
  setRightSidebarWidth: (width: number) => void;
};

const isMobileDevice =
  typeof window !== 'undefined' &&
  (window.innerWidth < 768 ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    ));

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      leftSidebar: {
        isCollapsed: isMobileDevice,
        width: 200,
      },
      rightSidebar: {
        isCollapsed: isMobileDevice,
        width: 320,
      },
      toggleLeftSidebar: () =>
        set((state) => ({
          leftSidebar: {
            ...state.leftSidebar,
            isCollapsed: !state.leftSidebar.isCollapsed,
          },
        })),
      toggleRightSidebar: () =>
        set((state) => ({
          rightSidebar: {
            ...state.rightSidebar,
            isCollapsed: !state.rightSidebar.isCollapsed,
          },
        })),
      setLeftSidebarWidth: (width: number) =>
        set((state) => ({
          leftSidebar: {
            ...state.leftSidebar,
            width,
          },
        })),
      setRightSidebarWidth: (width: number) =>
        set((state) => ({
          rightSidebar: {
            ...state.rightSidebar,
            width,
          },
        })),
    }),
    {
      name: 'aurora-layout-store',
      version: 1,
      migrate: (persistedState: unknown) => {
        const defaultState = {
          leftSidebar: {
            isCollapsed: isMobileDevice,
            width: 200,
          },
          rightSidebar: {
            isCollapsed: isMobileDevice,
            width: 320,
          },
        };
        if (!persistedState || typeof persistedState !== 'object') {
          return defaultState;
        }
        const state = persistedState as Partial<LayoutState>;
        return {
          leftSidebar: {
            isCollapsed:
              typeof state.leftSidebar?.isCollapsed === 'boolean'
                ? state.leftSidebar.isCollapsed
                : defaultState.leftSidebar.isCollapsed,
            width:
              typeof state.leftSidebar?.width === 'number'
                ? state.leftSidebar.width
                : defaultState.leftSidebar.width,
          },
          rightSidebar: {
            isCollapsed: isMobileDevice
              ? true
              : typeof state.rightSidebar?.isCollapsed === 'boolean'
                ? state.rightSidebar.isCollapsed
                : defaultState.rightSidebar.isCollapsed,
            width:
              typeof state.rightSidebar?.width === 'number'
                ? Math.max(320, state.rightSidebar.width)
                : defaultState.rightSidebar.width,
          },
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state?.rightSidebar && state.rightSidebar.width < 320) {
          state.setRightSidebarWidth(320);
        }
        if (
          isMobileDevice &&
          state?.rightSidebar &&
          !state.rightSidebar.isCollapsed
        ) {
          state.toggleRightSidebar();
        }
      },
    },
  ),
);
