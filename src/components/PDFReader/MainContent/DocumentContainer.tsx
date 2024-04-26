import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import Props from "src/types/props";
import usePdfReaderStore from "src/stores/usePdfReaderStore";
import { debounce, throttle } from "lodash-es";
import usePagesRender from "src/hooks/pdfReaderHooks/usePagesRender";
import useReactiveRef from "src/hooks/useReactiveRef";

interface DocumentContainerProps extends Props {}

export default memo(function DocumentContainer({
  className: classNameProp,
}: DocumentContainerProps) {
  const className = classNameProp || "";

  //#region - 组件中通用数据

  const pdfDocument = usePdfReaderStore((s) => s.pdfDocument);
  const pages = usePdfReaderStore((s) => s.pages);
  const padding = usePdfReaderStore((s) => s.padding);
  const scale = usePdfReaderStore((s) => s.scale);
  const viewScale = usePdfReaderStore((s) => s.viewScale);
  const setViewScale = usePdfReaderStore((s) => s.setViewScale);
  const getActualScale = usePdfReaderStore((s) => s.getActualScale);
  const getActualViewScale = usePdfReaderStore((s) => s.getActualViewScale);
  const scaleMappingRatio = usePdfReaderStore((s) => s.scaleMappingRatio);
  const pdfReaderEmitter = usePdfReaderStore((s) => s.emitter);

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

  //#endregion

  //#region - 一些为了防止闭包陷阱而创建的 refs，通常在各种回调中使用

  const viewScaleRef = useReactiveRef(viewScale);
  const pagesRef = useReactiveRef(pages);
  const pdfDocumentRef = useReactiveRef(pdfDocument);

  //#endregion

  //#region - 组件初始化

  const documentContainerRef = useRef<HTMLDivElement>(null);

  const specifyDocumentContainer = usePdfReaderStore(
    (s) => s.specifyDocumentContainer
  );

  const resetInitialState = usePdfReaderStore((s) => s.resetInitialState);

  // * 将 documentContainer 元素传给 store 管理，使得 store 中可以实时获得容器的 scroll 等信息
  useEffect(() => {
    specifyDocumentContainer(documentContainerRef.current);
    return () => {
      // 离开组件时对 store 中的一些 state 进行重置
      resetInitialState();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  //#endregion

  //#region - pages 渲染

  const pageViewsContainerRef = useRef<HTMLDivElement>(null);
  const canvasContainerElsRef = useRef<(HTMLDivElement | null)[]>([]);

  const pageViews = (
    <div
      ref={pageViewsContainerRef}
      className="min-h-full min-w-full inline-flex flex-col items-center justify-center"
      style={{ padding: `calc(${padding}/2)` }}
    >
      {pages.map((page, pageIndex) => {
        const viewport = page.getViewport({ scale: actualViewScale });
        const { width, height } = viewport;
        return (
          // 最外层的 container，用于设置 padding、padding
          <div
            key={pageIndex}
            className="relative box-content"
            style={{
              padding: `calc(${padding}/2)`,
              boxSizing: "content-box",
              width: Math.floor(width),
              height: Math.floor(height),
            }}
          >
            {/* 内层的 container，用于包裹渲染内容和背景色 */}
            <div className="relative size-full outline-l1">
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
  );

  // * 定义最小的渲染 scale（对于 pdfjs 而言），避免页面过于缩小后突然放大导致画 面过于模糊
  const minRenderScale = 1;

  // & 开启 pages 渲染
  const [canvasEls, renderTasks] = usePagesRender(pages, {
    scale: Math.max(actualScale, minRenderScale),
  });

  // * 对于 chrome 等一些浏览器，当 actualViewScale 小于 minRenderScale 时，一些场景下（比如当滚动条拉到底部时）在 viewScale 变小时会出现 pageViewsContainer 的尺寸变化不引起浏览器重排的情况，需要设法触发浏览器的重排。
  useEffect(() => {
    const pageViewsContainer = pageViewsContainerRef.current;

    if (actualViewScale < minRenderScale && pageViewsContainer) {
      // css 样式中 clear 属性的变化可以引发浏览器的重排，且当前场景下不会影响视觉布局
      if (!pageViewsContainer.style.getPropertyValue("clear")) {
        pageViewsContainer.style.setProperty("clear", "both");
      } else {
        pageViewsContainer.style.removeProperty("clear");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewScale]);

  // * 当 viewScale 与渲染 scale 不同时，为 canvasEl 设置缩放，使其匹配 viewScale
  useEffect(() => {
    canvasEls.forEach((canvasEl) => {
      canvasEl.style.setProperty(
        "transform",
        `scale(${actualViewScale / +canvasEl.dataset.scale!})`
      );
      canvasEl.style.setProperty("position", "absolute");
    });
    // viewScale 作为依赖是由于更改 viewScale 时，函数节流会使得当前 viewScale 与 canvas 的渲染 scale 不匹配，直到新的 canvas 被创建
    // canvasEls 作为依赖是由于当 avtualViewScale 小于一定值时，当前 viewScale 与 canvas 的渲染 scale 始终不匹配，如果 canvas 是在这样的情况下被创建的，则也需要为其匹配 viewScale
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasEls, viewScale]);

  const setIsRendering = usePdfReaderStore((s) => s.setIsRendering);
  const renderCompletionsRef = useRef<boolean[]>([]);

  // * 如果渲染完成前触发了新的渲染，则取消当前渲染任务
  useEffect(() => {
    if (renderTasks.length > 0) {
      setIsRendering(true);
    }
    renderTasks.forEach((renderTask, index) => {
      const canvasEl = canvasEls[index];
      renderTask.promise
        .then(() => {
          canvasContainerElsRef.current[index]?.replaceChildren(canvasEl);
        })
        .catch(() => {
          // console.log("renderTask 取消");
        });
    });
    const renderTasksPromises = renderTasks.map(
      (renderTask) => renderTask.promise
    );
    Promise.all(renderTasksPromises)
      .then(() => {
        // console.log("所有 page 渲染完成");
        setIsRendering(false);
      })
      .catch(() => {
        // console.log("渲染中断");
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
  }, [canvasEls, renderTasks]);

  //#endregion

  //#region - 控制组件行为

  // * 页面刷新时 store 会从 sessionStorage 中读取 scrollX 和 scrollY，将它们应用到 documentContainer 上
  const scrollX = usePdfReaderStore((s) => s.scrollX);
  const scrollY = usePdfReaderStore((s) => s.scrollY);
  const enableRecordScrollRef = useRef<boolean>(false);
  const enableScrollOnScaleRef = useRef<boolean>(false);
  useEffect(() => {
    const documentContainer = documentContainerRef.current;
    const pageViewsContainer = pageViewsContainerRef.current;
    if (!documentContainer || !pageViewsContainer) return;
    const observer = new ResizeObserver((_, observer) => {
      if (pagesRef.current.length !== pdfDocumentRef.current?.numPages) return;
      documentContainer!.scrollLeft = scrollX;
      documentContainer!.scrollTop = scrollY;
      enableRecordScrollRef.current = true;
      observer.disconnect();
      // 要到下一帧才可以开启 enableScrollOnScaleRef，否则另一个 ResizeObserver 回调中会将这里设置的 scrollTop 和 ScrollLeft 覆盖掉
      requestAnimationFrame(() => {
        enableScrollOnScaleRef.current = true;
      });
    });
    observer.observe(pageViewsContainer);
    return () => {
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // * 当 viewScale 变化时，更新 documentContainer 的 scroll
  const getNewScroll = usePdfReaderStore((s) => s.getNewScroll);
  useEffect(() => {
    const pagesViewsContainer = pageViewsContainerRef.current;
    const documentContainer = documentContainerRef.current;
    if (!pagesViewsContainer || !documentContainer) return;

    const { clientWidth, clientHeight } = documentContainer;
    let preViewScale = viewScale;
    let preScrollLeft: number;
    let preScrollTop: number;
    let scaleOriginLeft: number;
    let scaleOriginTop: number;

    const onSetViewScale = (
      scrollLeft: number,
      scrollTop: number,
      _scaleOriginLeft = clientWidth / 2,
      _scaleOriginTop = clientHeight / 2
    ) => {
      preScrollLeft = scrollLeft;
      preScrollTop = scrollTop;
      scaleOriginLeft = _scaleOriginLeft;
      scaleOriginTop = _scaleOriginTop;
    };
    pdfReaderEmitter.on("setViewScale", onSetViewScale);

    // 通过一个 initialObserver 来监视 pagesViewsContainer 的大小，当 enableScrollOnScale 为 true 时初始化完成，得到 preScrollWidth 和 preScrollHeight 的初始值
    let preScrollWidth: number;
    let preScrollHeight: number;
    const initialObserver = new ResizeObserver((entries, observer) => {
      for (const entry of entries) {
        const borderBoxSize = entry.borderBoxSize[0];
        preScrollWidth = borderBoxSize.inlineSize;
        preScrollHeight = borderBoxSize.blockSize;
        if (enableScrollOnScaleRef.current) observer.disconnect();
      }
    });

    initialObserver.observe(pagesViewsContainer);

    // 监视 pagesViewsContainer 的尺寸变化，得到新的 scroll 值
    const observer = new ResizeObserver((entries) => {
      if (!enableScrollOnScaleRef.current) return;
      for (const entry of entries) {
        const borderBoxSize = entry.borderBoxSize[0];
        const scrollWidth = borderBoxSize.inlineSize;
        const scrollHeight = borderBoxSize.blockSize;

        const { newScrollTop, newScrollLeft } = getNewScroll(
          preViewScale,
          preScrollWidth,
          preScrollHeight,
          preScrollLeft,
          preScrollTop,
          scrollWidth,
          scrollHeight,
          scaleOriginLeft,
          scaleOriginTop,
          clientWidth,
          clientHeight
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
      pdfReaderEmitter.off("setViewScale", onSetViewScale);
      observer.disconnect();
      initialObserver.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDocument]);

  //#endregion

  //#region - dom 事件监听

  const updateCurrentPageNum = throttle(
    usePdfReaderStore((s) => s.updateCurrentPageNum),
    300
  );
  const updateScroll = debounce(
    usePdfReaderStore((s) => s.updateScroll),
    300
  );

  const getSafeScaleValue = usePdfReaderStore((s) => s.getSafeScaleValue);
  const commitScale = usePdfReaderStore((s) => s.commitScale);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const commitScaleDelay = useCallback(
    debounce(() => {
      commitScale();
    }, 500),
    []
  );

  const commitScaleImmediately = () => {
    commitScaleDelay.cancel();
    Promise.resolve().then(() => {
      commitScale();
    });
  };

  useEffect(() => {
    const documentContainer = documentContainerRef.current!;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey === true) {
        const documentContainerDomRect =
          documentContainer.getBoundingClientRect();
        e.preventDefault();
        const { x, y } = documentContainerDomRect;
        const { clientX, clientY } = e;
        const scaleOriginX = clientX - x;
        const scaleOriginY = clientY - y;
        const newViewScale = getSafeScaleValue(
          viewScaleRef.current - e.deltaY * 0.01 * 0.01 * 12.5
        );
        setViewScale(newViewScale, scaleOriginX, scaleOriginY);
        commitScaleDelay();
      }
    };
    documentContainer.addEventListener("wheel", onWheel, {
      passive: false,
    });

    const onCtrlKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control") {
        commitScaleImmediately();
      }
    };

    document.body.dispatchEvent(new MouseEvent("click"));

    window.addEventListener("keyup", onCtrlKeyUp);

    documentContainer.addEventListener("touchstart", (e) => {
      console.log(e);
    });

    return () => {
      documentContainer.removeEventListener("wheel", onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  //#endregion

  return (
    <div
      className={
        "relative size-full overflow-auto bg-bg-3 box-border" + className
      }
      onScroll={(e) => {
        updateCurrentPageNum();
        if (enableRecordScrollRef.current) updateScroll(e);
      }}
      ref={documentContainerRef}
    >
      {pageViews}
    </div>
  );
});
