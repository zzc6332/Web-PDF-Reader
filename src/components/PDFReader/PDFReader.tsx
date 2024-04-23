import { memo } from "react";
import MainContent from "./MainContent/MainContent";
import ToolBar from "./ToolBar/ToolBar";

export default memo(function PdfReader() {
  return (
    <div className="h-full flex flex-col">
      <ToolBar className="flex-none" />
      <MainContent className="flex-auto overflow-hidden" />
    </div>
  );
});
