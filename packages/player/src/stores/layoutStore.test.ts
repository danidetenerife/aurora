import { beforeEach, describe, expect, it } from 'vitest';

import { useLayoutStore } from './layoutStore';

describe('useLayoutStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useLayoutStore.setState({
      leftSidebar: {
        isCollapsed: false,
        width: 200,
      },
      rightSidebar: {
        isCollapsed: false,
        width: 320,
      },
    });
  });

  it('toggles left sidebar collapsed state', () => {
    expect(useLayoutStore.getState().leftSidebar.isCollapsed).toBe(false);

    useLayoutStore.getState().toggleLeftSidebar();
    expect(useLayoutStore.getState().leftSidebar.isCollapsed).toBe(true);

    useLayoutStore.getState().toggleLeftSidebar();
    expect(useLayoutStore.getState().leftSidebar.isCollapsed).toBe(false);
  });

  it('toggles right sidebar collapsed state', () => {
    expect(useLayoutStore.getState().rightSidebar.isCollapsed).toBe(false);

    useLayoutStore.getState().toggleRightSidebar();
    expect(useLayoutStore.getState().rightSidebar.isCollapsed).toBe(true);

    useLayoutStore.getState().toggleRightSidebar();
    expect(useLayoutStore.getState().rightSidebar.isCollapsed).toBe(false);
  });

  it('updates sidebar widths correctly', () => {
    useLayoutStore.getState().setLeftSidebarWidth(250);
    expect(useLayoutStore.getState().leftSidebar.width).toBe(250);

    useLayoutStore.getState().setRightSidebarWidth(400);
    expect(useLayoutStore.getState().rightSidebar.width).toBe(400);
  });

  it('recovers with fallback defaults when migration receives invalid state', () => {
    const persistOptions = (
      useLayoutStore as unknown as {
        persist: {
          getOptions: () => {
            migrate?: (persistedState: unknown, version: number) => unknown;
          };
        };
      }
    ).persist.getOptions();

    const migratedFromNull = persistOptions.migrate?.(null, 0) as {
      leftSidebar: { width: number; isCollapsed: boolean };
      rightSidebar: { width: number; isCollapsed: boolean };
    };

    expect(migratedFromNull).toBeDefined();
    expect(migratedFromNull.leftSidebar.width).toBe(200);
    expect(migratedFromNull.rightSidebar.width).toBe(320);

    const migratedFromNarrow = persistOptions.migrate?.(
      {
        rightSidebar: { width: 150, isCollapsed: false },
      },
      0,
    ) as {
      leftSidebar: { width: number };
      rightSidebar: { width: number };
    };

    expect(migratedFromNarrow.rightSidebar.width).toBe(320);
    expect(migratedFromNarrow.leftSidebar.width).toBe(200);
  });
});
