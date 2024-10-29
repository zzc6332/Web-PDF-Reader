import * as pdfjsLib from "pdfjs-dist";

import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?worker&url";
import {
  DocumentInitParameters,
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
  RenderTask,
  TypedArray,
} from "pdfjs-dist/types/src/display/api";

// import { ActionResult, createOnmessage } from "src/worker-handler/worker";
import { ActionResult, createOnmessage } from "worker-handler/worker";

import { EventEmitter } from "events";
interface EventHandlers {
  abortLoading: [];
}
const emitter = new EventEmitter<EventHandlers>();

// import { onupgradeneeded } from "./indexedDB";

function onupgradeneeded(e: IDBVersionChangeEvent) {
  const db = (e.target as IDBRequest).result as IDBDatabase;

  const objectStore = db.createObjectStore("pdf_buffer", {
    keyPath: "id",
    autoIncrement: true,
  });

  objectStore.createIndex("name", "name", { unique: false });
  objectStore.createIndex("url", "url", { unique: true });
  objectStore.createIndex("size", "size", { unique: false });
}

//#region - 调试用
const storeAll = false; // 是否存储所有打开的文件，无论是否已缓存
const storeThumb = true; // 是否缓存缩略图
//#endregion

//#region - 指定 workerPort
// 在 web worker 中，pdfjs 通过设置 workerPort 的方式来指定它的 pdf.worker.js
const worker = new Worker(workerSrc, { type: "module" });
pdfjsLib.GlobalWorkerOptions.workerPort = worker;
//#endregion

const thumbSize = {
  width: 140,
  height: 198,
};

const abortControllers = new Set<AbortController>();

// 一次只能打开一个 PDF，所以 currentPdfPageProxies 和 currentRenderTasks 放在外层
// pdf 读取相关的数据都是一次一批地更新，因此 pdfPageProxies 中存放所有的页
let currentPdfPageProxies: PDFPageProxy[];
// renderTask 不是一次性产生的，要将每次产生的 renderTask 都加入到 Set 中，当渲染完成或渲染取消时将它们一起移除
const currentRenderTasks = new Set<RenderTask>();

type CacheData<T extends "url" | "local" = "url" | "local"> = {
  size: number;
  buffer: ArrayBuffer;
  lastAccessed: number;
  thumb?: ImageBitmap;
} & (T extends "url"
  ? {
      type: "url";
      url: string;
      name: string;
      lastModified?: number;
      cached: boolean; // 是否缓存了二进制数据
    }
  : { type: "local"; name: string; lastModified: number; url?: string });

export type CacheDataWithId<T extends "url" | "local" = "url" | "local"> =
  CacheData<T> & { id: number };

export type PdfWorkerActions = {
  init: (
    src: string | URL | File | number
  ) => ActionResult<
    [PDFDocumentLoadingTask, number | null, CacheData | null, boolean]
  >;
  loadDocument: (
    pdfDocumentLoadingTask: PDFDocumentLoadingTask
  ) => ActionResult<PDFDocumentProxy>;
  loadPages: (
    pdfDocumentProxy: PDFDocumentProxy
  ) => ActionResult<PDFPageProxy[]>;
  load: (
    this: {
      pdfDocumentLoadingTask: PDFDocumentLoadingTask;
      pdfDocumentProxy: PDFDocumentProxy;
      pdfPageProxies: PDFPageProxy[];
    },
    src: string | URL | File | number
  ) => ActionResult<number>;
  addCache: (src: string) => ActionResult;
  renderPages: (
    pageSizeMap: Map<number, [number, number, number]>, // 元组中的三项分别代表 width、heigh、scale
    pageNums: number[],
    isThumb?: boolean
  ) => ActionResult<[number, boolean, ImageBitmap | null]>;
  cancelRenders: () => ActionResult;
  abortLoading: () => ActionResult;
};

onmessage = createOnmessage<PdfWorkerActions>({
  async init(src) {
    // 这里 blob 和 arrayBuffer 是给 pdfjs 用的，cacheData.buffer 用来存入 indexedDB 的，不能混用，因为 pdfjs 会把 buffer 转移到另一个 worker 线程中，而无法再存入 indexedDB
    let bin: Blob | ArrayBuffer;
    let cacheId: number | null = null; // 如果缓存中已存在将要加载的 pdf，则获取该 cacheId
    let cacheData: CacheData | null = null; // 如果是新加载的 pdf，那么生成新的 cacheData
    let needThumb = false; // 之后是否需要追加 thumb

    // 将 src 转换为 blob 或 arrayBuffer
    if (typeof src === "number") {
      cacheId = src;
      // 是 number 的情况，那么 src 就代表 cacheId，通过缓存获取文件
      const res = await getBufferByCacheId(cacheId);
      updateLastAccessed(cacheId);
      bin = res[0];
      needThumb = res[1];
    } else {
      // currentCacheId = null;
      if (typeof src === "string" || src instanceof URL) {
        // 是 string 的情况，那么 src 就代表 url
        const url = src instanceof URL ? src.toString() : src;
        // 提取文件名
        const reg = /\/([^/?#]+)$/;
        const match = url.match(reg);
        let name = (match ? match[1] || url : url).replace(/\.pdf$/i, "");
        // 检测下是否已有对应 url 的缓存文件
        const bufferFromCache = await getCacheDataByUrl(url);
        if (bufferFromCache) {
          // console.log("url cache");
          bin = bufferFromCache[0];
          cacheId = bufferFromCache[1];
          needThumb = bufferFromCache[2];
        } else {
          // 通过 url 进行网络请求以获取文件
          const controller = new AbortController();
          const signal = controller.signal;
          abortControllers.add(controller);
          try {
            const response = await fetch(url, { signal });
            abortControllers.delete(controller);
            const nameFromResponse = response.headers.get(
              "content-disposition"
            );
            if (nameFromResponse) name = nameFromResponse;
            if (!response.ok) throw new Error("获取 PDF 资源失败");
            bin = await response.blob();
            const blob = bin;
            cacheData = {
              type: "url",
              url,
              name,
              size: blob.size,
              buffer: await blob.arrayBuffer(),
              lastAccessed: Date.now(),
              cached: true,
            };
          } catch (error) {
            if ((error as { name: string }).name !== "AbortError") {
              abortControllers.delete(controller);
            }
            throw error;
          }
        }
      } else {
        // 是 File 的情况
        // 检测下缓存中是否已有对应的文件
        const bufferFromCache = await getBufferByFileInfo(src);
        if (bufferFromCache && !storeAll) {
          // console.log("local cache");
          bin = bufferFromCache[0];
          cacheId = bufferFromCache[1];
          updateLastAccessed(bufferFromCache[1]);
        } else {
          bin = src;
          cacheData = {
            type: "local",
            name: src.name.replace(/\.pdf$/i, ""),
            size: src.size,
            buffer: await src.arrayBuffer(),
            lastModified: src.lastModified,
            lastAccessed: Date.now(),
          };
        }
      }
    }

    // 使用 pdfJS 读取 arrayBuffer
    const pdfDocumentLoadingTask = pdfjsLib.getDocument(
      createDocumentInitParameters(
        bin instanceof Blob ? await bin.arrayBuffer() : bin
      )
    );

    return [pdfDocumentLoadingTask, cacheId, cacheData, needThumb];
  },
  async loadDocument(pdfDocumentLoadingTask) {
    const pdfDocumentProxy = (await pdfDocumentLoadingTask?.promise) || null;
    if (!pdfDocumentProxy) throw new Error("获取 PDF Document 失败");
    return pdfDocumentProxy;
  },
  async loadPages(pdfDocumentProxy) {
    const { numPages } = pdfDocumentProxy;
    const pagePromises: Promise<PDFPageProxy>[] = [];
    for (let i = 1; i <= numPages; i++) {
      pagePromises.push(pdfDocumentProxy.getPage(i));
    }
    const pdfPageProxies = await Promise.all(pagePromises);
    if (!pdfPageProxies) throw new Error("获取 PDF Pages 失败");
    return pdfPageProxies;
  },

  // load 是入口 Action，接收 pdfSrc，获取到 pdfDocumentProxy 和 pdfPageProxies，并将 pdf 的总页数传递给 Main
  async load(src) {
    const onAbortLoading = () => {
      emitter.off("abortLoading", onAbortLoading);
      throw Error("Abort");
    };
    emitter.on("abortLoading", onAbortLoading);

    const initRes = await this.init(src);
    if (!initRes) return;
    const [pdfDocumentLoadingTask, cacheId, cacheData, needThumb] = initRes;
    const pdfDocumentProxy = await this.loadDocument(pdfDocumentLoadingTask);
    if (!pdfDocumentProxy) return;
    const pdfPageProxies = await this.loadPages(pdfDocumentProxy);
    if (!pdfPageProxies) return;
    currentPdfPageProxies = pdfPageProxies;
    const result = { pdfDocumentLoadingTask, pdfDocumentProxy, pdfPageProxies };
    this.$post(
      result as {
        pdfDocumentLoadingTask: PDFDocumentLoadingTask;
        pdfDocumentProxy: PDFDocumentProxy;
        pdfPageProxies: PDFPageProxy[];
      }
    );

    // 如果还没被缓存过，则生成首页缩略图后将文件存入 indexedDB 中
    if (cacheData && storeThumb)
      cacheData.thumb = await getThumb(pdfPageProxies[0], thumbSize);
    if (needThumb) {
      updateCacheData(cacheId!, {
        thumb: await getThumb(pdfPageProxies[0], thumbSize),
      });
    }
    this.$end(cacheId || (await storeBuffer(cacheData!)));
    emitter.off("abortLoading", onAbortLoading);
  },

  async addCache(url) {
    const reg = /\/([^/?#]+)$/;
    const match = url.match(reg);
    const name = (match ? match[1] || url : url).replace(/\.pdf$/i, "");
    const cacheData: CacheData = {
      type: "url",
      url,
      name,
      size: 0,
      buffer: new ArrayBuffer(0),
      lastAccessed: Date.now(),
      cached: false,
    };
    storeBuffer(cacheData);
    this.$end();
  },

  async renderPages(pageSizeMap, pageNums, isThumb = false) {
    const renderTaskPromises: Promise<void>[] = [];

    // 渲染页面
    for (const arrIndex in pageNums) {
      const pageNum = pageNums[arrIndex];
      const pageIndex = pageNum - 1;
      const page = currentPdfPageProxies[pageIndex];
      const [width, height, scale] = pageSizeMap.get(pageNum)!;
      const canvas = new OffscreenCanvas(width, height);
      const canvasContext = canvas.getContext("2d");
      const viewport = page.getViewport({ scale });
      // console.log("开启渲染");
      // console.log(pageNum + " 页开始渲染");
      const renderTask = page.render({ canvasContext, viewport });
      if (!isThumb) currentRenderTasks.add(renderTask);
      const renderTaskPromise = renderTask.promise;
      renderTaskPromises.push(renderTaskPromise);
      // 以下是一次开启一个渲染任务的方式
      try {
        await renderTaskPromise;
        // console.log("worker 1 =========== 第 " + pageNum + " 页渲染完成");
        const imageBitmap = canvas.transferToImageBitmap();
        this.$post([pageNum, true, imageBitmap], [imageBitmap]);
      } catch (error) {
        // console.log("worker -1 =========== 第 " + pageNum + " 页取消渲染");
        this.$post([pageNum, false, null]);
      }
      currentRenderTasks.delete(renderTask);
      // 以下是一次性开启所有渲染任务的方式
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
        // console.log("worker -1 =========== end");
        this.$end([0, true, null]);
      })
      .catch(() => {});
  },

  async cancelRenders() {
    currentRenderTasks.forEach((renderTask) => {
      renderTask.cancel();
    });
    this.$end();
  },

  async abortLoading() {
    abortControllers.forEach((abortController) => {
      abortController.abort("Abort");
    });
    emitter.emit("abortLoading");
    this.$end();
  },
});

//#region - utils
// 在 web worker 中调用 pdfjsLib.getDocument 时，由于 worker 中没有 document，因此需要通过传入 DocumentInitParameters 对象以指定一个自定义的 ownerDocument，在这里封装一下 createDocumentInitParameters 用以生成 DocumentInitParameters 对象
function createDocumentInitParameters(
  src: string | URL | TypedArray | ArrayBuffer
): DocumentInitParameters {
  // 根据传入的 url 的类型来决定将其作为 url 还是 data 放入 DocumentInitParameters 中
  const url = typeof src === "string" || src instanceof URL ? src : undefined;

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

// 比较两个 ArrayBuffer 是否相同
function compareBuffers(arrayBuffer1: ArrayBuffer, arrayBuffer2: ArrayBuffer) {
  return (
    arrayBuffer1.byteLength === arrayBuffer2.byteLength &&
    new Uint8Array(arrayBuffer1).every(
      (value, index) => value === new Uint8Array(arrayBuffer2)[index]
    )
  );
}

// 通过缓存 ID 获取 PDF 文件，并自动更新 cached: false 的 cacheData
function getBufferByCacheId(cacheId: number) {
  return new Promise<[ArrayBuffer, boolean]>((resolve, reject) => {
    const request = indexedDB.open("pdf_cache");

    // 初次打开时创建 objectStore
    request.onupgradeneeded = onupgradeneeded;

    request.onerror = (error) => {
      reject(error);
    };
    request.onsuccess = (e) => {
      const db = (e.target as IDBRequest).result as IDBDatabase;
      db.onerror = (error) => {
        reject(error);
      };
      db
        .transaction(["pdf_buffer"])
        .objectStore("pdf_buffer")
        .get(cacheId).onsuccess = async (e) => {
        const cacheData: CacheDataWithId = (e.target as IDBRequest).result;
        if (cacheData.type === "url" && !cacheData.cached) {
          // 还未下载过的需要进行一下网络请求
          const buffer = (await getCacheDataByUrl(cacheData.url))?.[0];
          if (buffer) {
            resolve([buffer, true]);
          } else {
            reject("getCacheDataByUrl() 未能获取到 buffer");
          }
        } else {
          resolve([cacheData.buffer, false]);
        }
      };
    };
  });
}

// 通过 url 获取缓存中的文件，并自动更新  cached: false 的 cacheData，返回内容为 [ArrayBuffer, 对应的 cacheId， 加载后是否需要更新 thumb]
function getCacheDataByUrl(url: string) {
  return new Promise<[ArrayBuffer, number, boolean] | null>(
    (resolve, reject) => {
      const request = indexedDB.open("pdf_cache");

      // 初次打开时创建 objectStore
      request.onupgradeneeded = onupgradeneeded;

      request.onerror = (error) => {
        reject(error);
      };
      request.onsuccess = (e) => {
        const db = (e.target as IDBRequest).result as IDBDatabase;
        db.onerror = (error) => {
          reject(error);
        };
        db
          .transaction(["pdf_buffer"])
          .objectStore("pdf_buffer")
          .index("url")
          .get(url).onsuccess = async (e) => {
          const cacheData = (e.target as IDBRequest).result as
            | CacheDataWithId<"url">
            | undefined;
          if (!cacheData) {
            resolve(null);
          } else if (cacheData.cached) {
            resolve([cacheData.buffer, cacheData.id, false]);
          } else {
            // cacheData.cached 为 false 的情况，进行网络请求并更新 cacheData
            const controller = new AbortController();
            const signal = controller.signal;
            abortControllers.add(controller);
            try {
              const response = await fetch(cacheData.url, { signal });
              abortControllers.delete(controller);
              if (!response.ok) throw new Error("获取 PDF 资源失败");
              const nameFromResponse = response.headers.get(
                "content-disposition"
              );
              const name = nameFromResponse || cacheData.name;
              const blob = await response.blob();
              const buffer = await blob.arrayBuffer();
              const newCacheData: CacheDataWithId = {
                ...cacheData,
                buffer,
                name,
                size: blob.size,
                cached: true,
                lastAccessed: Date.now(),
              };
              updateCacheData(cacheData.id, newCacheData);
              // 返回的 buffer 不可以是 newCacheData 中的 buffer，要重新生成
              resolve([await blob.arrayBuffer(), cacheData.id, true]);
            } catch (error) {
              if (error === "Abort") {
                abortControllers.delete(controller);
              }
              throw error;
            }
          }
        };
      };
    }
  );
}

function getBufferByFileInfo(file: File) {
  return new Promise<[ArrayBuffer, number] | null>((resolve, reject) => {
    const request = indexedDB.open("pdf_cache");

    // 初次打开时创建 objectStore
    request.onupgradeneeded = onupgradeneeded;

    request.onerror = (error) => {
      reject(error);
    };

    request.onsuccess = (e) => {
      const db = (e.target as IDBRequest).result as IDBDatabase;
      db.onerror = (error) => {
        reject(error);
      };
      const request = db
        .transaction(["pdf_buffer"])
        .objectStore("pdf_buffer")
        .openCursor();

      request.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result as IDBCursorWithValue;
        if (cursor) {
          // 找到 name、size、lastModified 都一样的
          if (
            cursor.value.name === file.name &&
            cursor.value.size === file.size &&
            cursor.value?.lastModified === file.lastModified
          ) {
            resolve([cursor.value.buffer, cursor.value.id]);
          } else {
            cursor.continue();
          }
        } else {
          resolve(null);
        }
      };
    };
  });
}

function updateCacheData(id: number, newCacheData: Partial<CacheData>) {
  const request = indexedDB.open("pdf_cache");

  // 初次打开时创建 objectStore
  request.onupgradeneeded = onupgradeneeded;

  request.onerror = (error) => {
    console.error(error);
  };
  request.onsuccess = (e) => {
    const db = (e.target as IDBRequest).result as IDBDatabase;
    db.onerror = (error) => {
      console.error(error);
    };
    const objectStore = db
      .transaction(["pdf_buffer"], "readwrite")
      .objectStore("pdf_buffer");
    objectStore.get(id).onsuccess = (e) => {
      const cacheData = (e.target as IDBRequest).result as CacheDataWithId;
      objectStore.put({ ...cacheData, ...newCacheData }).onerror = (error) => {
        console.error(error);
      };
    };
  };
}

function updateLastAccessed(id: number) {
  updateCacheData(id, { lastAccessed: Date.now() });
}

async function getThumb(
  page: PDFPageProxy | undefined,
  { width, height }: { width: number; height: number }
) {
  if (!page) return;

  const { width: ogWidth, height: ogHeight } = page.getViewport({
    scale: 1,
  });

  const scale = Math.min(width / ogWidth, height / ogHeight);
  const viewport = page.getViewport({
    scale,
  });

  const canvas = new OffscreenCanvas(viewport.width, viewport.height);
  const renderTask = page.render({
    canvasContext: canvas.getContext("2d"),
    viewport,
  });

  await renderTask.promise;
  return canvas.transferToImageBitmap();
}

function storeBuffer(cacheData: CacheData) {
  return new Promise<number>((resolve, reject) => {
    const request = indexedDB.open("pdf_cache");

    // 初次打开时创建 objectStore
    request.onupgradeneeded = onupgradeneeded;

    request.onerror = (error) => {
      reject(error);
    };

    // 操作 objectStore 中的数据
    request.onsuccess = (e) => {
      const db = (e.target as IDBRequest).result as IDBDatabase;
      db.onerror = (error) => {
        reject(error);
      };

      const objectStore = db
        .transaction(["pdf_buffer"], "readwrite")
        .objectStore("pdf_buffer");

      if (!(storeAll || (cacheData.type === "url" && !cacheData.cached))) {
        // 先检查下这次的 buffer 是否之前已被存储
        const request = objectStore.openCursor();
        request.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest).result as IDBCursorWithValue;
          if (cursor) {
            // 先找到大小一样的，再比较是否相同
            if (cursor.value.size === cacheData.size) {
              if (compareBuffers(cursor.value.buffer, cacheData.buffer)) {
                // 如果存在相同的文件则直接返回 cacheId
                const id = cursor.primaryKey as number;
                updateLastAccessed(id);
                resolve(id);
                // 如果当前的 buffer 来自 url，而 cache 中的来自 local，那么为 cacheData 添加 url 字段，好让下次通过该 url 访问时可以直接用到缓存
                if (cacheData.type === "url" && cursor.value.type === "local") {
                  const newCacheData = {
                    ...cursor.value,
                    url: cacheData.url,
                  };
                  objectStore.put(newCacheData);
                  // 如果当前的 buffer 来自 local，而 cache 中的来自 url，那么为 cacheData 修正 name 字段，添加 lastModified 字段，好让下次通过该文件访问时可以直接用到缓存
                } else if (
                  cacheData.type === "local" &&
                  cursor.value.type === "url"
                ) {
                  const newCacheData = {
                    ...cursor.value,
                    name: cacheData.name,
                    lastModified: cacheData.lastModified,
                  };
                  objectStore.put(newCacheData);
                }
              } else {
                cursor.continue();
              }
            } else {
              cursor.continue();
            }
          } else {
            // 遍历完后如果没有相同的文件的则存储 buffer 后返回新的 cacheId
            objectStore.add(cacheData).onsuccess = (e) => {
              resolve((e.target as IDBRequest).result as number);
            };
          }
        };
      } else {
        objectStore.add(cacheData).onsuccess = (e) => {
          resolve((e.target as IDBRequest).result as number);
        };
      }
    };
  });
}

//#endregion
