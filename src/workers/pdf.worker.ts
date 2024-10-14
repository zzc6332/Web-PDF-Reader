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

// pdf 读取相关的数据都是一次一批地更新
let pdfDocumentLoadingTask: PDFDocumentLoadingTask | null = null;
let pdfDocumentProxy: PDFDocumentProxy | null = null;
let pdfPageProxies: PDFPageProxy[];

// renderTask 不是一次性产生的，所以要将所有产生的 renderTask 都集中放置在一起，当渲染完成或渲染取消时将其移除
const currentRenderTasks = new Set<RenderTask>();

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
    pageSizeMap: Map<number, [number, number]>,
    pageNums: number[],
    getViewportParameters: GetViewportParameters
  ) => ActionResult<[number, boolean, ImageBitmap | null]>;
  cancelRenders: () => ActionResult<void>;
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

  async renderPages(pageSizeMap, pageNums, getViewportParameters) {
    const renderTaskPromises: Promise<void>[] = [];

    // 渲染页面
    for (const pageNum of pageNums) {
      const pageIndex = pageNum - 1;
      const page = pdfPageProxies[pageIndex];
      const [width, height] = pageSizeMap.get(pageNum)!;
      const canvas = new OffscreenCanvas(width, height);
      const canvasContext = canvas.getContext("2d");
      const viewport = page.getViewport(getViewportParameters);
      // console.log(pageNum + " 页开始渲染");
      const renderTask = page.render({ canvasContext, viewport });
      currentRenderTasks.add(renderTask);
      const renderTaskPromise = renderTask.promise;
      renderTaskPromises.push(renderTaskPromise);
      try {
        await renderTaskPromise;
        // console.log(pageNum + " 页渲染完成");
        const imageBitmap = canvas.transferToImageBitmap();
        this.$post([pageNum, true, imageBitmap], [imageBitmap]);
      } catch (error) {
        // console.log(`取消渲染第 ${pageNum} 页`, error);
        this.$post([pageNum, false, null]);
      }
      currentRenderTasks.delete(renderTask);
      // renderTaskPromise
      //   .then(() => {
      //     const imageBitmap = canvas.transferToImageBitmap();
      //     console.log(pageNum + " 页渲染完成");
      //     this.$post([pageNum, true, imageBitmap], [imageBitmap]);
      //   })
      //   .catch((err) => {
      //     console.log(`取消渲染第 ${pageNum} 页`, err);
      //     this.$post([pageNum, false, null]);
      //   })
      //   .finally(() => {
      //     currentRenderTasks.delete(renderTask);
      //   });
    }
    Promise.all(renderTaskPromises)
      .then(() => {
        this.$end([0, true, null]);
      })
      .catch(() => {});
    setTimeout(() => {
      // console.log(currentRenderTasks);
    }, 2000);
  },
  async cancelRenders() {
    currentRenderTasks.forEach((renderTask) => {
      renderTask.cancel();
    });
  },
});
