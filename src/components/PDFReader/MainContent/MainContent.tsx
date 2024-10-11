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

  // * del
  // const useLoading = usePdfReaderStore((s) => s.useLoading);
  // useLoading();

  const loadWorkerProxies = usePdfReaderStore((s) => s.loadWorkerProxies);
  loadWorkerProxies();

  // sideSheetEl 是一个侧边栏，可以控制它的显示与隐藏，其唯一直接子元素是 thumbnailsContainer
  const sideSheetElRef = useRef<HTMLDivElement>(null);
  // thumbnailsContainer 是 ThumbnailsContainer 组件最外层的元素
  const thumbnailsContainerRef = useRef<HTMLDivElement>(null);

  const isThumbsVisible = usePdfReaderStore((s) => s.isThumbsVisible);

  useEffect(() => {
    const thumbnailsContainer = thumbnailsContainerRef.current!;
    const sideSheetEl = sideSheetElRef.current!;
    // const observer = new ResizeObserver((entries) => {
    //   for (const entry of entries) {
    //     const width = entry.borderBoxSize[0].inlineSize;
    //     thumbnailsContainer.style.setProperty(
    //       "width",
    //       isThumbsVisible ? "0" : width + "px"
    //     );
    //   }
    // });
    // observer.observe(thumbnailsContainer);
    const { width } = window.getComputedStyle(thumbnailsContainer);
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
          ref={thumbnailsContainerRef}
          className="float-right"
        />
      </div>
      <DocumentContainer className="flex-auto" />
    </div>
  );
});
