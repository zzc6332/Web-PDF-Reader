import { useEffect, useRef, useState } from "react";
import {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
} from "pdfjs-dist/types/src/display/api";

import * as pdfjsLib from "pdfjs-dist";

export default function usePdfLoading(pdfPath: string) {
  const [, setState] = useState(0);
  const update = () => {
    setState((s) => s + 1);
  };

  const pagesRef = useRef<PDFPageProxy[]>([]);
  const documentRef = useRef<PDFDocumentProxy>();
  const loadingTaskRef = useRef<PDFDocumentLoadingTask>();

  useEffect(() => {
    async function getpages() {
      const loadingTask = pdfjsLib.getDocument(pdfPath);
      loadingTaskRef.current = loadingTask;
      const pdfDocument = await loadingTask.promise;
      documentRef.current = pdfDocument;
      // 获取到 pdfDocument 和 loadingTaskRef 时就更新
      update();
      const { numPages } = pdfDocument;
      for (let i = 1; i <= numPages; i++) {
        pagesRef.current = [...pagesRef.current, await pdfDocument.getPage(i)];
        // pagesRef.current[i] = await pdfDocument.getPage(i);
        // 读取 2 页时就触发 re-render，之后每读取 10 页就更新
        if (i % 5 === 2) update();
      }
      // 将剩余未渲染的页都安排上
      if (numPages % 5 !== 2) update();
      // 获取到所有 pages 之后更新
      // update();
    }
    getpages();
    return () => {
      if (documentRef.current) {
        documentRef.current.cleanup();
        documentRef.current.destroy();
      }
      if (loadingTaskRef.current) {
        loadingTaskRef.current.destroy();
      }
      pagesRef.current.forEach((page) => {
        page.cleanup();
      });
    };
  }, [pdfPath]);

  return [pagesRef.current, documentRef.current, loadingTaskRef.current] as [
    PDFPageProxy[],
    PDFDocumentProxy | undefined,
    PDFDocumentLoadingTask | undefined
  ];
}
