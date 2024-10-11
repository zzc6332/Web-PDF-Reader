import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import Props from "src/types/props";
import usePdfReaderStore from "src/stores/usePdfReaderStore";
import { debounce, throttle } from "lodash-es";
import useReactiveRef from "src/hooks/useReactiveRef";
import EventListenerContainer from "@/utils/EventListenerContainer";
// import { WorkerProxy } from "worker-handler";
import { CarrierProxy, pdfWorker } from "../../../workers/pdf.main";

interface DocumentContainerProps extends Props {}

export default memo(function DocumentContainer({
  className: classNameProp,
}: DocumentContainerProps) {
  const className = classNameProp || "";

  //#region - 组件中通用数据

  const renderPages = usePdfReaderStore((s) => s.renderPages);
  const pages = usePdfReaderStore((s) => s.pages);
  const pagesWP = usePdfReaderStore((s) => s.pagesWP);
  const padding = usePdfReaderStore((s) => s.padding);
  const scale = usePdfReaderStore((s) => s.scale);
  const viewScale = usePdfReaderStore((s) => s.viewScale);
  const setViewScale = usePdfReaderStore((s) => s.setViewScale);
  const getFinalScale = usePdfReaderStore((s) => s.getFinalScale);
  const getActualViewScale = usePdfReaderStore((s) => s.getActualViewScale);
  const scaleMappingRatio = usePdfReaderStore((s) => s.scaleMappingRatio);
  const pdfReaderEmitter = usePdfReaderStore((s) => s.emitter);
  const minRenderScale = usePdfReaderStore((s) => s.minRenderScale);

  const finalScale = useMemo(
    () => getFinalScale(),
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
  // * canvasElsRef 用来存储当前 DOM 中的每个 canvasEl 的即时引用，以防止出现更新 scale 时新的 canvas 还在渲染（仍未放入 dom 中），此时如果用户进行新的缩放操作时 dom 中的 canvas 无法被改变的情况
  const canvasElsRef = useRef<(HTMLCanvasElement | undefined)[]>([]);
  // * newCanvasElsRef 用来存储当前正在渲染中的 canvasEl
  const newCanvasElsRef = useRef<(HTMLCanvasElement | undefined)[]>([]);

  const pageViews = (
    <div
      ref={pageViewsContainerRef}
      className="min-h-full min-w-full inline-flex flex-col items-center justify-center"
      style={{ padding: `calc(${padding}/2)` }}
    >
      {pages.map((page, pageIndex) => {
        const width = page.width * actualViewScale;
        const height = page.height * actualViewScale;
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

  // * 开启 pages 渲染
  useEffect(() => {
    if (!pagesWP) return;

    const canvasEls: HTMLCanvasElement[] = [];
    // const renderTaskWPPromiseList: Promise<WorkerProxy<RenderTask>>[] = [];
    const scale = finalScale;

    pages.forEach((page, index) => {
      // 创建 canvas 元素，为其设置属性，并使用自定义属性标记它的初始 scale
      const canvasEl = document.createElement("canvas");
      canvasEl.style.setProperty("position", "absolute");
      canvasEl.setAttribute("data-scale", scale + "");
      canvasEl.setAttribute("width", page.width * scale + "");
      canvasEl.setAttribute("height", page.height * scale + "");
      canvasEl.style.setProperty("transform-origin", "top left");
      canvasEls[index] = canvasEl;

      newCanvasElsRef.current[index] = canvasEl;
      canvasEl?.style.setProperty(
        "transform",
        `scale(${actualViewScale / +canvasEl.dataset.scale!})`
      );

      // 将 canvaEl 放入 DOM 中
      const canvasContainerEl = canvasContainerElsRef.current[index];
      const containerLength = canvasContainerEl?.children.length;
      if (containerLength === 0) {
        canvasContainerEl!.append(canvasEl);
        // 向 canvasElsRef 中注册当前的 canvasEl（canvasElsRef 中存放的是当前的 canvasEl 或上一次的还残留在 DOM 中的 canvasEl，当新的 canvasEl 准备好了时就会将其替换）
        canvasElsRef.current[index] = canvasEl;
      }
    });

    // 开启渲染任务
    const renderTasksWPPromise = renderPages(
      canvasEls.map((canvasEl) => canvasEl.transferControlToOffscreen()),
      pagesWP!,
      {
        scale,
      }
    );

    // 渲染完成后的处理
    renderTasksWPPromise.then(async (renderTasksWP) => {
      const onCancelRender = async () => {
        pdfReaderEmitter.off("cancelRender", onCancelRender);
        await pdfWorker.execute("cancelRenders", [], renderTasksWP).promise;
        // });
      };
      pdfReaderEmitter.on("cancelRender", onCancelRender);

      renderTasksWP.forEach(async (renderTaskWP, index) => {
        const canvasEl = canvasEls[index];
        const canvasContainerEl = canvasContainerElsRef.current[index];
        await renderTaskWP.promise;
        // console.log("第 " + (index + 1) + " 页渲染完成");
        canvasContainerEl?.replaceChildren(canvasEl);
        canvasElsRef.current[index] = canvasEl;
      });

      const renderTaskPromises: CarrierProxy<Promise<void>>[] = [];
      for await (const renderTaskWP of renderTasksWP) {
        renderTaskPromises.push(renderTaskWP.promise);
      }
      if (renderTaskPromises.length > 0) {
        Promise.all(renderTaskPromises)
          .then(() => {
            // console.log("所有 page 渲染完成");
            pdfReaderEmitter.off("cancelRender", onCancelRender);
            setIsRendering(false);
            // 如果更换了 pdfDocument，则将 canvasElsRef 中多余的页数去除
            canvasElsRef.current.length = newCanvasElsRef.current.length;
          })
          .catch(() => {});
      }
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, scale]);

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
    newCanvasElsRef.current.forEach((canvasEl) => {
      canvasEl?.style.setProperty(
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
  }, [viewScale]);

  const setIsRendering = usePdfReaderStore((s) => s.setIsRendering);

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
    const { scrollHeight } = documentContainer;
    const observer = new ResizeObserver((_, observer) => {
      // 确定 scrollHeight 发生过变化了再改变滚动条位置
      if (scrollHeight === documentContainer.scrollHeight) return;
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
  }, []);

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
          viewScaleRef.current - e.deltaY * 0.01 * 0.01 * 10
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
