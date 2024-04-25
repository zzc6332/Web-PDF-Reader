import { memo } from "react";
import DocumentContainer from "./DocumentContainer";
import ThumbnailsContainer from "./ThumbnailsContainer";
import Props from "src/types/props";
import usePdfReaderStore from "src/stores/usePdfReaderStore";

interface DocumentLoadingProps extends Props {}

export default memo(function MainContent({
  className: classNameProp,
}: DocumentLoadingProps) {
  const className = classNameProp || "";

  const useLoading = usePdfReaderStore((s) => s.useLoading);
  useLoading();

  return (
    <div className={"flex " + className}>
      <ThumbnailsContainer className="flex-none" />
      <DocumentContainer />
    </div>
  );
});
