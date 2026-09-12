import { create } from 'zustand';

import type { PodcastRef } from '@aurora/model';

import { createUniversalStore } from '../services/universalStore';

type PodcastState = {
  favorites: PodcastRef[];
  loaded: boolean;
  load: () => Promise<void>;
  toggleFavorite: (podcast: PodcastRef) => Promise<void>;
};

const store = createUniversalStore('podcasts.json');

export const usePodcastStore = create<PodcastState>((set, get) => ({
  favorites: [],
  loaded: false,
  load: async () => {
    set({
      favorites: (await store.get<PodcastRef[]>('favorites')) ?? [],
      loaded: true,
    });
  },
  toggleFavorite: async (podcast) => {
    const favorites = get().favorites.some((item) => item.id === podcast.id)
      ? get().favorites.filter((item) => item.id !== podcast.id)
      : [...get().favorites, podcast];
    set({ favorites });
    await store.set('favorites', favorites);
    await store.save();
  },
}));
