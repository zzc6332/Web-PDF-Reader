import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import Props from "src/types/props";
import usePdfReaderStore from "src/stores/usePdfReaderStore";
import { pdfWorker } from "src/workers/pdf.main";
import { debounce } from "lodash-es";

interface ThumbnailsContainerProps extends Props {}

const ThumbnailsContainer = memo(
  forwardRef<{ getContainerWidth: () => string }, ThumbnailsContainerProps>(
    function ThumbnailsContainer({ className: classNameProp }, ref) {
      const className = classNameProp || "";

      useImperativeHandle(
        ref,
        () => ({
          getContainerWidth: () =>
            window.getComputedStyle(containerRef.current!).width,
        }),
        []
      );

      const thumbWidth = 160;

      const pages = usePdfReaderStore((s) => s.pages);
      const currentPageNum = usePdfReaderStore((s) => s.currentPageNum);
      const setCurrentPageNum = usePdfReaderStore((s) => s.setCurrentPageNum);

      const containerRef = useRef<HTMLDivElement>(null);
      const thumbCanvasContainerElsRef = useRef<(HTMLDivElement | null)[]>([]);
      const thumbCanvasElsRef = useRef<(HTMLCanvasElement | null)[]>([]);
      // renderStatesRef 中存储已经渲染过的缩略图对应的页码（从 1 开始）
      const renderStatesRef = useRef<Set<number>>(new Set());
      const preRenderStatesRef = useRef<number[]>([]);

      const debounceWait = 100;

      function render(pageNums: number[]) {
        if (!pageNums.length) return;
        const pageSizeMap = new Map<number, [number, number, number]>();

        // 创建 canvas
        pageNums.forEach((pageNum) => {
          const pageIndex = pageNum - 1;
          const page = pages[pageIndex];

          const widthOg = page.width;
          const heightOg = page.height;
          const width = thumbWidth;
          const scale = width / widthOg;
          const height = heightOg * scale;
          pageSizeMap.set(pageNum, [width, height, scale]);

          const thumbCanvasEl = document.createElement("canvas");
          thumbCanvasEl.style.setProperty("position", "absolute");
          thumbCanvasEl.style.setProperty("top", "0");
          thumbCanvasEl.style.setProperty("left", "0");
          thumbCanvasEl.setAttribute("width", width + "");
          thumbCanvasEl.setAttribute("height", height + "");

          thumbCanvasElsRef.current[pageIndex] = thumbCanvasEl;
          thumbCanvasContainerElsRef.current[pageIndex]?.replaceChildren(
            thumbCanvasEl
          );
        });

        // 开启渲染
        pdfWorker
          .execute("renderPages", [], pageSizeMap, pageNums, true)
          .addEventListener("message", (res) => {
            const {
              data: [pageNum, isDone, imageBitmap],
            } = res;
            if (isDone) {
              const pageIndex = pageNum - 1;
              const thumbCanvasEl = thumbCanvasElsRef.current[pageIndex];
              const thumbCanvasContainerEl =
                thumbCanvasContainerElsRef.current[pageIndex];
              if (!thumbCanvasEl || !thumbCanvasContainerEl) return;
              thumbCanvasEl.getContext("2d")?.drawImage(imageBitmap!, 0, 0);
              thumbCanvasContainerEl.replaceChildren(thumbCanvasEl);
            }
          });
      }

      /**
       * 判断 thumb 是否在视图中
       * @param el
       * @param strict 严格模式，如果开启则需要 thumb 完全在视图中
       * @returns boolean
       */
      function isThumbInViewPort(el: HTMLDivElement, strict?: boolean) {
        const rect = el.getBoundingClientRect();
        const containerRect = containerRef.current!.getBoundingClientRect();
        return strict
          ? rect.top >= containerRect.top && rect.bottom <= containerRect.bottom
          : rect.bottom > containerRect.top && rect.top < containerRect.bottom;
      }

      function renderNewThumb() {
        // 检测 thumb 是否在视口中
        thumbCanvasContainerElsRef.current!.forEach(
          (thumbCanvasContainer, index) => {
            if (isThumbInViewPort(thumbCanvasContainer!)) {
              const pageNum = index + 1;
              renderStatesRef.current.add(pageNum);
            }
          }
        );

        const renderPageNums = new Set(renderStatesRef.current);
        preRenderStatesRef.current.forEach((pageNum) => {
          renderPageNums.delete(pageNum);
        });
        const renderPageNumsList = [...renderPageNums];
        render(renderPageNumsList);
        preRenderStatesRef.current = [...renderStatesRef.current!];
      }

      // 监听缩略图容器的滚动，滚动结束后一段时间内开启渲染
      const onScroll: React.UIEventHandler<HTMLDivElement> = debounce(() => {
        // 可以再用二分法优化下
        renderNewThumb();
      }, debounceWait);

      useEffect(() => {
        // 初始化
        thumbCanvasContainerElsRef.current.length = pages.length;
        thumbCanvasContainerElsRef.current.forEach((thumbCanvasContainerEl) => {
          thumbCanvasContainerEl?.replaceChildren("");
        });
        renderStatesRef.current = new Set();
        preRenderStatesRef.current = [];

        // 可以再把后面多余的遍历去掉
        renderNewThumb();

        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [pages]);

      const lastPageNumRef = useRef<number>(0);

      useEffect(() => {
        if (currentPageNum === 0) return;

        const pageIndex = currentPageNum - 1;
        const thumb = thumbCanvasContainerElsRef.current[pageIndex];
        if (!thumb) return;
        const container = containerRef.current!;
        const thumbRect = thumb.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        // 跳转的缩略图完全在视图外时
        if (!isThumbInViewPort(thumb)) {
          const lastThumb =
            pageIndex >= 1
              ? thumbCanvasContainerElsRef.current[pageIndex - 1]!
              : null;
          if (
            // 如果上一个当前页是这次要跳转的页的前一页
            lastThumb &&
            isThumbInViewPort(lastThumb, true) &&
            lastPageNumRef.current === currentPageNum - 1
          ) {
            const distance = containerRect.bottom - thumbRect.bottom;
            container.scrollTop = container.scrollTop - distance + 26;
          } else {
            const distance = containerRect.top - thumbRect.top;
            container.scrollTop = container.scrollTop - distance - 12;
          }
          // 跳转的缩略图有一部分在视图内时
        } else if (!isThumbInViewPort(thumb, true)) {
          if (currentPageNum < lastPageNumRef.current) {
            const distance = containerRect.top - thumbRect.top;
            container.scrollTop = container.scrollTop - distance - 12;
          } else {
            const distance = containerRect.bottom - thumbRect.bottom;
            container.scrollTop = container.scrollTop - distance + 26;
          }
        }
        lastPageNumRef.current = currentPageNum;
      }, [currentPageNum]);

      const thumbViews = (
        <div
          // ref={thumbViewsContainerRef}
          className="min-h-full min-w-full inline-flex flex-col items-center p-t-2"
        >
          {pages.map((page, pageIndex) => {
            const widthOg = page.width;
            const heightOg = page.height;
            const width = thumbWidth;
            const height = (heightOg / widthOg) * width;
            return (
              <div key={pageIndex} className="p-b-2 p-t-1">
                <div
                  className={"relative bg-white outline-l1 cursor-pointer"}
                  style={{
                    width,
                    height,
                    outline:
                      pageIndex + 1 === currentPageNum
                        ? "solid 4px var(--pri-2)"
                        : "",
                  }}
                  ref={(el) => {
                    thumbCanvasContainerElsRef.current[pageIndex] = el;
                  }}
                  onClick={() => {
                    setCurrentPageNum(pageIndex + 1);
                  }}
                >
                  {/* 在这里插入缩略图的 canvas */}
                </div>
                <div className="p-t-1 text-center text-size-sm text-on-bg-2">
                  {pageIndex + 1}
                </div>
              </div>
            );
          })}
        </div>
      );

      return (
        <div
          ref={containerRef}
          className={
            className +
            " " +
            "w-52 min-w-52 bg-bg-2 h-full text-light overflow-auto "
          }
          onScroll={onScroll}
        >
          {thumbViews}
        </div>
      );
    }
  )
);

export default ThumbnailsContainer;
