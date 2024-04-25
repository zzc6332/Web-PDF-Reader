import { PDFPageProxy } from "pdfjs-dist";
import {
  GetViewportParameters,
  RenderTask,
} from "pdfjs-dist/types/src/display/api";
import { useEffect, useState } from "react";

/**
 * 在组件中传入 PDFPageProxy[] 调用 usePagesRender 后会得到将要渲染这些 pages 的 canvas 元素组成的数组，以及它们的 renderTasks
 * @param pages
 * @param getViewportParameters
 * @returns [ HTMLCanvasElement[], RenderTask[] ]
 */
export default function usePagesRender(
  pages: PDFPageProxy[],
  getViewportParameters: GetViewportParameters = { scale: 1 }
) {
  const { scale } = getViewportParameters;

  const [canvasEls, setCanvasEls] = useState<HTMLCanvasElement[]>([]);
  const [renderTasks, setRenderTasks] = useState<RenderTask[]>([]);

  useEffect(() => {
    if (pages.length === 0) return;
    let canvasEls: HTMLCanvasElement[] = [];
    let renderTasks: RenderTask[] = [];
    pages.forEach((page) => {
      // const index = page._pageIndex;
      const viewport = page.getViewport(getViewportParameters);

      // 创建 canvas 元素，并使用自定义属性标记它的 scale
      const canvasEl = document.createElement("canvas");
      canvasEl.setAttribute("data-scale", scale + "");
      canvasEl.setAttribute("width", viewport.width + "");
      canvasEl.setAttribute("height", viewport.height + "");
      canvasEl.style.setProperty("transform-origin", "top left");
      canvasEls = [...canvasEls, canvasEl];

      const canvasContext = canvasEl.getContext("2d");
      if (!canvasContext) return;

      const renderTask = page.render({ canvasContext, viewport });
      renderTasks = [...renderTasks, renderTask];
    });
    setRenderTasks(renderTasks);
    setCanvasEls(canvasEls);

    return () => {
      setCanvasEls([]);
      setRenderTasks([]);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, scale]);

  return [canvasEls, renderTasks] as [HTMLCanvasElement[], RenderTask[]];
}
