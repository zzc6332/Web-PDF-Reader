import { memo, useCallback, useEffect, useState } from "react";
import Props from "src/types/props";
import { CacheDataWithId } from "src/workers/pdf.worker";
import usePdfReaderStore from "src/stores/usePdfReaderStore";
import { onupgradeneeded } from "src/utils/indexedDB";
import Icon from "src/components/GlobalComponents/Icon";
import { colors } from "src/configs/theme";
import { Modal, Toast } from "@douyinfe/semi-ui";

interface PDFHistoryProps extends Props {}

export default memo(function PDFHistory({
  className: classNameProp,
}: PDFHistoryProps) {
  const className = classNameProp || "";

  const [cacheDataList, setCacheDataList] = useState<CacheDataWithId[]>([]);
  const [selectedList, setSelectedList] = useState<number[]>([]);
  const [modalVisible, setModalVisible] = useState<boolean>(false);

  const thumbSize = usePdfReaderStore((s) => s.thumbSize);
  const setPdfSrc = usePdfReaderStore((s) => s.setPdfSrc);
  const isPdfActive = usePdfReaderStore((s) => s.isPdfActive);
  const pdfReaderEmitter = usePdfReaderStore((s) => s.emitter);
  const setIsloading = usePdfReaderStore((s) => s.setIsLoading);
  const setShowHistory = usePdfReaderStore((s) => s.setShowHistory);
  const historySelectMode = usePdfReaderStore((s) => s.historySelectMode);
  const setHistorySelectMode = usePdfReaderStore((s) => s.setHistorySelectMode);
  const checkAll = usePdfReaderStore((s) => s.checkAll);
  const setCheckAll = usePdfReaderStore((s) => s.setCheckAll);

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

  useEffect(() => {
    return () => {
      setSelectedList([]);
    };
  }, [historySelectMode]);

  const onClickThumb = useCallback(
    (id: number) => {
      if (!historySelectMode) {
        setPdfSrc(id);
        setIsloading(true);
      } else {
        const selectedListSet = new Set(selectedList);
        selectedListSet.has(id)
          ? selectedListSet.delete(id)
          : selectedListSet.add(id);
        setSelectedList([...selectedListSet]);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [historySelectMode, selectedList]
  );

  const checkSelected = useCallback(
    (id: number) => {
      return selectedList.indexOf(id) !== -1;
    },
    [selectedList]
  );

  const getCacheData = useCallback(() => {
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
          setCacheDataList(
            ((e.target as IDBRequest).result as CacheDataWithId[]).sort(
              (a, b) => b.lastAccessed - a.lastAccessed
            )
          );
        };
      } catch (error) {
        error;
      }
    };
  }, []);

  const deleteCacheData = useCallback((id: number) => {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("pdf_cache");

      // 初次打开时创建 objectStore
      request.onupgradeneeded = onupgradeneeded;

      request.onsuccess = (e) => {
        const db = (e.target as IDBRequest).result as IDBDatabase;
        try {
          db
            .transaction(["pdf_buffer"], "readwrite")
            .objectStore("pdf_buffer")
            .delete(id).onsuccess = () => {
            setSelectedList([]);
            resolve();
          };
        } catch (error) {
          reject(error);
        }
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deleteSelected = useCallback(async () => {
    try {
      await Promise.all(
        selectedList.map((selected) => {
          deleteCacheData(selected);
        })
      );
      getCacheData();
      setHistorySelectMode(false);
    } catch (error) {
      console.error(error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteCacheData, getCacheData, selectedList]);

  useEffect(() => {
    const onDeleteCache = async () => {
      if (selectedList.length) setModalVisible(true);
    };
    pdfReaderEmitter.on("deleteCache", onDeleteCache);

    return () => {
      pdfReaderEmitter.off("deleteCache", onDeleteCache);
    };
  }, [deleteCacheData, getCacheData, pdfReaderEmitter, selectedList]);

  // 从 indexedDB 中获取缓存数据
  useEffect(() => {
    if (isPdfActive) {
      // 打开 pdf 时有可能出现新增了历史记录的情况，此时进行一次加载，使得 PDFHistory 中的内容能提前加载完毕；由于 indexedDB 中添加数据在 worker 线程中进行，会有一定延迟，所以在定时器中处理
      setTimeout(() => {
        getCacheData();
      }, 300);
    } else {
      // 初次打开时需要立即加载历史数据
      getCacheData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPdfActive]);

  useEffect(() => {
    if (checkAll === 1) {
      setSelectedList(cacheDataList.map((cacheData) => cacheData.id));
    } else if (checkAll === 0) {
      setSelectedList([]);
    }
  }, [cacheDataList, checkAll]);

  useEffect(() => {
    const { length } = selectedList;
    if (!length) {
      setCheckAll(0);
    } else if (length === cacheDataList.length) {
      setCheckAll(1);
    } else {
      setCheckAll(-1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheDataList, selectedList]);

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
          <div
            className={
              "relative " +
              (checkSelected(id)
                ? "outline-solid outline-2 outline-pri-1"
                : "hover:outline-solid hover:outline-1 hover:outline-pri-1")
            }
          >
            {thumb ? (
              <canvas
                className={
                  "outline-l1 hover:cursor-pointer" +
                  (historySelectMode ? " opacity-50" : "")
                }
                onClick={() => {
                  onClickThumb(id);
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
                className={
                  "outline-l1 hover:cursor-pointer" +
                  (historySelectMode ? " opacity-50" : "")
                }
              >
                <div
                  className={"flex items-center justify-center bg-bg-2"}
                  style={{ width: thumbSize.width, height: thumbSize.height }}
                  onClick={() => {
                    onClickThumb(id);
                  }}
                >
                  <Icon type="#icon-pdf" size="5rem" color={colors["pri-3"]} />
                </div>
              </div>
            )}
          </div>
        </div>
        <div
          className="overflow-hidden text-ellipsis whitespace-nowrap p-t-2 text-center"
          style={{ width: thumbSize.width }}
        >
          <span className="c-on-bg-2">{name}</span>
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
          <span className="c-on-bg-2">导入 PDF</span>
        </div>
      </div>
      {items}
      <Modal
        visible={modalVisible}
        title={"是否要删除选中记录"}
        onOk={() => {
          deleteSelected();
          setModalVisible(false);
        }}
        onCancel={() => {
          setModalVisible(false);
        }}
      >
        该操作无法撤回
      </Modal>
    </div>
  );
});
