import { PDFPageProxy } from "pdfjs-dist";
import {
  GetViewportParameters,
  RenderTask,
} from "pdfjs-dist/types/src/display/api";
import { useEffect, useRef, useState } from "react";

export default function usePagesRender(
  pages: PDFPageProxy[],
  // canvasElRef: React.RefObject<HTMLCanvasElement>,
  getViewportParameters: GetViewportParameters = { scale: 1 }
) {
  const { scale } = getViewportParameters;

  const [, setState] = useState(0);
  const update = () => {
    setState((s) => s + 1);
  };

  const canvasElsRef = useRef<HTMLCanvasElement[]>([]);
  const renderTasksRef = useRef<RenderTask[]>([]);

  useEffect(() => {
    pages.forEach((page) => {
      const index = page._pageIndex;
      const viewport = page.getViewport(getViewportParameters);

      // 创建 canvas 元素，并使用自定义属性标记它的 scale
      const canvasEl = document.createElement("canvas");
      canvasEl.setAttribute("data-scale", scale + "");
      canvasEl.setAttribute("width", viewport.width + "");
      canvasEl.setAttribute("height", viewport.height + "");
      canvasEl.style.setProperty("transform-origin", "top left");
      canvasElsRef.current[index] = canvasEl;

      const canvasContext = canvasEl.getContext("2d");
      if (!canvasContext) return;

      const renderTask = page.render({ canvasContext, viewport });
      renderTasksRef.current = [...renderTasksRef.current, renderTask];
    });

    update();

    return () => {
      canvasElsRef.current = [];
      renderTasksRef.current = [];
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, scale]);

  return [canvasElsRef.current, renderTasksRef.current] as [
    HTMLCanvasElement[],
    RenderTask[]
  ];
}
