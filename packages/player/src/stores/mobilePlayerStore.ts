import { create } from 'zustand';

import type { Track } from '@aurora/model';

type MobilePlayerStore = {
  isExpanded: boolean;
  isDrivingMode: boolean;
  activeContextTrack: Track | null;
  openExpanded: () => void;
  closeExpanded: () => void;
  toggleExpanded: () => void;
  toggleDrivingMode: () => void;
  setDrivingMode: (enabled: boolean) => void;
  openContextMenu: (track: Track) => void;
  closeContextMenu: () => void;
};

export const useMobilePlayerStore = create<MobilePlayerStore>((set) => ({
  isExpanded: false,
  isDrivingMode: false,
  activeContextTrack: null,
  openExpanded: () => set({ isExpanded: true }),
  closeExpanded: () => set({ isExpanded: false }),
  toggleExpanded: () => set((state) => ({ isExpanded: !state.isExpanded })),
  toggleDrivingMode: () =>
    set((state) => ({ isDrivingMode: !state.isDrivingMode })),
  setDrivingMode: (enabled: boolean) => set({ isDrivingMode: enabled }),
  openContextMenu: (track: Track) => set({ activeContextTrack: track }),
  closeContextMenu: () => set({ activeContextTrack: null }),
}));
