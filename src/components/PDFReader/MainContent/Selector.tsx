import { Input, Modal, Spin, Upload } from "@douyinfe/semi-ui";
import { memo, useEffect, useRef, useState } from "react";
import Props from "src/types/props";
import usePdfReaderStore from "src/stores/usePdfReaderStore";
import Icon from "src/components/GlobalComponents/Icon";
import { colors } from "src/configs/theme";

interface SelectorProps extends Props {}

export default memo(function Selector({
  className: classNameProp,
}: SelectorProps) {
  const className = classNameProp || "";

  const setPdfSrc = usePdfReaderStore((s) => s.setPdfSrc);

  const uploadRef = useRef<Upload>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsloading] = useState(false);

  const pdfReaderEmitter = usePdfReaderStore((s) => s.emitter);

  useEffect(() => {
    const onLoadingSucsess = () => {
      setIsloading(false);
    };
    pdfReaderEmitter.on("onLoadingSucsess", onLoadingSucsess);
    const onLoadingError = () => {
      setIsloading(false);
    };
    pdfReaderEmitter.on("onLoadingError", onLoadingError);
    return () => {
      pdfReaderEmitter.off("onLoadingSucsess", onLoadingSucsess);
      pdfReaderEmitter.off("onLoadingError", onLoadingError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={
        className + " " + "relative h-full w-full bg-bg-3 overflow-auto "
      }
    >
      <div className="h-full min-h-60 w-full flex flex-col items-center justify-center">
        <Upload
          className="w-2/3 sm:w-100"
          action=""
          limit={1}
          draggable={true}
          dragIcon={
            <Icon
              type="#icon-file-open"
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
        {/* 借用一下 Upload 组件的 UI，但覆盖它的功能 */}
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
                type="#icon-file-open"
                size="2.5rem"
                color={colors["pri-2"]}
                className="m-b-3 m-t-1"
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
          onOk={() => {
            setIsloading(true);
            setPdfSrc(inputValue);
            setModalVisible(false);
            setInputValue("");
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
      {isLoading ? (
        <div className="bg-bg-translucence-2 absolute left-0 top-0 h-full w-full flex items-center justify-center">
          <div className="b-radius h-30 w-40 flex flex-col items-center justify-center rounded-xl bg-bg-3 opacity-75">
            <Spin size="large"></Spin>
            <div className="h-3"></div>
            <div>加载中...</div>
          </div>
        </div>
      ) : (
        ""
      )}
    </div>
  );
});
