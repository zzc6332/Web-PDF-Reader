import { memo, useEffect, useRef } from "react";
import DocumentContainer from "./DocumentContainer";
import ThumbnailsContainer from "./ThumbnailsContainer";
import Props from "src/types/props";
import usePdfReaderStore from "src/stores/usePdfReaderStore";
import { Spin } from "@douyinfe/semi-ui";

interface DocumentLoadingProps extends Props {}

export default memo(function MainContent({
  className: classNameProp,
  style: styleProp,
}: DocumentLoadingProps) {
  const className = classNameProp || "";

  const isPdfActive = usePdfReaderStore((s) => s.isPdfActive);
  const isLoading = usePdfReaderStore((s) => s.isLoading);

  // sideSheetEl 是一个侧边栏，可以控制它的显示与隐藏，其唯一直接子元素是 thumbnailsContainer
  const sideSheetElRef = useRef<HTMLDivElement>(null);
  // thumbnailsContainer 是 ThumbnailsContainer 组件最外层的元素
  const getContainerWidthRef = useRef<{ getContainerWidth: () => string }>(
    null
  );

  const isThumbsVisible = usePdfReaderStore((s) => s.isThumbsVisible);

  // 控制缩略图侧边栏的显示与隐藏
  useEffect(() => {
    const sideSheetEl = sideSheetElRef.current!;
    const width = getContainerWidthRef.current!.getContainerWidth();
    sideSheetEl.style.setProperty(
      "width",
      !!isPdfActive && isThumbsVisible ? width : "0"
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isThumbsVisible, isPdfActive]);

  return (
    <div className={"flex" + " " + className} style={styleProp}>
      <div
        ref={sideSheetElRef}
        className="z-1 flex-none transition-width outline-l1"
        style={{
          transition: "width ease-out 180ms",
        }}
      >
        <ThumbnailsContainer
          ref={getContainerWidthRef}
          className="float-right"
        />
      </div>
      <DocumentContainer className="flex-auto" />
      {isLoading ? (
        <div className="absolute left-0 top-0 z-1 h-full w-full flex items-center justify-center bg-bg-translucence-2">
          <div className="b-radius h-30 w-40 flex flex-col items-center justify-center rounded-xl bg-bg-3 opacity-75">
            <Spin size="large"></Spin>
            <div className="h-3"></div>
            <div>加载中...</div>
          </div>
        </div>
      ) : (
        ""
      )}
    </div>
  );
});
