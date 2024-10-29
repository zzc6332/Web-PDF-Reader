import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import Props from "src/types/props";
import usePdfReaderStore from "src/stores/usePdfReaderStore";
import { debounce, throttle } from "lodash-es";
import useReactiveRef from "src/hooks/useReactiveRef";
import EventListenerContainer from "@/utils/EventListenerContainer";
import { pdfWorker } from "src/workers/pdf.main";

interface DocumentContainerProps extends Props {}

export default memo(function DocumentContainer({
  className: classNameProp,
  style: styleProp,
}: DocumentContainerProps) {
  const className = classNameProp || "";

  //#region - 组件中通用数据
  const pages = usePdfReaderStore((s) => s.pages);
  const padding = usePdfReaderStore((s) => s.padding);
  const scale = usePdfReaderStore((s) => s.scale);
  const viewScale = usePdfReaderStore((s) => s.viewScale);
  const setViewScale = usePdfReaderStore((s) => s.setViewScale);
  const getFinalScale = usePdfReaderStore((s) => s.getFinalScale);
  const getActualViewScale = usePdfReaderStore((s) => s.getActualViewScale);
  const scaleMappingRatio = usePdfReaderStore((s) => s.scaleMappingRatio);
  const pdfReaderEmitter = usePdfReaderStore((s) => s.emitter);
  const minRenderScale = usePdfReaderStore((s) => s.minRenderScale);
  const getPagesInView = usePdfReaderStore((s) => s.getPagesInView);

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

  const resetReaderState = usePdfReaderStore((s) => s.resetReaderState);

  // * 将 documentContainer 元素传给 store 管理，使得 store 中可以实时获得容器的 scroll 等信息
  useEffect(() => {
    specifyDocumentContainer(documentContainerRef.current);
    return () => {
      // 离开组件时对 store 中的一些 state 进行重置
      resetReaderState();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  //#endregion

  //#region - 控制 scroll

  // * 页面刷新时 store 会从 sessionStorage 中读取 scrollX 和 scrollY，将它们应用到 documentContainer 上
  const scrollX = usePdfReaderStore((s) => s.scrollX);
  const scrollY = usePdfReaderStore((s) => s.scrollY);
  const enableRecordScrollRef = useRef<boolean>(false);
  // enableRecordPreScrollSizeRef 存储了一个开关，为 true 时则会在初始阶段记录 pagesViewsContainer 的 preScrollSize
  const enableRecordPreScrollSizeRef = useRef<boolean>(true);
  // enableScrollOnScaleRef 存储一个开关，为 true 时会在缩放时实时更新 scroll 的距离
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
      // 滚动条改变前视图中的页面可能已经开始渲染，要取消掉
      if (scrollY !== 0) pdfWorker.execute("cancelRenders");
      observer.disconnect();
      // 立即关闭 initialObserver 的监听，preScrollSize 停止更新
      enableRecordPreScrollSizeRef.current = false;
      // 要到下一帧才可以开启 enableScrollOnScaleRef，否则这里设置的 scrollTop 和 ScrollLeft 会在另一个 observer 中被覆盖掉
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

    const onEnableRerender = () => {
      enablererenderOnScrollRef.current = true;
    };
    pdfReaderEmitter.on("enableRerenderOnScroll", onEnableRerender);

    // 通过一个 initialObserver 来监视 pagesViewsContainer 的大小，当 enableScrollOnScale 为 true 时初始化完成，得到 preScrollWidth 和 preScrollHeight 的初始值
    let preScrollWidth: number;
    let preScrollHeight: number;

    // 监视 pagesViewsContainer 的尺寸变化，得到新的 scroll 值
    const observer = new ResizeObserver((entries) => {
      if (!enableScrollOnScaleRef.current) {
        for (const entry of entries) {
          const borderBoxSize = entry.borderBoxSize[0];
          preScrollWidth = borderBoxSize.inlineSize;
          preScrollHeight = borderBoxSize.blockSize;
        }
        // console.log(preScrollWidth, preScrollHeight);
      } else {
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

          // console.log(
          //   "preViewScale: ",
          //   preViewScale,
          //   "preScrollWidth: ",
          //   preScrollWidth,
          //   "preScrollHeight: ",
          //   preScrollHeight,
          //   "preScrollLeft: ",
          //   preScrollLeft,
          //   "preScrollTop: ",
          //   preScrollTop,
          //   "scrollWidth: ",
          //   scrollWidth,
          //   "scrollHeight: ",
          //   scrollHeight,
          //   "scaleOriginLeft: ",
          //   scaleOriginLeft,
          //   "scaleOriginTop: ",
          //   scaleOriginTop,
          //   "clientWidth: ",
          //   clientWidth,
          //   "clientHeight: ",
          //   clientHeight
          // );

          documentContainer.scrollTop = Math.round(newScrollTop);
          documentContainer.scrollLeft = Math.round(newScrollLeft);

          preScrollWidth = scrollWidth;
          preScrollHeight = scrollHeight;
          preViewScale = viewScaleRef.current;
        }
      }
    });
    observer.observe(pagesViewsContainer, { box: "border-box" });

    return () => {
      pdfReaderEmitter.off("setViewScale", onSetViewScale);
      pdfReaderEmitter.off("enableRerenderOnScroll", onEnableRerender);
      observer.disconnect();
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
  // * renderListRef 用来记录目前 pages，Map 中的 key 为页码，value 为渲染状态：0 代表渲染未完成，1 代表正在渲染完成，-1 代表渲染失败
  const renderListRef = useRef<Map<number, number>>(new Map());
  // * renderIdRef 用来记录执行 render 函数的次数的，每次渲染后递增
  const renderIdRef = useRef<number>(0);
  // * enablererenderOnScroll 用来记录一个布尔值，决定当前的 rerenderOnScroll 回调是否生效
  const enablererenderOnScrollRef = useRef<boolean>(false);

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
          // 外层的 container，用于设置 padding、padding
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
            {/* 内层的 container，用于包裹渲染内容和背景色*/}
            <div
              className="relative size-full bg-white outline-l1"
              ref={(el) => {
                canvasContainerElsRef.current[pageIndex] = el;
              }}
            >
              {/* 在这个位置插入 canvas 的 dom */}
            </div>
          </div>
        );
      })}
    </div>
  );

  // * 开启 pages 渲染
  function render(pageNums: number[]) {
    if (pageNums.length === 0) return;
    const currentRenderId = renderIdRef.current;
    const canvasMap = new Map<number, HTMLCanvasElement>();
    const pageSizeMap = new Map<number, [number, number, number]>();
    const scale = getFinalScale();
    // console.log(...pageNums, "加入渲染", scale);

    pageNums.forEach((pageNum) => {
      const pageIndex = pageNum - 1;
      const page = pages[pageIndex];

      // 创建 canvas 元素，为其设置属性，并使用自定义属性标记它的初始 scale
      const canvasEl = document.createElement("canvas");
      canvasEl.style.setProperty("position", "absolute");
      canvasEl.style.setProperty("top", "0");
      canvasEl.style.setProperty("left", "0");
      canvasEl.setAttribute("data-scale", scale + "");
      canvasEl.setAttribute("width", page.width * scale + "");
      canvasEl.setAttribute("height", page.height * scale + "");
      canvasEl.style.setProperty("transform-origin", "top left");
      canvasEl.style.setProperty(
        "transform",
        `scale(${actualViewScale / +canvasEl.dataset.scale!})`
      );
      // newCanvasElsRef 中存储将要渲染的 canvas
      newCanvasElsRef.current[pageIndex] = canvasEl;

      canvasMap.set(pageNum, canvasEl);
      pageSizeMap.set(pageNum, [canvasEl.width, canvasEl.height, scale]);
    });

    // 执行 worker 中的 renderPages，开启渲染任务
    pdfWorker
      .execute("renderPages", [], pageSizeMap, pageNums)
      .addEventListener("message", (res) => {
        if (currentRenderId !== renderIdRef.current) return;
        const {
          data: [pageNum, isDone, imageBitmap],
        } = res;
        if (isDone) {
          const pageIndex = pageNum - 1;
          const canvasContainerEl = canvasContainerElsRef.current[pageIndex];
          const canvasEl = canvasMap.get(pageNum);
          if (!canvasEl || !canvasContainerEl) return;

          canvasEl.getContext("2d")?.drawImage(imageBitmap!, 0, 0);

          // 除非是第一次渲染，否则需要确保旧的 canvasEl 已经被移除后，再注册新的 canvasEl
          if (!canvasContainerEl.children.length) {
            // 向 canvasElsRef 中注册当前的 canvasEl
            canvasElsRef.current[pageNum - 1] = canvasEl;
          } else {
            const observer = new MutationObserver((mutationsList) => {
              for (const mutation of mutationsList) {
                mutation.removedNodes.forEach((node) => {
                  if (node === canvasElsRef.current[pageNum - 1]) {
                    // 向 canvasElsRef 中注册当前的 canvasEl
                    canvasElsRef.current[pageNum - 1] = canvasEl;
                  }
                });
                observer.disconnect();
              }
            });
            observer.observe(canvasContainerEl, { childList: true });
          }

          // 更新 DOM
          canvasContainerEl.replaceChildren(canvasEl);

          // console.log(
          //   "main 1 =========== 第 " +
          //     pageNum +
          //     " 页渲染完成" +
          //     (currentRenderId !== renderIdRef.current ? " ---已过期" : ""),
          //   canvasEl
          // );
          // console.log("第 " + pageNum + " 页渲染完成", canvasEl);
          // 改变 renderListRef 中的状态
          renderListRef.current.set(pageNum, 1);
        } else {
          renderListRef.current.set(pageNum, -1);
          // console.log(
          //   "main -1 =========== 第 " +
          //     pageNum +
          //     " 页取消渲染" +
          //     (currentRenderId !== renderIdRef.current ? " ---已过期" : "")
          // );
          // console.log("第 " + pageNum + " 页取消渲染", canvasMap.get(pageNum));
        }
      })
      .promise.then(() => {
        if (currentRenderId !== renderIdRef.current) return;
        // console.log("所有 page 渲染完成", renderListRef.current);
      })
      .catch(() => {});
  }

  useEffect(() => {
    enablererenderOnScrollRef.current = false;
  }, [viewScale]);

  useEffect(() => {
    if (!pages.length) return;
    pdfReaderEmitter.emit("enableRerenderOnScroll");
    // console.log("enableRerenderOnScroll");
    // console.log("开启新的渲染");
    const pagesInView = getPagesInView();
    // 这次要渲染的页注册其状态
    pagesInView.forEach((pageNum) => {
      renderListRef.current.set(pageNum, 0);
    });
    renderIdRef.current++;
    render([...pagesInView]);
    // console.log("渲染了： ", pagesInView);
    return () => {
      renderListRef.current = new Map();
    };
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
    canvasElsRef.current.forEach((canvasEl) => {
      canvasEl?.style.setProperty(
        "transform",
        `scale(${actualViewScale / +canvasEl.dataset.scale!})`
      );
    });
    // 这里是 newCanvasElsRef 的唯一作用，将还没放入到 DOM 中的 canvas 也同步进行缩放，这样当加入到 DOM 中的那一刻缩放就已经是正确的
    newCanvasElsRef.current.forEach((canvasEl) => {
      canvasEl?.style.setProperty(
        "transform",
        `scale(${actualViewScale / +canvasEl.dataset.scale!})`
      );
    });
    // viewScale 作为依赖是由于更改 viewScale 时，函数节流会使得当前 viewScale 与 canvas 的渲染 scale 不匹配，直到新的 canvas 被创建
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewScale]);

  //#endregion

  //#region - dom 事件监听

  const updateCurrentPageNum = throttle(
    usePdfReaderStore((s) => s.updateCurrentPageNum),
    100
  );
  const updateScroll = debounce(
    usePdfReaderStore((s) => s.updateScroll),
    200
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

  // const commitScaleImmediately = () => {
  //   setTimeout(() => {
  //     commitScale();
  //   });
  // };

  const offsetCurrentPageNum = usePdfReaderStore((s) => s.offsetCurrentPageNum);

  const rerenderOnScroll = throttle(() => {
    // 这次要渲染的页
    const pagesInView = getPagesInView();

    // 还没渲染完成的任务就丢弃掉
    pdfWorker.execute("cancelRenders");
    // 之前被丢弃掉的不删除，这次一起重新渲染；已经渲染完成了的就不用再渲染了，删除掉
    renderListRef.current.forEach((state, pageNum) => {
      if (state === 0) {
        renderListRef.current.set(pageNum, -1);
      } else if (state === 1) {
        pagesInView.delete(pageNum);
      }
    });

    // 这次要渲染的页注册其状态
    pagesInView.forEach((pageNum) => {
      renderListRef.current.set(pageNum, 0);
    });
    render([...pagesInView]);
  }, 500);

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

    // elc.add(documentContainer, "keyup", (e) => {
    //   if (e.key === "Control") {
    //     commitScaleImmediately();
    //   }
    // });

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
        className +
        " " +
        "relative size-full overflow-auto bg-bg-3 box-border focus:outline-none "
      }
      style={styleProp}
      tabIndex={0}
      onScroll={(e) => {
        updateCurrentPageNum();
        // 由于 rerenderOnScroll 使用了 throttle 并开启了 trailing，因此这个判断条件要放在 rerenderOnScroll 外部，否则内部的函数读取到的这个条件不是实时的
        if (enablererenderOnScrollRef.current) rerenderOnScroll();
        if (enableRecordScrollRef.current) updateScroll(e);
      }}
      ref={documentContainerRef}
    >
      {pageViews}
    </div>
  );
});
