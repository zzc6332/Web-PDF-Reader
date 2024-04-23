import { memo, useEffect, useRef } from "react";
import Props from "src/types/props";

export interface IconProps extends Props {
  type: string;
  size?: string;
  width?: string;
  height?: string;
  padding?: string;
  color?: string;
  hoverColor?: string;
  hoverScale?: number;
  offsetScale?: number;
}

export default memo(function Icon({
  type,
  padding,
  size,
  width: widthProp,
  height: heightProp,
  color,
  hoverColor = color,
  hoverScale = 1,
  offsetScale = 1,
  className: ClassNameProp,
  ...restProps
}: IconProps) {
  const width = size || widthProp || "1rem";
  const height = size || heightProp || "1rem";

  const containerClassName = [
    "group text-[var(--color)] hover:text-[var(--hover-color)]",
    ClassNameProp,
  ].join(" ");

  const iconClassName =
    "icon block group-hover:transform-cpu group-hover:scale-[var(--hover-scale)]";

  const containerElRef = useRef<HTMLDivElement>(null);
  const iconElRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    containerElRef.current?.style.setProperty("--color", color || "");
    containerElRef.current?.style.setProperty(
      "--hover-color",
      hoverColor || ""
    );
    iconElRef.current?.style.setProperty("--hover-scale", hoverScale + "");
  }, [color, hoverColor, hoverScale]);

  return (
    <div ref={containerElRef} className={containerClassName} {...restProps}>
      <svg
        ref={iconElRef}
        className={iconClassName}
        aria-hidden="true"
        width={width}
        height={height}
        style={{
          padding,
          boxSizing: "content-box",
        }}
      >
        <use
          xlinkHref={type}
          style={{
            transform: `scale(${offsetScale})`,
            transformOrigin: "center",
          }}
        ></use>
      </svg>
    </div>
  );
});
