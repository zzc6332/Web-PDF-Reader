import { memo } from "react";
import ZoomTool from "./ZoomTool";
import PageTool from "./PageTool";
import Icon, { IconProps } from "src/components/GlobalComponents/Icon";
import ToggleButton from "src/components/GlobalComponents/ToggleButton";
import Props from "src/types/props";
import { colors } from "src/configs/theme";
import useThemeStore from "src/stores/useThemeStore";
import usePdfReaderStore from "src/stores/usePdfReaderStore";
import { Checkbox } from "@douyinfe/semi-ui";

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
  const historySelectMode = usePdfReaderStore((s) => s.historySelectMode);
  const setHistorySelectMode = usePdfReaderStore((s) => s.setHistorySelectMode);
  const checkAll = usePdfReaderStore((s) => s.checkAll);
  const setCheckAll = usePdfReaderStore((s) => s.setCheckAll);
  const pdfEmitter = usePdfReaderStore((s) => s.emitter);

  const themeButton = (
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
  );

  // 分隔符号
  const Delimiter = (
    <div className={"mx-2 h-6 w-px bg-on-bg-1 select-none"}></div>
  );

  const onPdfActive = (
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
            <Icon type="#icon-pages" size="1.25rem" color={colors["on-bg-2"]} />
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
        {Delimiter}
        <ZoomTool className="flex items-center" iconProps={iconProps} />
      </div>
      {/* 右侧按钮 */}
      <div className="absolute right-2 top-0 h-full flex items-center">
        {/* 退出按钮 */}
        <ToggleButton
          className="mr-2"
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
        {/* 黑夜模式开关按钮 */}
        {themeButton}
      </div>
    </>
  );

  const onShowHistory = (
    <>
      {Delimiter}
      {historySelectMode ? (
        <>
          <ToggleButton
            checkedContent={
              <>
                <Checkbox
                  checked={checkAll === 1}
                  indeterminate={checkAll === -1}
                />
                <span className="ml-2 c-on-bg-1">全选</span>
              </>
            }
            width="5rem"
            checkedColor={colors["bg-2"]}
            checkedHoverColor={colors["bg-3"]}
            checkedActiveColor={colors["bg-2"]}
            checkedBorderColor={colors["border-l2"]}
            onClick={() => {
              setCheckAll(checkAll === 0 || checkAll === -1 ? 1 : 0);
            }}
            disabled={true}
          />
          <ToggleButton
            className="ml-2"
            checkedContent={
              <Icon
                type="#icon-delete"
                size="1.25rem"
                color={colors["on-bg-2"]}
              />
            }
            checkedColor={colors["bg-2"]}
            checkedHoverColor={colors["bg-3"]}
            checkedActiveColor={colors["bg-2"]}
            checkedBorderColor={colors["border-l2"]}
            onClick={() => {
              pdfEmitter.emit("deleteCache");
            }}
            disabled={true}
          />
          <ToggleButton
            className="ml-2"
            checkedContent={
              <Icon
                type="#icon-return"
                size="1.25rem"
                color={colors["on-bg-2"]}
              />
            }
            checkedColor={colors["bg-2"]}
            checkedHoverColor={colors["bg-3"]}
            checkedActiveColor={colors["bg-2"]}
            checkedBorderColor={colors["border-l2"]}
            onClick={() => {
              setHistorySelectMode(false);
            }}
            disabled={true}
          />
        </>
      ) : (
        <ToggleButton
          checkedContent={
            <Icon
              type="#icon-multiple-check"
              size="1.25rem"
              color={colors["on-bg-2"]}
            />
          }
          checkedColor={colors["bg-2"]}
          checkedHoverColor={colors["bg-3"]}
          checkedActiveColor={colors["bg-2"]}
          checkedBorderColor={colors["border-l2"]}
          onClick={() => {
            setHistorySelectMode(true);
          }}
          disabled={true}
        />
      )}
    </>
  );

  const onPdfNotActive = (
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
        {showHistory ? onShowHistory : ""}
      </div>
      <div className="absolute right-2 top-0 h-full flex items-center">
        {themeButton}
      </div>
    </>
  );

  return (
    <div
      className={"relative h-12 w-full bg-bg-2 z-2 outline-l1 " + className}
      style={{ boxShadow: "0 1px 8px rgb(0 0 0 / 0.05)" }}
    >
      {isPdfActive ? onPdfActive : onPdfNotActive}
    </div>
  );
});
