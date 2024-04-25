import {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
} from "pdfjs-dist";
import { create } from "zustand";
import usePdfLoading from "../hooks/pdfReaderHooks/usePdfLoading";
import { useEffect } from "react";

import { EventEmitter } from "events";

import { persist, createJSONStorage } from "zustand/middleware";

//#region - 工具函数

// 将 px 和 rem 单位的尺寸字符串解析为 px 数值
function parseSize(size: string) {
  const isRem = size.match(/^(\d+(?:\.\d+)?)rem$/)?.[1];
  const isPx = size.match(/^(\d+(?:\.\d+)?)px$/)?.[1];
  if (isRem) {
    const rootFontSize = parseInt(
      getComputedStyle(document.documentElement).fontSize
    );
    return Number(isRem) * rootFontSize;
  }
  if (isPx) return Number(isPx);
  return 0;
}

//#endregion

//#region - 定义初始 state

const initialState = {
  documentContainer: null as HTMLDivElement | null,
};

const renderState = {
  pdfDocument: null as PDFDocumentProxy | null,
  pages: [] as PDFPageProxy[],
  loadingTask: null as PDFDocumentLoadingTask | null,
  isRendering: false,
  pdfPath: "http://192.168.6.2:8080/2", // ***** 临时
};

const scaleState = {
  scale: 1,
  viewScale: 1,
  scaleMappingRatio: 4 / 3,
  viewScaleRange: [0.25, 4],
};

const pageNumState = {
  currentPageNum: 0,
  currentTopPageNum: 0,
  isHandlingPageNumChange: false,
};

const layoutState = {
  padding: "0.5rem",
  // 这里的 scrollX、scrollY 仅用于持久化存储，使得刷新后读取之前的位置，其它需要用到 scrollX、scrollY 的地方要实时获取
  scrollX: 0,
  scrollY: 0,
};

//#endregion

//#region - 定义 state、 actions 和 EventEmitter 类型

interface EventHandlers {
  cancelRender: [];
  setViewScale: [number, number, number | undefined, number | undefined];
}

type Emitter = {
  emitter: EventEmitter<EventHandlers>;
};

type InitialState = typeof initialState;
type RenderState = typeof renderState;
type ScaleState = typeof scaleState;
type PageNumState = typeof pageNumState;
type LayoutState = typeof layoutState;

type ResetStateActions = {
  resetInitialState: () => void;
  resetRenderState: () => void;
  resetScaleState: () => void;
  resetPageNumState: () => void;
  resetLayoutState: () => void;
};

type RenderActions = {
  specifyDocumentContainer: (documentContainer: HTMLDivElement | null) => void;
  useLoading: () => void;
  setIsRendering: (bool: boolean) => void;
};

type ScaleActions = {
  setScale: (scale: number) => void;
  setViewScale: (
    viewScale: number,
    scaleOriginLeft?: number,
    scaleOriginTop?: number
  ) => void;
  getNewScroll: (
    preViewScale: number,
    preScrollWidth: number,
    preScrollHeight: number,
    preScrollLeft: number,
    preScrollTop: number,
    newScrollWidth: number,
    newScrollHeight: number,
    scrollOriginLeft: number,
    scrollOriginTop: number,
    clientWidth: number,
    clientHeigh: number
  ) => {
    newScrollTop: number;
    newScrollLeft: number;
  };
  mapScale: (scaleInApp: number) => number;
  commitScale: () => void;
  getActualScale: () => number;
  getActualViewScale: () => number;
  getSafeScaleValue: (n: number) => number;
};

type PageNumActions = {
  handlePageNumChange: (num: number) => void;
  setCurrentPageNum: (num: number) => void;
  offsetCurrentPageNum: (num: number) => void;
  updateCurrentPageNum: () => void;
  getPageNumAndPageOffsetByDistance: (
    docScrollY: number,
    actualViewScalr: number
  ) => {
    pageNum: number;
    pageOffset: number;
  };
};

type LayoutActions = {
  updateScroll: (e: React.UIEvent<HTMLDivElement, UIEvent>) => void;
};

//#endregion

//#region - 创建 store

const usePdfReaderStore = create<
  Emitter &
    InitialState &
    RenderState &
    ScaleState &
    PageNumState &
    LayoutState &
    ResetStateActions &
    RenderActions &
    ScaleActions &
    PageNumActions &
    LayoutActions
>()(
  persist(
    (set, get) => ({
      emitter: new EventEmitter<EventHandlers>(),
      ...initialState,
      ...renderState,
      ...scaleState,
      ...pageNumState,
      ...layoutState,
      //#region - 定义 actions

      //#region - resetStateActions
      resetInitialState: () => {
        set(initialState);
      },
      resetRenderState: () => {
        set(renderState);
      },
      resetScaleState: () => {
        set(pageNumState);
      },
      resetPageNumState: () => {
        set(pageNumState);
      },
      resetLayoutState: () => {
        set(pageNumState);
      },
      //#endregion

      //#region - initialActions

      // specifyDocumentContainer 用于指定 documentContainer 的 DOM 元素
      specifyDocumentContainer: (documentContainer) => {
        set({ documentContainer });
      },

      //#endregion

      //#region - renderActions

      // useLoading 用于获取 pages，pdfDocument，loadingTask
      useLoading: () => {
        const [loadingTask, pdfDocument, pages] = usePdfLoading(get().pdfPath);
        set({ loadingTask });
        useEffect(() => {
          if (pdfDocument) set({ pdfDocument });
        }, [pdfDocument]);
        useEffect(() => {
          set({ pages });
        }, [pages]);
      },

      setIsRendering: (bool) => {
        set({ isRendering: bool });
      },

      //#endregion

      //#region - scaleActions

      setScale: (scale) => {
        set({ scale });
      },

      setViewScale: (newViewScale, scaleOriginLeft, scaleOriginTop) => {
        set({ viewScale: newViewScale });
        const { documentContainer } = get();
        if (!documentContainer) return;
        const { scrollLeft, scrollTop } = documentContainer;
        get().emitter.emit(
          "setViewScale",
          scrollLeft,
          scrollTop,
          scaleOriginLeft,
          scaleOriginTop
        );
      },

      // getNewScroll 会在 ResizeObserver 的回调中被调用，监视的元素为 documentContainer 内部的子元素
      getNewScroll: (
        preViewScale,
        preScrollWidth,
        preScrollHeight,
        preScrollLeft,
        preScrollTop,
        newScrollWidth,
        newScrollHeight,
        scrollOriginLeft,
        scrollOriginTop,
        clientWidth,
        clientHeight
      ) => {
        // 修改 viewScale 时获取视口的新的 scroll
        const newViewScale = get().viewScale;

        // 判断 documentContainer 中的内容是否有溢出（出现滚动条）
        const isHeightOverflow = newScrollHeight > clientHeight;
        const wasHeightOverflow = preScrollHeight > clientHeight;
        const isWidthOverflow = newScrollWidth > clientWidth;
        const wasWidthOverflow = preScrollWidth > clientWidth;

        const padding = parseSize(get().padding);

        let newScrollTop: number;

        if (!isHeightOverflow) {
          // 如果缩放后高度没有溢出，即 newScrollY 为 0
          newScrollTop = 0;
          // 之后都是缩放后高度溢出的情况
        } else if (wasHeightOverflow) {
          // 如果缩放前高度已经溢出
          const preCenterDistanceY = preScrollTop + scrollOriginTop;
          const centerPageNum = get().getPageNumAndPageOffsetByDistance(
            preCenterDistanceY,
            get().mapScale(preViewScale)
          ).pageNum;
          const paddingSum = padding * centerPageNum;
          const newCenterDistanceY =
            ((preCenterDistanceY - paddingSum) * newViewScale) / preViewScale +
            paddingSum;
          newScrollTop = newCenterDistanceY - scrollOriginTop;
        } else {
          // 如果缩放前高度没有溢出
          newScrollTop = newScrollHeight / 2 - scrollOriginTop;
        }

        let newScrollLeft: number;

        if (!isWidthOverflow) {
          // 如果缩放后宽度没有溢出，即 newScrollLeft 为 0
          newScrollLeft = 0;
          // 之后都是缩放后宽度溢出的情况
        } else if (wasWidthOverflow) {
          // 如果缩放前宽度已经溢出
          const preCenterDistanceX = preScrollLeft + scrollOriginLeft;
          const newCenterDistanceX =
            ((preCenterDistanceX - padding) * newViewScale) / preViewScale +
            padding;
          newScrollLeft = newCenterDistanceX - scrollOriginLeft;
        } else {
          // 如果缩放前宽度没有溢出
          newScrollLeft = newScrollWidth / 2 - scrollOriginLeft;
        }

        return {
          newScrollTop: Math.round(newScrollTop),
          newScrollLeft: Math.round(newScrollLeft),
        };
      },

      mapScale: (scaleInApp: number) => scaleInApp * get().scaleMappingRatio,

      // commitSCale 将当前的 viewScale 提交给 scale
      commitScale: () => {
        if (get().scale === get().viewScale) {
          return;
        } else if (get().isRendering) {
          get().emitter.emit("cancelRender");
          get().setIsRendering(false);
          setTimeout(() => {
            get().commitScale();
          });
          return;
        }
        get().setScale(get().viewScale);
        get().setIsRendering(true);
      },

      // 获取转换后的用于 PdfJS 内部的 scale
      getActualScale: () => get().mapScale(get().scale),
      getActualViewScale: () => get().mapScale(get().viewScale),

      // 将接收的值限定到合法的 scale 值的范围中
      getSafeScaleValue: (n) =>
        Math.max(Math.min(n, get().viewScaleRange[1]), get().viewScaleRange[0]),

      //#endregion

      //#region - pageNumActions

      handlePageNumChange: (num) => {
        const pdfDocument = get().pdfDocument;
        const documentContainer = get().documentContainer;
        if (!pdfDocument || !documentContainer) return;
        const targetPageNum = Math.min(num, pdfDocument.numPages);
        if (targetPageNum === get().currentPageNum) return;
        const pages = get().pages;
        let docScrollY = 0;
        for (let i = 1; i <= targetPageNum; i++) {
          if (i > 1) {
            docScrollY +=
              Math.floor(
                pages[i - 2].getViewport({
                  scale: get().getActualViewScale(),
                }).height
              ) + parseSize(get().padding);
          } else {
            docScrollY = 0;
          }
        }
        documentContainer.scrollTop = docScrollY;
      },
      setCurrentPageNum: (num) => {
        set({ isHandlingPageNumChange: true });
        let newNum = Math.abs(Math.round(num));
        if (newNum < 1) newNum = 1;
        const pageCount = get().pdfDocument?.numPages;
        if (!pageCount) return;
        if (pageCount && newNum > pageCount) newNum = pageCount;
        get().handlePageNumChange(newNum);
        set({ currentPageNum: newNum });
        set({ currentTopPageNum: newNum });
      },
      offsetCurrentPageNum: (num) => {
        const newNum = get().currentPageNum + Math.round(num);
        get().setCurrentPageNum(newNum);
      },

      // 根据当前的页面滚动同步 pageNum
      updateCurrentPageNum: () => {
        if (get().isHandlingPageNumChange) {
          set({ isHandlingPageNumChange: false });
          return;
        }

        const pages = get().pages;
        const el = get().documentContainer;
        if (!el) return;
        // currentDocScrollY 当前整个文档的 Y 方向偏移量
        const currentDocScrollY = el.scrollTop;
        // clientHeight 容器的窗口高度
        const { clientHeight } = el;

        const { pageNum: currentTopPageNum, pageOffset: currentPageScrollY } =
          get().getPageNumAndPageOffsetByDistance(
            currentDocScrollY,
            get().getActualViewScale()
          );

        // currentPageNumForDisplay 页数指示器上显示的当前页码，用于展示，最终会同步到 state 中的 currentPageNum
        let currentPageNumForDisplay = currentTopPageNum;
        // 如果还有下一页，则根据当前页和下一页在当前视图中的大小比较来决定展示页码与基准页码的关系
        if (pages[currentTopPageNum] && pages[currentTopPageNum - 1]) {
          const page = pages[currentTopPageNum - 1];
          // console.log("currentTopPageNum: ", currentTopPageNum);
          const nextPage = pages[currentTopPageNum];
          const pageHeight = Math.floor(
            page.getViewport({ scale: get().getActualViewScale() }).height
          );
          const nextPageHeight = Math.floor(
            nextPage.getViewport({ scale: get().getActualViewScale() }).height
          );
          // currentPageHeightInView 和 nextPageHeightInView 表示页在视图中显示的高度
          const currentPageHeightInView = pageHeight - currentPageScrollY;
          const padding = parseSize(get().padding);
          const restHeightInView =
            clientHeight - currentPageHeightInView - padding;
          const nextPageHeightInView = Math.min(
            restHeightInView,
            nextPageHeight
          );
          // currentPageHeightPercentage 和 nextPageHeightPercentage 表示页被显示部分的占自身的百分比
          const currentPageHeightPercentage =
            currentPageHeightInView / pageHeight;
          const nextPageHeightPercentage =
            nextPageHeightInView / nextPageHeight;
          if (currentPageHeightPercentage < nextPageHeightPercentage) {
            currentPageNumForDisplay++;
          }
        }
        // 将展示页码同步到状态中
        if (get().currentPageNum !== currentPageNumForDisplay)
          set({ currentPageNum: currentPageNumForDisplay });
        if (get().currentTopPageNum !== currentTopPageNum)
          set({ currentTopPageNum });
      },

      /**
       * getPageNumAndPageOffsetByDistance 可以根据一个相对文档顶部的距离，计算出其对应的页码，以及该距离对应页顶部的偏移距离
       * @param distance 相对文档顶部的距离
       * @returns pageNum 表示对应的页码，pageOffset 表示对应页的偏移距离
       */
      getPageNumAndPageOffsetByDistance: (
        distance: number,
        actualViewScale: number
      ) => {
        // pageOffset 根据 distance 减去每页的 height 和 padding 得出
        let pageOffset = distance;
        // topPageNum 当前视图上最顶部的页码，是参与逻辑计算的基准页码
        let pageNum = 0;
        // 计算出当前 pageOffset 和 currentTopPageNum 的值
        const padding = parseSize(get().padding);
        const pages = get().pages;
        for (let i = 1; i <= pages.length; i++) {
          const page = pages[i - 1];
          const pageHeight = Math.floor(
            page.getViewport({ scale: actualViewScale }).height
          );
          if (pageOffset >= pageHeight + padding) {
            pageOffset -= pageHeight + padding;
          } else {
            pageNum = i;
            break;
          }
          if (pageNum === 0) pageNum = pages.length;
        }
        return { pageNum, pageOffset };
      },
      //#endregion

      //#region - layoutActions

      updateScroll: (e) => {
        const el = e.target as HTMLDivElement;
        set({
          scrollX: el.scrollLeft,
          scrollY: el.scrollTop,
        });
      },

      //#endregion

      //#endregion
    }),
    {
      name: "pdf-state",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => {
        const { scale, scrollX, scrollY } = state;
        return { scale, scrollX, scrollY };
      },
    }
  )
);

//#endregion

export default usePdfReaderStore;
