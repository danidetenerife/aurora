import { create } from 'zustand';

import type { PodcastRef } from '@aurora/model';

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
  targetVideoId: string | null;
  setShowVideo: (showVideo: boolean) => void;
  setIsVideoPlaying: (playing: boolean) => void;
  setTargetVideoId: (targetVideoId: string | null) => void;
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
  targetVideoId: null,
  setShowVideo: (showVideo) =>
    set((state) => ({
      showVideo,
      isVideoPlaying: showVideo ? state.isVideoPlaying : false,
      targetVideoId: showVideo ? state.targetVideoId : null,
    })),
  setIsVideoPlaying: (isVideoPlaying) => set({ isVideoPlaying }),
  setTargetVideoId: (targetVideoId) => set({ targetVideoId }),
  activeSection: 'dashboard',
  isSearchOpen: false,
  isQueueVisible: false,
  selectedPodcast: null,

  setActiveSection: (section: TvSection) => {
    set({
      activeSection: section,
      showVideo: false,
      selectedPodcast: null,
      targetVideoId: null,
      isVideoPlaying: false,
    });
  },

  setSelectedPodcast: (selectedPodcast) => {
    set({ selectedPodcast });
  },

  openSearch: () => {
    set({
      isSearchOpen: true,
      showVideo: false,
      targetVideoId: null,
      isVideoPlaying: false,
    });
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
