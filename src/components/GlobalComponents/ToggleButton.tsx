import { memo, useEffect, useRef, useState } from "react";
import Props from "src/types/props";
import { colors } from "src/configs/theme";

interface ToggleButtonProps extends Omit<Props, "defaultValue"> {
  width?: string;
  height?: string;
  checkedColor?: string;
  checkedHoverColor?: string;
  checkedBorderColor?: string;
  checkedContent?: React.ReactNode;
  uncheckedColor?: string;
  uncheckedHoverColor?: string;
  uncheckedBorderColor?: string;
  uncheckedContent?: React.ReactNode;
  onToggle?: (isChecked: boolean) => void;
  defaultValue?: boolean;
}

export default memo(function ToggleButton({
  className: classNameProp,
  width = "2rem",
  height = "2rem",
  checkedColor = colors["pri-1"],
  checkedHoverColor = colors["pri-2"],
  checkedBorderColor = "transparent",
  checkedContent = <span className="text-xs text-bg-1">ON</span>,
  uncheckedColor = colors["bg-2"],
  uncheckedHoverColor = colors["bg-1"],
  uncheckedBorderColor = colors["on-bg-3"],
  uncheckedContent = <span className="text-xs">OFF</span>,
  onToggle,
  defaultValue = true,
}: ToggleButtonProps) {
  const className = classNameProp || "";
  const [isChecked, setIsChecked] = useState(defaultValue);

  const buttonElRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const style = buttonElRef.current?.style;
    if (!style) return;
    style.setProperty("--chekedColor", checkedColor);
    style.setProperty("--checkedHoverColor", checkedHoverColor);
    style.setProperty("--checkedBorderColor", checkedBorderColor);
    style.setProperty("--uncheckedColor", uncheckedColor);
    style.setProperty("--uncheckedColor", uncheckedColor);
    style.setProperty("--uncheckedHoverColor", uncheckedHoverColor);
    style.setProperty("--uncheckedBorderColor", uncheckedBorderColor);
  }, [
    checkedBorderColor,
    checkedColor,
    checkedHoverColor,
    uncheckedBorderColor,
    uncheckedColor,
    uncheckedHoverColor,
  ]);

  useEffect(() => {
    const style = buttonElRef.current?.style;
    if (!style) return;
    style.setProperty(
      "--color",
      isChecked
        ? style.getPropertyValue("--chekedColor")
        : style.getPropertyValue("--uncheckedColor")
    );
    style.setProperty(
      "--hoverColor",
      isChecked
        ? style.getPropertyValue("--checkedHoverColor")
        : style.getPropertyValue("--uncheckedHoverColor")
    );
    style.setProperty(
      "--borderColor",
      isChecked
        ? style.getPropertyValue("--checkedBorderColor")
        : style.getPropertyValue("--uncheckedBorderColor")
    );
    if (onToggle) onToggle(isChecked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isChecked]);

  const buttonStyleClassName =
    "bg-[var(--color)] hover:bg-[var(--hoverColor)] border border-[var(--borderColor)] flex justify-center items-center hover:cursor-pointer ";

  return (
    <div
      ref={buttonElRef}
      className={
        `rounded-md box-border select-none ` +
        buttonStyleClassName +
        className
      }
      style={{
        width,
        height,
      }}
      onClick={() => {
        setIsChecked((isChecked) => !isChecked);
      }}
    >
      {isChecked ? checkedContent : uncheckedContent}
    </div>
  );
});
