import { memo, useEffect, useRef } from "react";
import DocumentContainer from "./DocumentContainer";
import ThumbnailsContainer from "./ThumbnailsContainer";
import Props from "src/types/props";
import usePdfReaderStore from "src/stores/usePdfReaderStore";

interface DocumentLoadingProps extends Props {}

export default memo(function MainContent({
  className: classNameProp,
}: DocumentLoadingProps) {
  const className = classNameProp || "";

  const loadWorkerProxies = usePdfReaderStore((s) => s.loadWorkerProxies);
  loadWorkerProxies();

  // sideSheetEl 是一个侧边栏，可以控制它的显示与隐藏，其唯一直接子元素是 thumbnailsContainer
  const sideSheetElRef = useRef<HTMLDivElement>(null);
  // thumbnailsContainer 是 ThumbnailsContainer 组件最外层的元素
  const getContainerWidthRef = useRef<{ getContainerWidth: () => string }>(
    null
  );

  const isThumbsVisible = usePdfReaderStore((s) => s.isThumbsVisible);

  useEffect(() => {
    const sideSheetEl = sideSheetElRef.current!;
    const width = getContainerWidthRef.current!.getContainerWidth();
    sideSheetEl.style.setProperty("width", isThumbsVisible ? width : "0");
  }, [isThumbsVisible]);

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
      <DocumentContainer className="flex-auto" />
    </div>
  );
});
