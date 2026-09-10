import { create } from 'zustand';

type TvSection =
  | 'dashboard'
  | 'search'
  | 'favorites'
  | 'playlists'
  | 'queue'
  | 'settings';

type TvState = {
  showVideo: boolean;
  setShowVideo: (showVideo: boolean) => void;
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
  showVideo: false,
  setShowVideo: (showVideo) => set({ showVideo }),
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
