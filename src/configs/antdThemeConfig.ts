import { ThemeConfig } from "antd";
import { colors, colorsList } from "./theme";

const antdThemeConfig: ThemeConfig = {
  components: {
    Slider: {
      handleActiveColor: colors["pri-1"],
      handleColor: colors["pri-1"],
      dotActiveBorderColor: colors["pri-1"],
      trackBg: colors["pri-1"],
      trackHoverBg: colors["pri-1"],
      handleSize: 10,
      handleSizeHover: 11,
      handleLineWidthHover: 2.5,
    },
  },
  token: {
    colorPrimaryBorderHover: colors["pri-1"],
    colorBgContainer: colors["bg-1"],
    colorBgContainerDisabled: colors["bg-2"],
    colorBorder: colors["on-bg-3"],
    colorPrimary: colorsList["pri-1"][0],
  },
};

export default antdThemeConfig;
