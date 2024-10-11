import * as pdfjsLib from "pdfjs-dist";

import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?worker&url";
import {
  DocumentInitParameters,
  GetViewportParameters,
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
  RenderTask,
  TypedArray,
} from "pdfjs-dist/types/src/display/api";

// import { ActionResult, createOnmessage } from "src/worker-handler/worker";
import { ActionResult, createOnmessage } from "worker-handler/worker";

//#region - 指定 workerPort
// 在 web worker 中，pdfjs 通过设置 workerPort 的方式来指定它的 pdf.worker.js
const worker = new Worker(workerSrc, { type: "module" });
pdfjsLib.GlobalWorkerOptions.workerPort = worker;
//#endregion

//#region - utils
// 在 web worker 中调用 pdfjsLib.getDocument 时，由于 worker 中没有 document，因此需要通过传入 DocumentInitParameters 对象以指定一个自定义的 ownerDocument，在这里封装一下 createDocumentInitParameters 用以生成 DocumentInitParameters 对象
function createDocumentInitParameters(
  src: string | URL | TypedArray | ArrayBuffer
): DocumentInitParameters {
  // 根据传入的 url 的类型来决定将其作为 url 还是 data 放入 DocumentInitParameters 中
  const url =
    typeof src === "string"
      ? new URL(src)
      : src instanceof URL
      ? src
      : undefined;

  const data: TypedArray | ArrayBuffer | undefined =
    !(src instanceof URL) && typeof src !== "string" ? src : undefined;

  return {
    url,
    data,
    ownerDocument: {
      fonts: self.fonts,
      createElement: (name: string) => {
        if (name == "canvas") {
          return new OffscreenCanvas(0, 0);
        }
        return null;
      },
    },
  };
}
//#endregion

let pdfDocumentLoadingTask: PDFDocumentLoadingTask | null = null;
let pdfDocumentProxy: PDFDocumentProxy | null = null;
let pdfPageProxies: PDFPageProxy[];

export type PdfWorkerActions = {
  init: (
    src: string | URL | ArrayBuffer
  ) => ActionResult<PDFDocumentLoadingTask>;
  loadDocument: () => ActionResult<PDFDocumentProxy>;
  loadPages: () => ActionResult<PDFPageProxy[]>;
  load: (src: string | URL | ArrayBuffer) => ActionResult<{
    pdfDocumentLoadingTask: PDFDocumentLoadingTask;
    pdfDocumentProxy: PDFDocumentProxy;
    pdfPageProxies: PDFPageProxy[];
  }>;
  renderPages: (
    canvasList: OffscreenCanvas[],
    pages: PDFPageProxy[],
    getViewportParameters: GetViewportParameters
  ) => ActionResult<RenderTask[]>;
  cancelRenders: (renderTasks: RenderTask[]) => ActionResult<void>;
};

onmessage = createOnmessage<PdfWorkerActions>({
  async init(src) {
    pdfDocumentLoadingTask = pdfjsLib.getDocument(
      createDocumentInitParameters(src)
    );
    return pdfDocumentLoadingTask;
  },
  async loadDocument() {
    pdfDocumentProxy = (await pdfDocumentLoadingTask?.promise) || null;
    if (!pdfDocumentProxy) throw new Error("获取 PDF Document 失败");
    return pdfDocumentProxy;
  },
  async loadPages() {
    if (!pdfDocumentProxy) throw new Error("获取 PDF Pages 失败");
    const { numPages } = pdfDocumentProxy;
    const pagePromises: Promise<PDFPageProxy>[] = [];
    for (let i = 1; i <= numPages; i++) {
      pagePromises.push(pdfDocumentProxy.getPage(i));
    }
    pdfPageProxies = await Promise.all(pagePromises);
    return pdfPageProxies;
  },
  // load 是入口 Action，接收 pdfSrc，获取到 pdfDocumentProxy 和 pdfPageProxies，并将 pdf 的总页数传递给 Main
  async load(src) {
    await this.init(src);
    await this.loadDocument();
    await this.loadPages();
    const result = { pdfDocumentLoadingTask, pdfDocumentProxy, pdfPageProxies };
    return result as {
      pdfDocumentLoadingTask: PDFDocumentLoadingTask;
      pdfDocumentProxy: PDFDocumentProxy;
      pdfPageProxies: PDFPageProxy[];
    };
  },

  async renderPages(canvasList, pages, getViewportParameters) {
    const renderTasks = canvasList.map((canvas, index) => {
      const page = pages[index];
      // console.log(index, " 开始渲染");
      const canvasContext = canvas.getContext("2d");
      const viewport = page.getViewport(getViewportParameters);
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      const renderTask = page.render({ canvasContext, viewport });
      renderTask.promise
        .then(() => {
          // console.log(page._pageIndex + 1 + " 渲染完成");
        })
        .catch(() => {
          // console.log(`取消渲染第 ${index + 1} 页`, err);
        });
      return renderTask;
    });
    return renderTasks;
  },
  async cancelRenders(renderTasks: RenderTask[]) {
    renderTasks.forEach((renderTask) => {
      renderTask.cancel();
    });
  },
});
