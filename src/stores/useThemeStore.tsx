import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface ThemeState {
  themeIndex: number;
  setThemeIndex: (themeIndex: number) => void;
  setSemiTheme: (themeIndex: number) => void;
}

const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      themeIndex: 0,
      setThemeIndex: (themeIndex) => {
        // 用于切换 src/configs/theme.ts 中的自定义颜色
        set({ themeIndex });
        // 用于切换 semi-degisn 中的主题
        get().setSemiTheme(themeIndex);
      },
      setSemiTheme: (themeIndex) => {
        const body = document.body;
        body.setAttribute("theme-mode", themeIndex === 1 ? "dark" : "");
      },
      set,
    }),
    {
      name: "theme-state",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => {
        const { themeIndex } = state;
        return { themeIndex };
      },
    }
  )
);
export default useThemeStore;
