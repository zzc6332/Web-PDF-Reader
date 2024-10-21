import { memo, useEffect, useRef, useState } from "react";
import Props from "src/types/props";
import { colors } from "src/configs/theme";

interface ToggleButtonProps extends Omit<Props, "defaultValue"> {
  width?: string;
  height?: string;
  checkedColor?: string;
  checkedHoverColor?: string;
  checkedActiveColor?: string;
  checkedBorderColor?: string;
  checkedContent?: React.ReactNode;
  uncheckedColor?: string;
  uncheckedHoverColor?: string;
  uncheckedActiveColor?: string;
  uncheckedBorderColor?: string;
  uncheckedContent?: React.ReactNode;
  onToggle?: (isChecked: boolean) => void;
  onClick?: () => void;
  defaultValue?: boolean;
  value?: boolean;
  disabled?: boolean;
}

export default memo(function ToggleButton({
  className: classNameProp,
  width = "2rem",
  height = "2rem",
  checkedColor = colors["pri-1"],
  checkedHoverColor = colors["pri-0"],
  checkedActiveColor = colors["pri-1"],
  checkedBorderColor = "transparent",
  checkedContent = <span className="text-xs text-bg-1">ON</span>,
  uncheckedColor = colors["bg-2"],
  uncheckedHoverColor = colors["bg-3"],
  uncheckedActiveColor = colors["bg-2"],
  uncheckedBorderColor = colors["border-l2"],
  uncheckedContent = <span className="text-xs">OFF</span>,
  onToggle,
  onClick,
  defaultValue = true,
  value,
  disabled = false,
}: ToggleButtonProps) {
  const className = classNameProp || "";
  const [isChecked, setIsChecked] = useState(
    value === undefined ? defaultValue : value
  );

  useEffect(() => {
    setIsChecked(value === undefined ? defaultValue : value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const [isInitialed, setIsInitialed] = useState(false);

  const buttonElRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const style = buttonElRef.current?.style;
    if (!style) return;
    style.setProperty("--chekedColor", checkedColor);
    style.setProperty("--checkedHoverColor", checkedHoverColor);
    style.setProperty("--checkedActiveColor", checkedActiveColor);
    style.setProperty("--checkedBorderColor", checkedBorderColor);
    style.setProperty("--uncheckedColor", uncheckedColor);
    style.setProperty("--uncheckedColor", uncheckedColor);
    style.setProperty("--uncheckedHoverColor", uncheckedHoverColor);
    style.setProperty("--uncheckedActiveColor", uncheckedActiveColor);
    style.setProperty("--uncheckedBorderColor", uncheckedBorderColor);
  }, [
    checkedBorderColor,
    checkedActiveColor,
    checkedColor,
    checkedHoverColor,
    uncheckedBorderColor,
    uncheckedActiveColor,
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
      "--activeColor",
      isChecked
        ? style.getPropertyValue("--checkedActiveColor")
        : style.getPropertyValue("--uncheckedActiveColor")
    );
    style.setProperty(
      "--borderColor",
      isChecked
        ? style.getPropertyValue("--checkedBorderColor")
        : style.getPropertyValue("--uncheckedBorderColor")
    );
    if (onToggle && isInitialed) {
      onToggle(isChecked);
    } else {
      setIsInitialed(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isChecked]);

  const buttonStyleClassName =
    "bg-[var(--color)] hover:bg-[var(--hoverColor)] active:bg-[var(--activeColor)] outline outline-1 outline-[var(--borderColor)] flex justify-center items-center hover:cursor-pointer ";

  return (
    <div
      ref={buttonElRef}
      className={
        `rounded-1 box-border select-none ` + buttonStyleClassName + className
      }
      style={{
        width,
        height,
      }}
      onClick={() => {
        if (!disabled) setIsChecked((isChecked) => !isChecked);
        if (onClick) onClick();
      }}
    >
      {isChecked ? checkedContent : uncheckedContent}
    </div>
  );
});
