import { useEffect, useState } from "react";
import useThemeStore from "src/stores/useThemeStore";

export default function useThemes(colorsList: { [key: string]: string[] }) {
  const { style } = document.documentElement;

  const [isMounted, setIsmounted] = useState(false);

  const setSemiTheme = useThemeStore((s) => s.setSemiTheme);
  const themeIndex = useThemeStore((s) => s.themeIndex);

  useEffect(() => {
    setSemiTheme(themeIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    for (const colorName in colorsList) {
      const item = colorsList[colorName];
      const cssVariableName = "--" + colorName;
      const colorValue = item[themeIndex];
      style.setProperty(cssVariableName, colorValue, "important");
    }
    if (isMounted) {
      // 切换主题时和平时使用不同的过渡时间
      style.setProperty("--transition-duration", "600ms");
      setTimeout(() => {
        style.setProperty("--transition-duration", "100ms");
      }, 1000);
    } else {
      // 初始阶段不设置颜色过渡，否则一些动态颜色样式加载时也会有过渡
      style.setProperty("--transition-duration", "0");
      setIsmounted(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeIndex]);

  // 样式加载完毕后开始使用过渡
  useEffect(() => {
    if (isMounted) style.setProperty("--transition-duration", "100ms");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted]);
}
