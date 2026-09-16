import type { PodcastRef } from '@aurora/model';
import { create } from 'zustand';

type TvSection =
  | 'dashboard'
  | 'search'
  | 'favorites'
  | 'playlists'
  | 'podcasts'
  | 'queue'
  | 'settings';

type TvState = {
  showVideo: boolean;
  isVideoPlaying: boolean;
  setShowVideo: (showVideo: boolean) => void;
  setIsVideoPlaying: (playing: boolean) => void;
  activeSection: TvSection;
  isSearchOpen: boolean;
  isQueueVisible: boolean;
  selectedPodcast: PodcastRef | null;
  setActiveSection: (section: TvSection) => void;
  setSelectedPodcast: (podcast: PodcastRef | null) => void;
  openSearch: () => void;
  closeSearch: () => void;
  toggleQueue: () => void;
  setQueueVisible: (visible: boolean) => void;
};

export const useTvStore = create<TvState>((set) => ({
  showVideo: false,
  isVideoPlaying: false,
  setShowVideo: (showVideo) =>
    set({ showVideo, isVideoPlaying: showVideo ? false : false }),
  setIsVideoPlaying: (isVideoPlaying) => set({ isVideoPlaying }),
  activeSection: 'dashboard',
  isSearchOpen: false,
  isQueueVisible: false,
  selectedPodcast: null,

  setActiveSection: (section: TvSection) => {
    set({ activeSection: section, showVideo: false, selectedPodcast: null });
  },

  setSelectedPodcast: (selectedPodcast) => {
    set({ selectedPodcast });
  },

  openSearch: () => {
    set({ isSearchOpen: true, showVideo: false });
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
