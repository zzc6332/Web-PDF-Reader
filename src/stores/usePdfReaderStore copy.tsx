import {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
} from "pdfjs-dist";
import { create } from "zustand";
import usePdfLoading from "../hooks/pdfReaderHooks/usePdfLoading";
import { useEffect } from "react";

import { EventEmitter } from "events";

import {
  subscribeWithSelector,
  persist,
  createJSONStorage,
} from "zustand/middleware";

interface EventHandlers {
  cancelRender: (() => void)[];
}

interface PdfReaderState {
  emitter: EventEmitter<EventHandlers>;

  documentContainer: HTMLDivElement | null;
  useDocumentContainer: (documentContainer: HTMLDivElement | null) => void;

  pdfPath: string;
  setPdfPath: (pdfPath: string) => void;

  useLoading: () => void;
  pdfDocument: PDFDocumentProxy | null;
  pages: PDFPageProxy[];
  loadingTask: PDFDocumentLoadingTask | null;

  currentPageNum: number;
  isHandlingPageNum: boolean;
  setCurrentPageNum: (num: number) => void;
  offsetCurrentPageNum: (num: number) => void;
  handlePageNumChange: (num: number) => void;

  scale: number;
  initialScale: number;
  setScale: (scale: number) => void;
  resetScale: () => void;
  mapScale: (scaleInApp: number) => number;

  viewScale: number;
  setViewScale: (viewScale: number) => void;
  commitScale: () => void;

  isRendering: boolean;
  setIsRendering: (bool: boolean) => void;

  padding: string;
  setPadding: (padding: string) => void;

  handleScroll: (e: React.UIEvent<HTMLDivElement, UIEvent>) => void;
}

const usePdfReaderStore = create<PdfReaderState>()(
  persist(
    subscribeWithSelector((set, get) => {
      //#region - 静态参数和工具函数

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
      return {
        emitter: new EventEmitter<EventHandlers>(),

        documentContainer: null,
        // ***** specifyDocumentContainer
        useDocumentContainer: (documentContainer) => {
          useEffect(() => {
            set({ documentContainer });
            return () => {
              set({ documentContainer: null });
            };
          }, [documentContainer]);
        },

        pdfPath: "http://192.168.6.2:8080/2",
        setPdfPath: (pdfPath) => {
          set({ pdfPath });
        },

        // 加载文档，获取 pages，pdfDocument，loadingtask
        useLoading: () => {
          const [pages, pdfDocument, loadingTask] = usePdfLoading(
            get().pdfPath
          );
          useEffect(() => {
            set({ pages });
            return () => {
              set({ pages: [] });
            };
          }, [pages]);
          useEffect(() => {
            set({ pdfDocument });
            return () => {
              set({ pdfDocument: null });
            };
          }, [pdfDocument]);
          useEffect(() => {
            set({ loadingTask });
            return () => {
              set({ loadingTask: null });
            };
          }, [loadingTask]);
        },
        pages: [],
        pdfDocument: null,
        loadingTask: null,

        // 展示页码
        currentPageNum: 0,
        isHandlingPageNum: false,
        setCurrentPageNum: (num) => {
          get().isHandlingPageNum = true;
          let newNum = Math.abs(Math.round(num));
          if (newNum < 1) newNum = 1;
          const pageCount = get().pdfDocument?.numPages;
          if (!pageCount) return;
          if (pageCount && newNum > pageCount) newNum = pageCount;
          get().handlePageNumChange(newNum);
          set({ currentPageNum: newNum });
        },
        offsetCurrentPageNum: (num) => {
          const newNum = get().currentPageNum + Math.round(num);
          get().setCurrentPageNum(newNum);
        },
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
                    scale: get().mapScale(get().viewScale),
                  }).height
                ) + parseSize(get().padding);
            } else {
              docScrollY = 0;
            }
          }
          documentContainer.scrollTop = docScrollY;
        },

        // pdf 视图缩放比，用于渲染
        initialScale: 1,
        scale: 1,
        setScale: (scale) => {
          set({ scale });
        },
        resetScale: () => {
          set({ scale: get().initialScale });
        },
        /**
         * 使用 mapScale 将应用程序中定义的 scale 转换为 PdfJS 中的 scale
         * @param scaleInApp 应用程序中定义的 scale
         * @returns PdfJs 中的 scale
         */
        mapScale: (scaleInApp: number) => (scaleInApp * 4) / 3,

        // 视觉缩放比，作用于页面上展示的视图，确定需要渲染后会同步给 scale
        viewScale: 1,
        setViewScale: (viewScale) => {
          // 修改 viewScale 时需要更新一下视口的 scrollY 和 scrollX
          const documentContainer = get().documentContainer;
          if (!documentContainer) return;
          const { offsetHeight, offsetWidth } = documentContainer;
          const preViewScale = get().viewScale;
          const docScrollY = documentContainer.scrollTop;
          const docScrollX = documentContainer.scrollLeft;
          const centerScrollY = docScrollY + offsetHeight / 2;
          const centerScrollX = docScrollX + offsetWidth / 2;
          const newCenterScrollY = (centerScrollY * viewScale) / preViewScale;
          const newCenterScrollX = (centerScrollX * viewScale) / preViewScale;
          const newDocScrollY = newCenterScrollY - offsetHeight / 2;
          const newDocScrollX = newCenterScrollX - offsetHeight / 2;
          documentContainer.scrollTop = newDocScrollY;
          documentContainer.scrollLeft = newDocScrollX;

          // 设置 viewScale
          set({ viewScale });
        },
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

        // 当前是否正在渲染页面中
        isRendering: false,
        setIsRendering: (bool) => {
          // console.log("isRendering 设置为 " + bool);
          // get().isRendering = bool;
          set({ isRendering: bool });
        },

        // 每一页之间的间距
        padding: "0.5rem",
        setPadding: (padding) => {
          set({ padding });
        },

        // 当滚动页面时，检测是否需要更新展示页码
        handleScroll: (e) => {
          // 如果是调用了 setCurrentPageNum 而触发的 handleScroll，则不需要再更新展示页码
          if (get().isHandlingPageNum) {
            get().isHandlingPageNum = false;
            return;
          }

          const pages = get().pages;
          const el = e.target as HTMLDivElement;
          // currentDocScrollY 当前整个文档的 Y 方向偏移量
          const currentDocScrollY = el.scrollTop;
          // clientHeight 容器的窗口高度
          const { clientHeight } = el;

          // currentPageScrollY 当前页的 Y 方向偏移量，使用当前文档的 Y 方向偏移减去每页的 height 和 padding 得出
          let currentPageScrollY = currentDocScrollY;
          // currentTopPageNum 当前视图上最顶部的页码，是参与逻辑计算的基准页码
          let currentTopPageNum = 0;
          // 计算出当前 currentPageScrollY 和 currentTopPageNum 的值
          const padding = parseSize(get().padding);
          for (let i = 1; i <= pages.length; i++) {
            const page = pages[i - 1];
            const pageHeight = Math.floor(
              page.getViewport({ scale: get().mapScale(get().viewScale) })
                .height
            );
            if (currentPageScrollY >= pageHeight + padding) {
              currentPageScrollY -= pageHeight + padding;
            } else {
              currentTopPageNum = i;
              break;
            }
            if (currentTopPageNum === 0) currentTopPageNum = pages.length;
          }

          // currentPageNumForDisplay 页数指示器上显示的当前页码，用于展示，最终会同步到 state 中的 currentPageNum
          let currentPageNumForDisplay = currentTopPageNum;
          // 如果还有下一页，则根据当前页和下一页在当前视图中的大小比较来决定展示页码与基准页码的关系
          if (pages[currentTopPageNum] && pages[currentTopPageNum - 1]) {
            const page = pages[currentTopPageNum - 1];
            // console.log("currentTopPageNum: ", currentTopPageNum);
            const nextPage = pages[currentTopPageNum];
            const pageHeight = Math.floor(
              page.getViewport({ scale: get().mapScale(get().viewScale) })
                .height
            );
            const nextPageHeight = Math.floor(
              nextPage.getViewport({ scale: get().mapScale(get().viewScale) })
                .height
            );
            // currentPageHeightInView 和 nextPageHeightInView 表示页在视图中显示的高度
            const currentPageHeightInView = pageHeight - currentPageScrollY;
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
        },
      };
    }),
    {
      name: "pdf-storage",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ scale: state.scale }),
    }
  )
);

export default usePdfReaderStore;
