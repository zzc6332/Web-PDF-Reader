import { memo } from "react";
import MainContent from "./MainContent/MainContent";
import ToolBar from "./ToolBar/ToolBar";
import Selector from "./MainContent/Selector";
import usePdfReaderStore from "../../stores/usePdfReaderStore";

export default memo(function PdfReader() {
  const isPdfActive = usePdfReaderStore((s) => s.isPdfActive);

  return (
    <div className="h-full flex flex-col">
      <ToolBar className="flex-none" />
      {isPdfActive ? <MainContent className="flex-auto overflow-hidden" /> : ""}
      {/* Selector 在不需要时只是隐藏，下次访问时缩略图不需要重新加载 */}
      <Selector style={isPdfActive ? { display: "none" } : {}} />
    </div>
  );
});
