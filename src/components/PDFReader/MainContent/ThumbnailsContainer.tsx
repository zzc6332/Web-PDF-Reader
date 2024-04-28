import { forwardRef, memo } from "react";
import Props from "src/types/props";

interface ThumbnailsContainerProps extends Props {}

const ThumbnailsContainer = memo(
  forwardRef<HTMLDivElement, ThumbnailsContainerProps>(
    function ThumbnailsContainer({ className: classNameProp }, ref) {
      const className = classNameProp || "";

      return (
        <div
          ref={ref}
          className={
            className +
            " " +
            "w-64 min-w-64 bg-slate-500 border-amber border-[5px] h-full text-light"
          }
        >
          qwertyuiopasdfghjklzxcvbnm
        </div>
      );
    }
  )
);

export default ThumbnailsContainer;
