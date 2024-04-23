import { memo } from "react";
import Props from "src/types/props";

interface ThumbnailsContainerProps extends Props {

}

export default memo(function ThumbnailsContainer({
  className: classNameProp,
}: ThumbnailsContainerProps) {
  const className = classNameProp || "";

  return <div className={"w-64 bg-slate-500 " + className}></div>;
});
