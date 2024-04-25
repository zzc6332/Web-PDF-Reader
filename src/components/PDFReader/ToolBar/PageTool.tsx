import { memo, useEffect, useState } from "react";
import {
  Icon,
  IconProps,
} from "src/components/GlobalComponents/globalComponents";
import Props from "src/types/props";
import usePdfReaderStore from "src/stores/usePdfReaderStore";
// import { InputNumber } from "antd";
import { Input } from "@douyinfe/semi-ui";

interface PageToolsProps extends Props {
  iconProps: Omit<IconProps, "type">;
}

export default memo(function PageTool({
  className: classNameProp,
  iconProps,
}: PageToolsProps) {
  const className = classNameProp || "";

  const currentPageNum = usePdfReaderStore((s) => s.currentPageNum);
  const offsetCurrentPageNum = usePdfReaderStore((s) => s.offsetCurrentPageNum);
  const setCurrentPageNum = usePdfReaderStore((s) => s.setCurrentPageNum);
  const updateCurrentPageNum = usePdfReaderStore((s) => s.updateCurrentPageNum);
  const pdfDocument = usePdfReaderStore((s) => s.pdfDocument);
  const pages = usePdfReaderStore((s) => s.pages);

  useEffect(() => {
    if (currentPageNum === 0 && pages.length !== 0) updateCurrentPageNum();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages]);

  const [inputValue, setInputValue] = useState<string>(currentPageNum + "");
  useEffect(() => {
    setInputValue(currentPageNum + "");
  }, [currentPageNum]);

  function applyInputValue() {
    if (!pdfDocument) return;
    const pageNum = Math.max(Math.min(+inputValue, pdfDocument.numPages), 1);
    if (isNaN(pageNum) || !inputValue) {
      setInputValue(currentPageNum + "");
      return;
    }
    setInputValue(pageNum + "");
    setCurrentPageNum(pageNum);
  }

  return (
    <div className={className}>
      <Icon
        type="#icon-arrow-left"
        {...iconProps}
        onClick={() => {
          offsetCurrentPageNum(-1);
        }}
      ></Icon>
      <Icon
        type="#icon-arrow-right"
        {...iconProps}
        onClick={() => {
          offsetCurrentPageNum(1);
        }}
      ></Icon>
      <div className="select-none">
        <Input
          className="mx-2 h-8 w-14 inline-flex items-center [&>input]:text-end [&>input]:text-4"
          value={inputValue}
          onChange={(value) => {
            setInputValue(value);
          }}
          onBlur={applyInputValue}
          onKeyPress={(e) => {
            if (e.code !== "Enter") return;
            applyInputValue();
          }}
          onKeyDown={(e) => {
            if (e.code !== "Escape") return;
            setInputValue(currentPageNum + "");
          }}
        />
      </div>
      <div className="mr-2 select-none whitespace-nowrap text-on-bg-1">
        / {pdfDocument?.numPages || 0}
      </div>
    </div>
  );
});
