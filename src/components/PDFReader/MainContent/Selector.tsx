import { Input, Modal, Upload } from "@douyinfe/semi-ui";
import { memo, useRef, useState } from "react";
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

  return (
    <div className={className + " " + "h-full w-full bg-bg-3 overflow-auto"}>
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
    </div>
  );
});
