import {
  GetViewportParameters,
  PDFPageProxy,
  RenderTask,
} from "pdfjs-dist/types/src/display/api";
import { useEffect, useRef, useState } from "react";

export default function usePageRender(
  page: PDFPageProxy,
  // canvasElRef: React.RefObject<HTMLCanvasElement>,
  getViewportParameters: GetViewportParameters = { scale: 1 }
) {
  const { scale } = getViewportParameters;
  const [, setState] = useState(0);
  const update = () => {
    setState((s) => s + 1);
  };
  const renderTaskRef = useRef<RenderTask>();
  const canvasElRef = useRef<HTMLCanvasElement>();

  useEffect(() => {
    const canvasEl = document.createElement("canvas");
    canvasEl.setAttribute("data-scale", scale + "");
    canvasElRef.current = canvasEl;
    const canvasContext = canvasEl.getContext("2d");
    if (!canvasContext) return;
    const viewport = page.getViewport(getViewportParameters);
    canvasEl.width = viewport.width;
    canvasEl.height = viewport.height;
    const renderTask = page.render({
      canvasContext,
      viewport,
    });
    renderTaskRef.current = renderTask;
    // 获取到 renderTask 后更新
    update();
    return () => {
      renderTask.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, scale]);

  return [canvasElRef.current, renderTaskRef.current] as [
    HTMLCanvasElement | undefined,
    RenderTask | undefined
  ];
}
