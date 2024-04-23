import { memo, useEffect, useMemo, useRef } from "react";
import Props from "src/types/props";
import usePdfReaderStore from "src/stores/usePdfReaderStore";
import { debounce, throttle } from "lodash-es";
import usePagesRender from "src/hooks/pdfReaderHooks/usePagesRender";

interface DocumentContainerProps extends Props {}

export default memo(function DocumentContainer({
  className: classNameProp,
}: DocumentContainerProps) {
  const className = classNameProp || "";

  const enableRecordScrollRef = useRef<boolean>(false);

  // 将 documentContainer 元素传给 store 管理，使得 store 中可以实时获得容器的 scroll 等信息
  const documentContainerRef = useRef<HTMLDivElement>(null);
  const specifyDocumentContainer = usePdfReaderStore(
    (s) => s.specifyDocumentContainer
  );
  useEffect(() => {
    specifyDocumentContainer(documentContainerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const updateCurrentPageNum = throttle(
    usePdfReaderStore((s) => s.updateCurrentPageNum),
    300
  );
  const updateScroll = debounce(
    usePdfReaderStore((s) => s.updateScroll),
    300
  );

  const pdfDocument = usePdfReaderStore((s) => s.pdfDocument);
  const pages = usePdfReaderStore((s) => s.pages);
  const padding = usePdfReaderStore((s) => s.padding);
  const scale = usePdfReaderStore((s) => s.scale);
  const viewScale = usePdfReaderStore((s) => s.viewScale);
  const getActualScale = usePdfReaderStore((s) => s.getActualScale);
  const getActualViewScale = usePdfReaderStore((s) => s.getActualViewScale);
  const scaleMappingRatio = usePdfReaderStore((s) => s.scaleMappingRatio);
  const getNewScroll = usePdfReaderStore((s) => s.getNewScroll);

  const viewScaleRef = useRef(viewScale);
  useEffect(() => {
    viewScaleRef.current = viewScale;
  }, [viewScale]);

  const actualScale = useMemo(
    () => getActualScale(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scale, scaleMappingRatio]
  );

  const actualViewScale = useMemo(
    () => getActualViewScale(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewScale, scaleMappingRatio]
  );

  const scrollX = usePdfReaderStore((s) => s.scrollX);
  const scrollY = usePdfReaderStore((s) => s.scrollY);

  useEffect(() => {
    if (
      documentContainerRef.current &&
      pages.length === pdfDocument?.numPages
    ) {
      enableRecordScrollRef.current = true;
      documentContainerRef.current.scrollLeft = scrollX;
      documentContainerRef.current.scrollTop = scrollY;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages]);

  const [canvasEls, renderTasks] = usePagesRender(pages, {
    // 最小渲染 scale 取 1，避免页面过于缩小后突然放大导致画面过于模糊
    scale: Math.max(actualScale, 1),
  });

  const canvasContainerElsRef = useRef<(HTMLDivElement | null)[]>([]);

  const pageViewsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const pagesViewsContainer = pageViewsContainerRef.current;
    const documentContainer = documentContainerRef.current;
    if (!pagesViewsContainer || !documentContainer) return;

    let preViewScale = viewScale;
    let preScrollWidth = pagesViewsContainer.offsetWidth;
    let preScrollHeight = pagesViewsContainer.offsetHeight;

    let preScrollTop: number;
    let preScrollLeft: number;
    pdfReaderEmitter.on("setViewScale", (scrollLeft, scrollTop) => {
      preScrollLeft = scrollLeft;
      preScrollTop = scrollTop;
    });

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const borderBoxSize = entry.borderBoxSize[0];
        const scrollWidth = borderBoxSize.inlineSize;
        const scrollHeight = borderBoxSize.blockSize;

        const { newScrollTop, newScrollLeft } = getNewScroll(
          preViewScale,
          preScrollHeight,
          preScrollWidth,
          preScrollTop,
          preScrollLeft,
          documentContainer
        );

        documentContainer.scrollTop = Math.round(newScrollTop);
        documentContainer.scrollLeft = Math.round(newScrollLeft);

        preScrollWidth = scrollWidth;
        preScrollHeight = scrollHeight;
        preViewScale = viewScaleRef.current;
      }
    });
    observer.observe(pagesViewsContainer, { box: "border-box" });
    return () => {
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pageViews = (
    <div
      ref={pageViewsContainerRef}
      className="min-h-full min-w-full inline-flex flex-col items-center justify-center"
    >
      <div style={{ marginBottom: padding }}>
        {pages.map((page, pageIndex) => {
          const viewport = page.getViewport({ scale: actualViewScale });
          const { width, height } = viewport;
          return (
            // 最外层的 container，用于设置 padding、margin
            <div
              key={pageIndex}
              className="relative box-content"
              style={{
                marginTop: padding,
                marginLeft: padding,
                marginRight: padding,
                boxSizing: "content-box",
                width: Math.floor(width),
                height: Math.floor(height),
              }}
            >
              {/* 内层的 container，用于包裹渲染内容和背景色 */}
              <div className="relative size-full shadow">
                {/* 包裹 canvas 的 container */}
                <div
                  className="absolute left-0 top-0"
                  ref={(el) => {
                    canvasContainerElsRef.current[pageIndex] = el;
                  }}
                >
                  {/* 在这个位置插入 canvas 的 dom */}
                </div>
                <div className="size-full bg-white"></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const setIsRendering = usePdfReaderStore((s) => s.setIsRendering);

  useEffect(() => {
    canvasEls.forEach((canvasEl) => {
      canvasEl.style.setProperty(
        "transform",
        `scale(${actualViewScale / +canvasEl.dataset.scale!})`
      );
      canvasEl.style.setProperty("position", "absolute");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasEls, viewScale]);

  const pdfReaderEmitter = usePdfReaderStore((s) => s.emitter);
  const renderCompletionsRef = useRef<boolean[]>([]);
  useEffect(() => {
    // console.log(111111111, renderTasks);
    if (renderTasks.length > 0) {
      setIsRendering(true);
    }
    renderTasks.forEach((renderTask, index) => {
      const renderCompletions = renderCompletionsRef.current;
      const canvasEl = canvasEls[index];
      renderTask.promise
        .then(() => {
          console.log(`第${index + 1}页渲染完成`);
          // 每当一个 renderTask 完成时，将 canvas 放入页面中
          renderCompletions[index] = true;
          canvasContainerElsRef.current[index]?.replaceChildren(canvasEl);

          // 当所有 renderTask 完成时，关闭 isRendering 状态
          if (renderCompletions.length === pdfDocument!.numPages) {
            for (let i = 0; i < pdfDocument!.numPages; i++) {
              if (!renderCompletions[i]) return;
            }
            console.log("所有 page 渲染完成");
            setIsRendering(false);
          }
        })
        .catch(() => {
          // console.log("renderTask 取消");
        });
    });

    const onCancelRender = () => {
      renderTasks.forEach((renderTask) => {
        renderTask.cancel();
      });
    };
    pdfReaderEmitter.on("cancelRender", onCancelRender);

    return () => {
      renderCompletionsRef.current = [];
      pdfReaderEmitter.off("cancelRender", onCancelRender);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderTasks]);
  // console.log("renderTasks：", renderTasks);

  return (
    <div className={"relative size-full overflow-hidden " + className}>
      {/* <div className="absolute left-1/2 top-1/2 z-1 size-5 bg-gray-1 -translate-x-1/2 -translate-y-1/2">
      </div> */}
      <div
        className={"relative size-full overflow-auto bg-bg-3" + className}
        onScroll={(e) => {
          updateCurrentPageNum();
          if (enableRecordScrollRef.current) updateScroll(e);
        }}
        ref={documentContainerRef}
      >
        {pageViews}
      </div>
    </div>
  );
});
