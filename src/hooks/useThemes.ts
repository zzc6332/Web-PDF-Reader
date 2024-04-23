import { useEffect, useRef } from "react";

export default function useThemes(
  colorsList: { [key: string]: string[] },
  themeIndex: number
) {
  const { style } = document.documentElement;
  const isMounted = useRef(false);
  useEffect(() => {
    for (const colorName in colorsList) {
      const item = colorsList[colorName];
      const cssVariableName = "--" + colorName;
      const colorValue = item[themeIndex];
      style.setProperty(cssVariableName, colorValue, "important");
    }
    if (isMounted.current) {
      style.setProperty("--transition-duration", "600ms");
      setTimeout(() => {
        style.setProperty("--transition-duration", "100ms");
      }, 1000);
    } else {
      style.setProperty("--transition-duration", "100ms");
      isMounted.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeIndex]);
}
