import { create } from 'zustand';

import type { Track } from '@aurora/model';

type MobilePlayerStore = {
  isExpanded: boolean;
  activeContextTrack: Track | null;
  openExpanded: () => void;
  closeExpanded: () => void;
  toggleExpanded: () => void;
  openContextMenu: (track: Track) => void;
  closeContextMenu: () => void;
};

export const useMobilePlayerStore = create<MobilePlayerStore>((set) => ({
  isExpanded: false,
  activeContextTrack: null,
  openExpanded: () => set({ isExpanded: true }),
  closeExpanded: () => set({ isExpanded: false }),
  toggleExpanded: () => set((state) => ({ isExpanded: !state.isExpanded })),
  openContextMenu: (track: Track) => set({ activeContextTrack: track }),
  closeContextMenu: () => set({ activeContextTrack: null }),
}));
