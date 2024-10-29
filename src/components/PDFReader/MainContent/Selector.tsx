import { Input, Modal, Toast, Upload } from "@douyinfe/semi-ui";
import { memo, useEffect, useRef, useState } from "react";
import Props from "src/types/props";
import usePdfReaderStore from "src/stores/usePdfReaderStore";
import Icon from "src/components/GlobalComponents/Icon";
import { colors } from "src/configs/theme";
import PDFHistory from "./PDFHistory";

interface SelectorProps extends Props {}

export default memo(function Selector({
  className: classNameProp,
  style: styleProp,
}: SelectorProps) {
  const className = classNameProp || "";

  const setPdfSrc = usePdfReaderStore((s) => s.setPdfSrc);

  const uploadRef = useRef<Upload>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const pdfReaderEmitter = usePdfReaderStore((s) => s.emitter);
  const showHistory = usePdfReaderStore((s) => s.showHistory);
  const setIsloading = usePdfReaderStore((s) => s.setIsLoading);

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

  // 查询 indexedDB 中的缓存
  useEffect(() => {}, []);

  return (
    <div
      className={
        className + " " + "relative h-full w-full bg-bg-3 overflow-auto "
      }
      style={styleProp}
    >
      <div
        className="absolute h-full min-h-60 w-2/1 flex"
        style={{
          transform: (showHistory ? "translateX(-50%)" : "") + " translateZ(0)",
          transition: "transform 360ms ease-in-out",
        }}
      >
        <div className="h-full w-full flex flex-col items-center justify-center">
          <Upload
            className="w-2/3 sm:w-100"
            action=""
            limit={1}
            draggable={true}
            dragIcon={
              <Icon
                type="#icon-local-file"
                size="2.5rem"
                color={colors["pri-2"]}
                className="m-b-3 m-t-1"
              />
            }
            dragMainText={"点击选择或拖拽本地 PDF 文件到这里"}
            uploadTrigger="custom"
            ref={uploadRef}
            accept="application/pdf"
            onChange={({ fileList, currentFile }) => {
              const file = currentFile.fileInstance;
              if (file) {
                setIsloading(true);
                setPdfSrc(file);
                fileList.forEach((_, index) => {
                  delete fileList[index];
                });
              }
            }}
          />
          <div className="h-1/20"></div>
          {/* 借用一下 Upload 组件的 UI 保持风格统一，但禁用它的功能 */}
          <div
            className="w-2/3 sm:w-100"
            onClickCapture={(e) => {
              e.stopPropagation();
              setModalVisible(true);
            }}
          >
            <Upload
              className="h-full w-full"
              action=""
              draggable={true}
              dragIcon={
                <Icon
                  type="#icon-cloud-down"
                  size="2.5rem"
                  color={colors["pri-2"]}
                  className="m-b-3 m-t-1 scale-120"
                />
              }
              dragMainText={"点击输入在线 PDF 地址"}
              uploadTrigger="custom"
              ref={uploadRef}
            />
          </div>
          <Modal
            visible={modalVisible}
            title="请输入在线 PDF 地址"
            centered
            okButtonProps={{ disabled: !inputValue }}
            onOk={() => {
              if (inputValue) {
                setIsloading(true);
                setPdfSrc(inputValue);
                setModalVisible(false);
                setInputValue("");
              }
            }}
            onCancel={() => {
              setModalVisible(false);
              setInputValue("");
            }}
          >
            <Input
              onChange={(value) => {
                setInputValue(value);
              }}
            ></Input>
          </Modal>
        </div>
        <PDFHistory className="overflow-auto" />
      </div>
    </div>
  );
});
