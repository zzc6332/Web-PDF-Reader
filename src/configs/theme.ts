// import { colors } from "uno.config";

// export { colors };
export const colorsList = {
  "pri-0": ["#c73338", "#f5938c"],
  "pri-1": ["#ef4444", "#f26c68"],
  "pri-2": ["#f26c68", "#ef4444"],
  "pri-3": ["#f5938c", "#ca3f44"],
  "bg-1": ["#fff", "#161616"], // white, neutral-700
  "bg-2": ["#f5f5f5", "#202020"], // neutral-100, neutral-600
  "bg-3": ["#e5e5e5", "#303030"], // neutral-200, neutral-500
  "bg-translucence-1": ["rgba(0,0,0,0.25)", "rgba(255,255,255,0.25)"],
  "bg-translucence-2": ["rgba(0,0,0,0.5)", "rgba(255,255,255,0.5)"],
  "bg-translucence-3": ["rgba(0,0,0,0.75)", "rgba(255,255,255,0.75)"],
  "on-bg-1": ["#404040", "#f5f5f5"], // neutral-700, neutral-100
  "on-bg-2": ["#737373", "#d4d4d4"], // neutral-500, neutral-300
  "on-bg-3": ["#d4d4d4", "#737373"], // neutral-300, neutral-500
  "on-pri-1": ["#fff", "#fff"], // white
  "on-pri-2": ["#e5e5e5", "#e5e5e5"], // neutral-200
  "on-pri-3": ["#a3a3a3", "#a3a3a3"], // neutral-400
  "border-l1": ["rgb(0 0 0 / 0.1)", "rgb(255 255 255 / 0.1)"],
  "border-l2": ["rgb(0 0 0 / 0.2)", "rgb(255 255 255 / 0.2)"],
  "border-l3": ["rgb(0 0 0 / 0.3)", "rgb(255 255 255 / 0.3)"],
};

function getColors() {
  type ColorName = keyof typeof colorsList;
  type Colors = Record<ColorName, string>;
  const colors = {} as Colors;
  const colorNames = Object.keys(colorsList) as ColorName[];
  colorNames.forEach((colorName) => {
    colors[colorName] = `var(--${colorName})`;
  });
  return colors;
}

export const colors = getColors();
