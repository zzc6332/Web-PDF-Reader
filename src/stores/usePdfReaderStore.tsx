import {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
} from "pdfjs-dist";
import { create } from "zustand";
import { EventEmitter } from "events";
import { persist, createJSONStorage } from "zustand/middleware";
import { pdfWorker, WorkerProxy } from "src/workers/pdf.main";

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

const domState = {
  documentContainer: null as HTMLDivElement | null,
};

const loadingState = {
  pages: [] as {
    width: number;
    height: number;
    proxy: WorkerProxy<PDFPageProxy>;
  }[],
  // pdfSrc: "http://192.168.6.2:5173/statics/0.pdf" as null | string | Blob,
  isPdfActive: false,
  isLoading: false,
  pdfCacheId: null as null | number,
  // 这里的 thumbWidth 和 thumbHeight 并不是侧边栏中的缩略图，而是历史记录中的封面缩略图
  thumbSize: {
    width: 140,
    height: 198,
  },
};

const scaleState = {
  scale: 1,
  viewScale: 1,
  scaleMappingRatio: 4 / 3,
  viewScaleRange: [0.25, 3],
  // 定义最小的渲染 scale（对于 pdfjs 而言），避免页面过于缩小后突然放大导致画 面过于模糊
  minRenderScale: (0.8 * 4) / 3,
  // 定义最大的渲染 scale （对于 pdfjs 而言），避免渲染图像过大导致卡顿
  maxRenderScale: (3 * 4) / 3,
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

const displayState = {
  isThumbsVisible: true,
  showHistory: true,
  historySelectMode: false,
  checkAll: 0 as 0 | 1 | -1, // 0 代表全不选，1 代表全选，-1 代表非全选
};

//#endregion

//#region - 定义 state、 actions 和 EventEmitter 类型

//#region - 定义 EventEmitter 和 state 类型

interface EventHandlers {
  cancelRender: [];
  setViewScale: [
    number,
    number,
    number | null | undefined,
    number | null | undefined
  ];
  enableRerenderOnScroll: [];
  onLoadingSucsess: [];
  onLoadingError: [];
  deleteCache: [];
}

type Emitter = {
  emitter: EventEmitter<EventHandlers>;
};

type DomState = typeof domState;
type LoadingState = typeof loadingState;
type ScaleState = typeof scaleState;
type PageNumState = typeof pageNumState;
type LayoutState = typeof layoutState;
type DisplayState = typeof displayState;

//#endregion

//#region - 定义 actions 类型

type ResetStateActions = {
  resetDomState: () => void;
  resetLoadingState: () => void;
  resetScaleState: () => void;
  resetPageNumState: () => void;
  resetLayoutState: () => void;
};

type InitialActions = {
  specifyDocumentContainer: (documentContainer: HTMLDivElement | null) => void;
};

type loadingActions = {
  setPdfSrc: (pdfSrc: null | string | File | number) => void; // 如果 pdfSrc 是 number 类型的话那么它就是 pdfCacheId
  setIsLoading: (isLoading: boolean) => void;
  loadWorkerProxies: (src: string | File | number) => Promise<void>;
};

type ScaleActions = {
  setScale: (scale: number) => void;
  setViewScale: (
    viewScale: number,
    scaleOriginLeft?: number | null,
    scaleOriginTop?: number | null
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
  commitScale: (scale?: number) => void;
  getActualScale: () => number;
  getFinalScale: () => number;
  getActualViewScale: () => number;
  getSafeScaleValue: (n: number) => number;
};

type DisplayActions = {
  setIsThumbsVisible: (isThumbsVisible: boolean) => void;
  setShowHistory: (showHistory: boolean) => void;
  setHistorySelectMode: (historySelectMode: boolean) => void;
  setCheckAll: (checkAll: 0 | 1 | -1) => void;
};

interface PageNumOptions {
  force?: boolean;
}

type PageNumActions = {
  getDistanceByPageNum: (pageNum: number, options?: PageNumOptions) => number;
  handlePageNumChange: (num: number, options?: PageNumOptions) => void;
  setCurrentPageNum: (num: number, options?: PageNumOptions) => void;
  offsetCurrentPageNum: (num: number, options?: PageNumOptions) => void;
  updateCurrentPageNum: () => void;
  getPageNumAndPageOffsetByDistance: (
    docScrollY: number,
    actualViewScale: number
  ) => {
    pageNum: number;
    pageOffset: number;
  };
  getPagesInView: () => Set<number>;
};

type LayoutActions = {
  updateScroll: (e: React.UIEvent<HTMLDivElement, UIEvent>) => void;
  getScaleToFitClient: (isWidth: boolean) => number | undefined;
};

//#endregion

//#endregion

//#region - 创建 store

const usePdfReaderStore = create<
  Emitter &
    ResetStateActions &
    DomState &
    LoadingState &
    loadingActions &
    InitialActions &
    ScaleState &
    ScaleActions &
    PageNumState &
    PageNumActions &
    LayoutState &
    LayoutActions &
    DisplayState &
    DisplayActions
>()(
  persist(
    (set, get) => ({
      emitter: new EventEmitter<EventHandlers>(),
      ...domState,
      ...loadingState,
      ...scaleState,
      ...pageNumState,
      ...layoutState,
      ...displayState,

      //#region - 定义 actions

      //#region - resetStateActions
      resetDomState: () => {
        set(domState);
      },
      resetLoadingState: () => {
        set(loadingState);
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

      //#region - loadingActions

      // specifyDocumentContainer 用于指定 documentContainer 的 DOM 元素
      specifyDocumentContainer: (documentContainer) => {
        set({ documentContainer });
      },

      setPdfSrc: (pdfSrc) => {
        if (pdfSrc || pdfSrc === 0) {
          get().loadWorkerProxies(pdfSrc);
        } else {
          set({ isPdfActive: false, pdfCacheId: null });
        }
      },

      setIsLoading: (isLoading) => {
        set({ isLoading });
      },

      loadWorkerProxies: async (src) => {
        const { emitter } = get();
        const { thumbSize } = get();
        try {
          const { data: pdfCacheId } = await pdfWorker
            .execute("load", [], src, thumbSize)
            .addEventListener("message", async (res) => {
              const data = res.data;
              const pagesWP = await data.pdfPageProxies;
              // 将一些状态同步到主线程中
              const pages = [];
              for await (const pageWP of pagesWP) {
                const viewPort = await pageWP.getViewport({
                  scale: 1,
                });
                const page = {
                  width: await viewPort.width,
                  height: await viewPort.height,
                  proxy: pageWP,
                };
                pages.push(page);
              }
              set({ pages, isPdfActive: true });
              emitter.emit("onLoadingSucsess");
            }).promise;
          set({ pdfCacheId });
        } catch (error) {
          console.error(error);
          emitter.emit("onLoadingError");
        }
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

      // getNewScroll 会在 ResizeObserver 的回调中被调用，监视的元素为 documentContainer 内部的子元素，用于得到缩放后如果要保持原本画面位置，新的 scroll 应该设置的数值
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

      /**
       * commitSCale 将当前的 viewScale 或指定值提交给 scale
       * @param scale 如果提供了 scale，那么就会用其代替当前 viewScale 作为渲染 scale
       * @returns
       */
      commitScale: (scale) => {
        pdfWorker.execute("cancelRenders");
        get().emitter.emit("enableRerenderOnScroll");
        const newScale = scale || get().viewScale;
        if (newScale === get().scale) {
          return;
        }
        get().setScale(newScale);
      },

      // 获取转换后的用于 PdfJS 内部的 scale
      getActualScale: () => get().mapScale(get().scale),
      getActualViewScale: () => get().mapScale(get().viewScale),
      // 获取最终传给 PdfJs 内部的 scale
      getFinalScale: () =>
        Math.min(
          Math.max(get().getActualScale(), get().minRenderScale),
          get().maxRenderScale
        ),

      // 将接收的值限定到合法的 scale 值的范围中
      getSafeScaleValue: (n) =>
        Math.max(Math.min(n, get().viewScaleRange[1]), get().viewScaleRange[0]),

      //#endregion

      //#region - pageNumActions

      /**
       * getDistanceByPageNum 用于查询指定页码距离文档顶部的距离
       * @param pageNum 要查询的页码
       */
      getDistanceByPageNum: (pageNum) => {
        const pages = get().pages;
        let distance = 0;
        for (let i = 1; i <= pageNum; i++) {
          if (i >= 2) {
            distance += Math.floor(
              pages[i - 2].height * get().getActualViewScale() +
                parseSize(get().padding)
            );
          }
        }
        return distance;
      },

      /**
       * handlePageNumChange 用于切换当前页码，并控制 documentContainer 的滚动条跳转
       * @param num 要切换的页码数
       * @param options 可选配置项
       * - force：如果为 true，则无论当前页码是多少，都强制跳转（重置滚动条）；否则只有当前页码与 num 不同时才会跳转；默认为 false
       * @returns
       */
      handlePageNumChange: (num, options) => {
        const force = options?.force;
        const documentContainer = get().documentContainer;
        if (!documentContainer) return;
        const targetPageNum = Math.min(num, get().pages.length);
        if (targetPageNum === get().currentPageNum && !force) return;
        documentContainer.scrollTop = get().getDistanceByPageNum(targetPageNum);
      },
      /**
       * setCurrentPageNum 用于设置当前页码，并且会将输入值转换为合法的页码数，将其传递给 handlePageNumChange 调用
       * @param num
       * @param options
       * @returns
       */
      setCurrentPageNum: (num, options) => {
        set({ isHandlingPageNumChange: true });
        let newNum = Math.abs(Math.round(num));
        if (newNum < 1) newNum = 1;
        const pageCount = get().pages.length;
        if (!pageCount) return;
        if (pageCount && newNum > pageCount) newNum = pageCount;
        get().handlePageNumChange(newNum, options);
        set({ currentPageNum: newNum });
        set({ currentTopPageNum: newNum });
      },
      /**
       * offsetCurrentPageNum 用于偏移当前的页码
       * @param num 可以是正负数或 0，如果是 0，则默认会重置当前滚动条到当且页的初始状态
       * @param options
       * @returns
       */
      offsetCurrentPageNum: (num, options) => {
        if (num === 0) {
          const _options = { ...options };
          // 如果 options.force 没有被指定，则将其指定为 true，强制执行页面跳转
          _options.force = options?.force === false ? false : true;
          get().handlePageNumChange(get().currentPageNum, _options);
          return;
        }
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
        // 获取当前窗口顶部的页码和其自身顶部的偏移
        const {
          pageNum: currentTopPageNum,
          pageOffset: currentTopPageScrollY,
        } = get().getPageNumAndPageOffsetByDistance(
          currentDocScrollY,
          get().getActualViewScale()
        );

        // currentPageNumForDisplay 页数指示器上显示的当前页码，用于展示，先将其赋值为基准页码，根据之后的计算判断要不要做修改，最终会同步到 state 中的 currentPageNum
        let currentPageNumForDisplay = currentTopPageNum;
        // 如果还有下一页，则根据当前页和下一页在当前视图中的大小比较来决定展示页码与基准页码的关系
        if (pages[currentTopPageNum] && pages[currentTopPageNum - 1]) {
          const page = pages[currentTopPageNum - 1];
          const nextPage = pages[currentTopPageNum];
          const pageHeight = Math.floor(
            page.height * get().getActualViewScale()
          );
          const nextPageHeight = Math.floor(
            nextPage.height * get().getActualViewScale()
          );
          // currentPageHeightInView 和 nextPageHeightInView 表示页在视图中显示的高度
          const currentPageHeightInView = pageHeight - currentTopPageScrollY;
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
       * @param actualViewScale 视觉缩放系数
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
          const pageHeight = Math.floor(page.height * actualViewScale);
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

      /**
       * 获取当前正在视口中的页面的页码（再额外加入上下各一页）
       * @returns numbers[]
       */
      getPagesInView: () => {
        const pagesInView = new Set<number>();

        const pages = get().pages;
        const el = get().documentContainer;
        if (!el) return pagesInView;
        // currentDocScrollY 当前整个文档的 Y 方向偏移量
        const currentDocScrollY = el.scrollTop;
        // clientHeight 容器的窗口高度
        const { clientHeight } = el;
        // 获取当前窗口顶部的页码和其自身顶部的偏移
        const {
          pageNum: currentTopPageNum,
          pageOffset: currentTopPageScrollY,
        } = get().getPageNumAndPageOffsetByDistance(
          currentDocScrollY,
          get().getActualViewScale()
        );

        // tmpHeight 用于存储临时计算的高度总和，用以比较计算当前 pagesInView 中的页码是否超出了视口高度
        let tmpHeight = -currentTopPageScrollY;

        const padding = parseSize(get().padding);

        // 将在视图中的页面的索引追加到 pagesInView 中
        if (currentTopPageNum >= 2) pagesInView.add(currentTopPageNum - 1); // 额外加入上面的一页
        for (let i = currentTopPageNum - 1; i < pages.length; i++) {
          pagesInView.add(i + 1);

          // 如果 tmpHeight 超出视口高度了，那么循环终止
          const pageHeight = pages[i].height * get().getActualViewScale();
          tmpHeight += pageHeight + padding;
          if (tmpHeight >= clientHeight) {
            if (i + 2 <= pages.length) pagesInView.add(i + 2); // 额外加入下面的一页
            break;
          }
        }

        return pagesInView;
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

      getScaleToFitClient: (isWidth) => {
        const documentContainer = get().documentContainer;
        if (!documentContainer) return;
        // 获取当前 page 的原始尺寸
        const { width, height } = get().pages[get().currentPageNum - 1];
        const originalSize = isWidth ? width : height;
        // 计算出当前 page 相对于应用中 100% 时的尺寸
        const standardSize = originalSize * get().scaleMappingRatio;
        // 获取当前视口的尺寸 - 这里使用了 clientWidth 和 offsetHeight，因为较多场景下适应宽度后存在竖向滚动条，适应高度后不存在横向滚动条
        const clientSize = isWidth
          ? documentContainer.clientWidth
          : documentContainer.offsetHeight;
        // 计算填满当前视口尺寸需要的 scale
        return clientSize / (standardSize + parseSize(get().padding) * 2);
      },

      //#endregion

      //#region - displayActions

      setIsThumbsVisible: (isThumbsVisible) => {
        set({ isThumbsVisible });
      },

      setShowHistory: (showHistory) => {
        set({ showHistory, historySelectMode: false });
      },

      setHistorySelectMode: (historySelectMode) => {
        set({ historySelectMode });
      },

      setCheckAll: (checkAll) => {
        set({ checkAll });
      },

      //#endregion

      //#endregion
    }),
    {
      name: "pdf-state",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => {
        const {
          scale,
          viewScale,
          scrollX,
          scrollY,
          isThumbsVisible,
          isPdfActive,
          pdfCacheId,
          showHistory,
        } = state;
        return {
          scale,
          viewScale,
          scrollX,
          scrollY,
          isThumbsVisible,
          isPdfActive,
          pdfCacheId,
          showHistory,
        };
      },
    }
  )
);

//#endregion

export default usePdfReaderStore;
