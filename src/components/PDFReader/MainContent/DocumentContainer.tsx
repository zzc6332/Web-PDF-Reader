import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import Props from "src/types/props";
import usePdfReaderStore from "src/stores/usePdfReaderStore";
import { debounce, throttle } from "lodash-es";
import usePagesRender from "src/hooks/pdfReaderHooks/usePagesRender";
import useReactiveRef from "src/hooks/useReactiveRef";
import EventListenerContainer from "@/utils/EventListenerContainer";

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

  const resetDomState = usePdfReaderStore((s) => s.resetDomState);

  // * 将 documentContainer 元素传给 store 管理，使得 store 中可以实时获得容器的 scroll 等信息
  useEffect(() => {
    specifyDocumentContainer(documentContainerRef.current);
    return () => {
      // 离开组件时对 store 中的一些 state 进行重置
      resetDomState();
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
  // * 定义最小的渲染 scale （对于 pdfjs 而言），避免渲染图像过大导致卡顿
  const maxRenderScale = 5;

  // * 开启 pages 渲染
  const [canvasEls, renderTasks] = usePagesRender(pages, {
    scale: Math.min(Math.max(actualScale, minRenderScale), maxRenderScale),
  });

  // * canvasElsRef 用来存储当前 DOM 中的每个 canvasEl 的即时引用，以防止出现更新 scale 时新的 canvas 还在渲染（仍未放入 dom 中），此时如果用户进行新的缩放操作时 dom 中的 canvas 无法被改变的情况
  const canvasElsRef = useRef<(HTMLCanvasElement | undefined)[]>([]);

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
      canvasEl.style.setProperty("position", "absolute");
      canvasEl.style.setProperty(
        "transform",
        `scale(${actualViewScale / +canvasEl.dataset.scale!})`
      );
    });
    // 以防此时 dom 上还存在旧的 canvas，从 canvasElsRef 中将 dom 中的 canvas 也处理一遍
    canvasElsRef.current.forEach((canvasEl) => {
      canvasEl?.style.setProperty(
        "transform",
        `scale(${actualViewScale / +canvasEl.dataset.scale!})`
      );
    });
    // viewScale 作为依赖是由于更改 viewScale 时，函数节流会使得当前 viewScale 与 canvas 的渲染 scale 不匹配，直到新的 canvas 被创建
    // canvasEls 作为依赖是由于当 avtualViewScale 小于一定值时，当前 viewScale 与 canvas 的渲染 scale 始终不匹配，如果 canvas 是在这样的情况下被创建的，则也需要为其匹配 viewScale
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasEls, viewScale]);

  const setIsRendering = usePdfReaderStore((s) => s.setIsRendering);
  const renderCompletionsRef = useRef<boolean[]>([]);

  // * 每当有新的 renderTask，则在合适的时间将新的 canvas 放到 dom 中
  useEffect(() => {
    if (renderTasks.length > 0) {
      setIsRendering(true);
    }
    renderTasks.forEach((renderTask, index) => {
      const canvasEl = canvasEls[index];
      const canvasContainerEl = canvasContainerElsRef.current[index];
      // 如果当前 canvasContainerEl 中还没有 canvas 元素（即初次渲染时），则先将 canvas 立即添加到 dom 中，这样可以提前显示已经渲染的内容，以提升用户体验；否则如果是修改 scale 引起的渲染，需要等渲染完成时再替换 canvas，防止出现闪烁
      let isFirstLoad = false;
      if (!canvasContainerEl?.children.length) {
        canvasContainerEl?.replaceChildren(canvasEl);
        // 向 canvasElsRef 中注册当前 dom 中的的 canvasEl
        canvasElsRef.current[index] = canvasEl;
        isFirstLoad = true;
      }
      renderTask.promise
        .then(() => {
          // 如果是初次渲染，canvas 会在渲染完成前就添加到 dom 中，渲染完成时就不需要再次添加
          if (!isFirstLoad) {
            canvasContainerEl?.replaceChildren(canvasEl);
            // 向 canvasElsRef 中注册当前 dom 中的的 canvasEl
            canvasElsRef.current[index] = canvasEl;
          }
          // console.log(`第 ${index + 1} 页渲染完成`);
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
        // 如果更换了 pdfDocument，则将 canvasElsRef 中多余的页数去除
        canvasElsRef.current.length = canvasEls.length;
      })
      .catch(() => {
        // console.log("渲染中断");
      });

    // 如果渲染完成前触发了新的渲染，则取消当前渲染任务
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

  //#region - 控制 scroll

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

    // const { clientWidth, clientHeight } = documentContainer;
    let preViewScale = viewScale;
    let preScrollLeft = 0;
    let preScrollTop = 0;
    let scaleOriginLeft = 0;
    let scaleOriginTop = 0;
    let { devicePixelRatio } = window;

    const onSetViewScale = (
      scrollLeft: number,
      scrollTop: number,
      _scaleOriginLeft?: number | null,
      _scaleOriginTop?: number | null
    ) => {
      const { clientWidth, clientHeight } = documentContainer;

      preScrollLeft = scrollLeft;
      preScrollTop = scrollTop;

      scaleOriginLeft =
        typeof _scaleOriginLeft === "number"
          ? _scaleOriginLeft
          : clientWidth / 2;
      scaleOriginTop =
        typeof _scaleOriginTop === "number"
          ? _scaleOriginTop
          : clientHeight / 2;
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
      if (window.devicePixelRatio !== devicePixelRatio) {
        devicePixelRatio = window.devicePixelRatio;
        return;
      }
      for (const entry of entries) {
        const borderBoxSize = entry.borderBoxSize[0];
        const scrollWidth = borderBoxSize.inlineSize;
        const scrollHeight = borderBoxSize.blockSize;

        const { clientWidth, clientHeight } = documentContainer;

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
    setTimeout(() => {
      commitScale();
    });
  };

  const offsetCurrentPageNum = usePdfReaderStore((s) => s.offsetCurrentPageNum);

  // * 记录 documentContainer 的聚焦状态
  const isDocumentContainerFocusedRef = useRef(false);

  // * 控制事件监听
  useEffect(() => {
    const documentContainer = documentContainerRef.current!;

    const elc = new EventListenerContainer();

    //#region - 控制 documentContainer 的聚焦状态

    elc.add(documentContainer, "focus", () => {
      isDocumentContainerFocusedRef.current = true;
    });

    elc.add(documentContainer, "blur", () => {
      isDocumentContainerFocusedRef.current = true;
    });

    documentContainer.focus();

    //#endregion

    //#region - crtl + 鼠标滚轮触发缩放

    elc.add(documentContainer, "wheel", (e) => {
      // 在 documentContainer 上发生 wheel 事件时也会使得它 focused
      documentContainer.focus();

      if (e.ctrlKey === true) {
        const documentContainerDomRect =
          documentContainer.getBoundingClientRect();
        e.preventDefault();
        const { x, y } = documentContainerDomRect;
        const { clientX, clientY } = e;
        const scaleOriginX = clientX - x;
        const scaleOriginY = clientY - y;
        const newViewScale = getSafeScaleValue(
          viewScaleRef.current - e.deltaY * 0.01 * 0.01 * 25
        );
        setViewScale(newViewScale, scaleOriginX, scaleOriginY);
        commitScaleDelay();
      }
    });

    elc.add(documentContainer, "keyup", (e) => {
      if (e.key === "Control") {
        commitScaleImmediately();
      }
    });

    //#endregion

    //#region - 方向键触发换页

    elc.add(documentContainer, "keydown", (e) => {
      if (
        !isDocumentContainerFocusedRef.current ||
        (e.key !== "ArrowRight" && e.key !== "ArrowLeft") ||
        (documentContainer.scrollWidth > documentContainer.clientWidth &&
          !e.ctrlKey)
      )
        return;
      offsetCurrentPageNum(e.key === "ArrowRight" ? 1 : -1);
    });

    //#endregion

    return () => {
      elc.removeAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  //#endregion

  return (
    <div
      className={
        "relative size-full overflow-auto bg-bg-3 box-border focus:outline-none " +
        className
      }
      tabIndex={0}
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
