import { memo } from "react";
import ZoomTool from "./ZoomTool";
import PageTool from "./PageTool";
import Icon, { IconProps } from "src/components/GlobalComponents/Icon";
import ToggleButton from "src/components/GlobalComponents/ToggleButton";
import Props from "src/types/props";
import { colors } from "src/configs/theme";
import useGlobalStore from "../../../stores/useGlobalStore";

const iconProps: Omit<IconProps, "type"> = {
  padding: "0.25rem",
  size: "1.25rem",
  color: colors["on-bg-2"],
  hoverColor: colors["on-bg-1"],
  hoverScale: 1.05,
};

interface ToolBarProps extends Props {}

export default memo(function ToolBar(props: ToolBarProps) {
  const { className } = props;
  const setThemeIndex = useGlobalStore((s) => s.setThemeIndex);
  const themeIndex = useGlobalStore((s) => s.themeIndex);
  return (
    <div
      className={"relative h-12 w-full bg-bg-2 z-1 shadow " + className}
      // style={{ boxShadow: "0 1px 8px rgb(0 0 0 / 0.1)" }}
    >
      {/* 左侧缩略图控制图标 */}
      <div className="absolute left-2 top-0 h-full flex items-center">
        <ToggleButton
          checkedContent={
            <Icon
              type="#icon-pages"
              size="1.25rem"
              color={colors["on-pri-1"]}
            />
          }
          uncheckedContent={
            <Icon type="#icon-pages" size="1.25rem" color={colors["on-bg-2"]} />
          }
          onToggle={() => {}}
        />
      </div>
      {/* 中间工具栏 */}
      <div className="absolute left-1/2 top-0 h-full flex items-center -translate-x-1/2">
        <PageTool className="flex items-center" iconProps={iconProps} />
        <div
          className={"mx-2 h-6 w-px bg-on-bg-1 select-none"}
          onClick={() => {
            setThemeIndex(themeIndex ? 0 : 1);
          }}
        ></div>
        <ZoomTool className="flex items-center" iconProps={iconProps} />
      </div>
    </div>
  );
});
