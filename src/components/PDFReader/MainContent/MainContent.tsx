import { memo, useEffect, useRef } from "react";
import DocumentContainer from "./DocumentContainer";
import ThumbnailsContainer from "./ThumbnailsContainer";
import Props from "src/types/props";
import usePdfReaderStore from "src/stores/usePdfReaderStore";
import Selector from "./Selector";

interface DocumentLoadingProps extends Props {}

export default memo(function MainContent({
  className: classNameProp,
}: DocumentLoadingProps) {
  const className = classNameProp || "";

  const isPdfActive = usePdfReaderStore((s) => s.isPdfActive);

  // sideSheetEl 是一个侧边栏，可以控制它的显示与隐藏，其唯一直接子元素是 thumbnailsContainer
  const sideSheetElRef = useRef<HTMLDivElement>(null);
  // thumbnailsContainer 是 ThumbnailsContainer 组件最外层的元素
  const getContainerWidthRef = useRef<{ getContainerWidth: () => string }>(
    null
  );

  const isThumbsVisible = usePdfReaderStore((s) => s.isThumbsVisible);
  const pdfCacheId = usePdfReaderStore((s) => s.pdfCacheId);
  const setPdfSrc = usePdfReaderStore((s) => s.setPdfSrc);

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

  // 刷新时如果 pdf 处于打开状态，那么刷新完成后从 indexedDB 中获取它
  useEffect(() => {
    if (!isPdfActive) return;
    setPdfSrc(pdfCacheId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={"flex" + " " + className}>
      <div
        ref={sideSheetElRef}
        className="flex-none transition-width"
        style={{
          transition: "width ease-out 180ms",
        }}
      >
        <ThumbnailsContainer
          ref={getContainerWidthRef}
          className="float-right"
        />
      </div>
      {isPdfActive ? <DocumentContainer className="flex-auto" /> : <Selector />}
    </div>
  );
});
