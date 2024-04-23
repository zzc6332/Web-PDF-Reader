import { create } from "zustand";

interface GlobalState {
  themeIndex: number;
  setThemeIndex: (themeIndex: number) => void;
}

const useGlobalStore = create<GlobalState>((set) => ({
  themeIndex: 0,
  setThemeIndex: (themeIndex) => {
    set({ themeIndex });
  },
}));

export default useGlobalStore;
