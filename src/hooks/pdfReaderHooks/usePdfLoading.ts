import { useEffect, useMemo, useState } from "react";
import {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
} from "pdfjs-dist/types/src/display/api";

import * as pdfjsLib from "pdfjs-dist";

/**
 * 在组件中调用 usePdfLoading 后获取到使用 pdfjs 解析 pdf 文档后得到的 [ PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy[] ]
 * - PDFDocumentLoadingTask 最开始就能获取到
 * - PDFDocumentProxy 获取到后会触发重新渲染
 * - PDFPageProxy 全部获取完成后会触发重新渲染
 * @param pdfPath
 * @returns [ PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy[] ]
 */
export default function usePdfLoading(pdfPath: string) {
  // loadingTask 可以直接得到，而 PDFPageProxy 和 PDFDocumentProxy 需要异步获取
  const loadingTask = useMemo(() => pdfjsLib.getDocument(pdfPath), [pdfPath]);

  const [pages, setPages] = useState<PDFPageProxy[]>([]);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy>();

  useEffect(() => {
    async function getDocumentAndpages() {
      const pdfDocument = await loadingTask.promise;
      setPdfDocument(pdfDocument);

      // 异步获取到所有的 pageProxy 后触发更新
      const { numPages } = pdfDocument;
      const getPagePromises = [];
      for (let i = 1; i <= numPages; i++) {
        const getPagePromise = pdfDocument.getPage(i);
        getPagePromises.push(getPagePromise);
      }
      const pages = await Promise.all(getPagePromises);
      setPages(pages);
    }

    getDocumentAndpages();

    return () => {
      if (pdfDocument) {
        pdfDocument.cleanup();
        pdfDocument.destroy();
      }
      loadingTask.destroy();
      pages.forEach((page) => {
        page.cleanup();
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingTask, pdfPath]);

  return [loadingTask, pdfDocument, pages] as [
    PDFDocumentLoadingTask,
    PDFDocumentProxy | undefined,
    PDFPageProxy[]
  ];
}
