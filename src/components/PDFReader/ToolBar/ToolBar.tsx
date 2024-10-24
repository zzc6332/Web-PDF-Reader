import { memo } from "react";
import ZoomTool from "./ZoomTool";
import PageTool from "./PageTool";
import Icon, { IconProps } from "src/components/GlobalComponents/Icon";
import ToggleButton from "src/components/GlobalComponents/ToggleButton";
import Props from "src/types/props";
import { colors } from "src/configs/theme";
import useThemeStore from "src/stores/useThemeStore";
import usePdfReaderStore from "src/stores/usePdfReaderStore";

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
  const setThemeIndex = useThemeStore((s) => s.setThemeIndex);
  const themeIndex = useThemeStore((s) => s.themeIndex);
  const setIsThumbsVisible = usePdfReaderStore((s) => s.setIsThumbsVisible);
  const isThumbsVisible = usePdfReaderStore((s) => s.isThumbsVisible);
  const setPdfSrc = usePdfReaderStore((s) => s.setPdfSrc);
  const isPdfActive = usePdfReaderStore((s) => s.isPdfActive);
  const showHistory = usePdfReaderStore((s) => s.showHistory);
  const setShowHistory = usePdfReaderStore((s) => s.setShowHistory);

  const themeButton = (
    <div className="ml-2">
      <ToggleButton
        checkedContent={
          <Icon
            type="#icon-daytime-mode"
            size="1.25rem"
            color={colors["on-bg-2"]}
          />
        }
        uncheckedContent={
          <Icon
            type="#icon-night-mode"
            size="1.25rem"
            color={colors["on-bg-2"]}
          />
        }
        checkedColor={colors["bg-2"]}
        checkedHoverColor={colors["bg-3"]}
        checkedActiveColor={colors["bg-2"]}
        checkedBorderColor={colors["border-l2"]}
        value={!themeIndex}
        onToggle={() => {
          setThemeIndex(themeIndex ? 0 : 1);
        }}
      />
    </div>
  );

  return (
    <div
      className={"relative h-12 w-full bg-bg-2 z-2 outline-l1 " + className}
      style={{ boxShadow: "0 1px 8px rgb(0 0 0 / 0.05)" }}
    >
      {isPdfActive ? (
        <>
          {/* 缩略图控制图标 */}
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
                <Icon
                  type="#icon-pages"
                  size="1.25rem"
                  color={colors["on-bg-2"]}
                />
              }
              value={!!isPdfActive && isThumbsVisible}
              onToggle={(isChecked) => {
                if (isPdfActive) setIsThumbsVisible(isChecked);
              }}
              disabled={!isPdfActive}
            />
          </div>
          {/* 中间工具栏 */}
          <div className="absolute left-1/2 top-0 h-full flex items-center -translate-x-1/2">
            <PageTool className="flex items-center" iconProps={iconProps} />
            <div className={"mx-2 h-6 w-px bg-on-bg-1 select-none"}></div>
            <ZoomTool className="flex items-center" iconProps={iconProps} />
          </div>
          {/* 右侧按钮 */}
          <div className="absolute right-2 top-0 h-full flex items-center">
            {/* 退出按钮 */}
            <div className="ml-2">
              <ToggleButton
                checkedContent={
                  <Icon
                    type="#icon-turn-off"
                    size="1.25rem"
                    color={colors["on-bg-2"]}
                  />
                }
                checkedColor={colors["bg-2"]}
                checkedHoverColor={colors["bg-3"]}
                checkedActiveColor={colors["bg-2"]}
                checkedBorderColor={colors["border-l2"]}
                onClick={() => {
                  setPdfSrc(null);
                }}
                disabled={true}
              />
            </div>
            {/* 黑夜模式开关按钮 */}
            {themeButton}
          </div>
        </>
      ) : (
        <>
          <div className="absolute left-2 top-0 h-full flex items-center">
            <ToggleButton
              checkedContent={
                <Icon
                  type="#icon-history"
                  size="1.25rem"
                  color={colors["on-pri-1"]}
                />
              }
              uncheckedContent={
                <Icon
                  type="#icon-history"
                  size="1.25rem"
                  color={colors["on-bg-2"]}
                />
              }
              value={showHistory}
              onToggle={(isChecked) => {
                setShowHistory(isChecked);
              }}
            />
          </div>
          <div className="absolute right-2 top-0 h-full flex items-center">
            {themeButton}
          </div>
        </>
      )}
    </div>
  );
});
