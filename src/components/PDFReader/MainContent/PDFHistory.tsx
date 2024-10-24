import { memo, useEffect, useState } from "react";
import Props from "src/types/props";
import { CacheDataWithId } from "src/workers/pdf.worker";
import usePdfReaderStore from "src/stores/usePdfReaderStore";
import { onupgradeneeded } from "src/utils/indexedDB";
import Icon from "src/components/GlobalComponents/Icon";
import { colors } from "src/configs/theme";
import { Toast } from "@douyinfe/semi-ui";

interface PDFHistoryProps extends Props {}

export default memo(function PDFHistory({
  className: classNameProp,
}: PDFHistoryProps) {
  const className = classNameProp || "";

  const [cacheDataList, setCacheDataList] = useState<CacheDataWithId[]>([]);

  const thumbSize = usePdfReaderStore((s) => s.thumbSize);
  const setPdfSrc = usePdfReaderStore((s) => s.setPdfSrc);
  const isPdfActive = usePdfReaderStore((s) => s.isPdfActive);
  const pdfReaderEmitter = usePdfReaderStore((s) => s.emitter);
  const setIsloading = usePdfReaderStore((s) => s.setIsLoading);
  const setShowHistory = usePdfReaderStore((s) => s.setShowHistory);

  useEffect(() => {
    const onLoadingSucsess = () => {
      setIsloading(false);
    };
    pdfReaderEmitter.on("onLoadingSucsess", onLoadingSucsess);
    const onLoadingError = () => {
      Toast.error("加载失败，请选择有效的资源");
      setIsloading(false);
    };
    pdfReaderEmitter.on("onLoadingError", onLoadingError);
    return () => {
      pdfReaderEmitter.off("onLoadingSucsess", onLoadingSucsess);
      pdfReaderEmitter.off("onLoadingError", onLoadingError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 从 indexedDB 中获取缓存数据
  useEffect(() => {
    const request = indexedDB.open("pdf_cache");

    // 初次打开时创建 objectStore
    request.onupgradeneeded = onupgradeneeded;

    request.onsuccess = (e) => {
      const db = (e.target as IDBRequest).result as IDBDatabase;
      try {
        db
          .transaction(["pdf_buffer"])
          .objectStore("pdf_buffer")
          .getAll().onsuccess = (e) => {
          setCacheDataList((e.target as IDBRequest).result.reverse());
        };
      } catch (error) {
        error;
      }
    };
  }, [isPdfActive]);

  const items = cacheDataList.map((cacheData) => {
    const thumbCanvasSize = cacheData.thumb
      ? { width: cacheData.thumb.width, height: cacheData.thumb.height }
      : thumbSize;
    const { thumb, name, id } = cacheData;
    return (
      <div key={id}>
        {/* thumbCanvas 的容器 */}
        <div
          className="flex items-center justify-center"
          style={{ width: thumbSize.width, height: thumbSize.height }}
        >
          {thumb ? (
            <canvas
              className="outline-l1 hover:cursor-pointer"
              onClick={() => {
                setPdfSrc(id);
                setIsloading(true);
              }}
              ref={(thumbCanvas) => {
                if (!thumbCanvas) return;
                thumbCanvas.width = thumbCanvasSize.width;
                thumbCanvas.height = thumbCanvasSize.height;
                thumbCanvas.getContext("2d")?.drawImage(thumb, 0, 0);
              }}
            />
          ) : (
            <div
              className="flex items-center justify-center bg-bg-2 outline-l1 hover:cursor-pointer"
              style={{ width: thumbSize.width, height: thumbSize.height }}
              onClick={() => {
                setPdfSrc(id);
                setIsloading(true);
              }}
            >
              <Icon type="#icon-pdf" size="5rem" color={colors["pri-3"]} />
            </div>
          )}
        </div>
        <div
          className="overflow-hidden text-ellipsis whitespace-nowrap p-t-2 text-center"
          style={{ width: thumbSize.width }}
        >
          <span
            className="c-on-bg-2 hover:cursor-pointer"
            onClick={() => {
              setPdfSrc(id);
              setIsloading(true);
            }}
          >
            {name}
          </span>
        </div>
      </div>
    );
  });

  return (
    <div
      className={className + " " + "h-full w-full"}
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, 200px)",
        gridAutoRows: "280px",
        justifyItems: "center",
        alignItems: "center",
        justifyContent: "space-evenly",
      }}
    >
      <div>
        {/* thumbCanvas 的容器 */}
        <div
          className="flex items-center justify-center"
          style={{ width: thumbSize.width, height: thumbSize.height }}
        >
          <div
            className="flex items-center justify-center bg-bg-2 outline-l1 hover:cursor-pointer"
            style={{ width: thumbSize.width, height: thumbSize.height }}
            onClick={() => {
              setShowHistory(false);
            }}
          >
            <Icon type="#icon-plus" size="5rem" color={colors["pri-3"]} />
          </div>
        </div>
        <div
          className="overflow-hidden text-ellipsis whitespace-nowrap p-t-2 text-center"
          style={{ width: thumbSize.width }}
        >
          <span
            className="c-on-bg-2 hover:cursor-pointer"
            onClick={() => {
              setShowHistory(false);
            }}
          >
            导入 PDF
          </span>
        </div>
      </div>
      {items}
    </div>
  );
});
