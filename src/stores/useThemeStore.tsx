import { create } from "zustand";

interface ThemeState {
  themeIndex: number;
  setThemeIndex: (themeIndex: number) => void;
  setSemiTheme: (themeIndex: number) => void;
}

const useThemeStore = create<ThemeState>((set) => ({
  themeIndex: 0,
  setThemeIndex: (themeIndex) => {
    set({ themeIndex });
  },
  setSemiTheme: (themeIndex: number) => {
    const body = document.body;
    body.setAttribute("theme-mode", themeIndex === 1 ? "dark" : "");
  },
}));

export default useThemeStore;
