import { create } from 'zustand';

type AccountModalState = {
  isOpen: boolean;
  userName: string;
  open: () => void;
  close: () => void;
  setUserName: (name: string) => void;
};

export const useAccountModalStore = create<AccountModalState>((set) => ({
  isOpen: false,
  userName: 'Daniel Delgado',
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  setUserName: (userName) => set({ userName }),
}));
