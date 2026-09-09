import { create } from 'zustand';

type TvSection =
  | 'dashboard'
  | 'search'
  | 'favorites'
  | 'playlists'
  | 'queue'
  | 'settings';

type TvState = {
  activeSection: TvSection;
  isSearchOpen: boolean;
  isQueueVisible: boolean;
  setActiveSection: (section: TvSection) => void;
  openSearch: () => void;
  closeSearch: () => void;
  toggleQueue: () => void;
  setQueueVisible: (visible: boolean) => void;
};

export const useTvStore = create<TvState>((set) => ({
  activeSection: 'dashboard',
  isSearchOpen: false,
  isQueueVisible: false,

  setActiveSection: (section: TvSection) => {
    set({ activeSection: section });
  },

  openSearch: () => {
    set({ isSearchOpen: true });
  },

  closeSearch: () => {
    set({ isSearchOpen: false });
  },

  toggleQueue: () => {
    set((state) => ({ isQueueVisible: !state.isQueueVisible }));
  },

  setQueueVisible: (visible: boolean) => {
    set({ isQueueVisible: visible });
  },
}));
