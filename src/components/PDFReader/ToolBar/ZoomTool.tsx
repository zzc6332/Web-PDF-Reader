import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Icon,
  IconProps,
} from "src/components/GlobalComponents/globalComponents";
import Props from "src/types/props";
import usePdfReaderStore from "src/stores/usePdfReaderStore";
import { debounce } from "lodash-es";
import { colors } from "src/configs/theme";
import { Slider, AutoComplete } from "@douyinfe/semi-ui";

interface ZoomToolsProps extends Props {
  iconProps: Omit<IconProps, "type">;
}

//#region - Slider 相关静态参数和工具函数

// sliderStep 是 Slider 组件的步长
const sliderStep = 0.1;

/**
 * sliderToScale 接收一个 sliderValue，将其映射为 scaleValue
 * @param sliderValue
 * @returns 映射后的 scaleValue
 */
function sliderToScale(sliderValue: number) {
  return 0.25 * (sliderValue + 1);
}

/**
 * scaleToSlider 接收一个 scaleValue，将其映射为 sliderValue
 * @param receivedScaleValue
 * @returns 映射后的 sliderValue
 */
function scaleToSlider(scaleValue: number) {
  return 4 * scaleValue - 1;
}

//#endregion

//#region - AutoComplete 相关静态参数和工具函数

/**
 * numToPercentage 将一个数字转换为一个不保留小数部分的百分数字符串
 * @param num
 * @returns
 */
function numToPercentage(num: number) {
  return (num * 100).toFixed(0) + "%";
}

/**
 * percentageToNum 将一个百分比字符串转换为一个数字
 * @param percentage
 * @returns
 */
function percentageToNum(percentage: string) {
  const numPart = percentage.match(/^(\d+(?:\.\d+)?)%$/)?.[1];
  if (!numPart)
    throw new Error("percentageToNum(percentage) 需要接收一个百分数字符串");
  return Math.floor(+numPart) / 100;
}

//#endregion

export default memo(function ZoomTool({
  className: classNameProp,
  iconProps,
}: ZoomToolsProps) {
  const className = classNameProp || "";

  //#region - 从 store 中获取 state

  const scale = usePdfReaderStore((s) => s.scale);
  const viewScale = usePdfReaderStore((s) => s.viewScale);
  const setViewScale = usePdfReaderStore((s) => s.setViewScale);
  const commitScale = usePdfReaderStore((s) => s.commitScale);
  const viewScaleRange = usePdfReaderStore((s) => s.viewScaleRange);
  const getSafeScaleValue = usePdfReaderStore((s) => s.getSafeScaleValue);

  const commitScaleImmediately = (scale?: number) => {
    commitScaleOnClick.cancel();
    commitScaleOnDrag.cancel();
    // 为了确保调用 commitScale 时，viewScale 已更新，因此将其异步调用
    Promise.resolve().then(() => {
      commitScale(scale);
    });
    // console.log("0");
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const commitScaleOnClick = useCallback(
    debounce((scale?: number) => {
      commitScaleOnDrag.cancel();
      commitScale(scale);
      // console.log("200");
    }, 200),
    []
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const commitScaleOnDrag = useCallback(
    debounce((scale?: number) => {
      commitScaleOnClick.cancel();
      commitScale(scale);
      // console.log("500");
    }, 500),
    []
  );

  //#endregion

  //#region - Slider 组件相关

  //#region - SLider 组件相关初始参数
  const sliderValueRange: number[] = useMemo(
    () => viewScaleRange.map((viewScaleValue) => scaleToSlider(viewScaleValue)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewScaleRange]
  );

  const [sliderMinValue, sliderMaxValue] = sliderValueRange;

  /**
   * setSliderValueSafely 用于将输入参数转换到合法范围内后设置给 sliderValue
   * 除了由 Slider 组件本身提供的 sliderValue 值，其它任何来源的 sliderValue 都必须通过 setSliderValueSafely 来设置，而不是直接使用 setSliderValue，这样能保证 sliderValue 的值一定在预期范围内
   * @param n
   * @returns
   */
  function setSliderValueSafely(n: number) {
    const range = sliderValueRange;
    const safeSliderValue = Math.max(Math.min(n, range[1]), range[0]);
    if (safeSliderValue !== sliderValue) {
      setSliderValue(safeSliderValue);
    }
  }

  // 用户点击放大、缩小按钮时，偏移 sliderValue 的值
  function offsetSliderValue(n: number) {
    const offset = Math.round(n / sliderStep) * sliderStep;
    const targetValue = sliderValue + offset;
    setSliderValueSafely(Math.round(targetValue / offset) * offset);
  }

  //#endregion

  // sliderValue 是受控组件 Slider 上的 value，确保只通过 setSliderValueSafely 来修改它的值，使得它的范围永远符合预期
  const [sliderValue, setSliderValue] = useState(scaleToSlider(scale));

  // 组件刚加载时获取初始的 sliderValue
  const [isSliderValueInitialed, setIsSliderValueInitialed] = useState(false);
  useEffect(() => {
    setSliderValueSafely(scaleToSlider(scale));
    setIsSliderValueInitialed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // scaleValue 是根据 sliderValue 的值映射出来的缩放比
  const scaleValue = sliderToScale(sliderValue);

  // store 中的 viewScale 被 sliderValue 管理
  useEffect(() => {
    if (viewScale !== scaleValue) {
      setViewScale(scaleValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sliderValue]);

  // 如果 viewScale 发生了变化，sliderValue 也同步改变
  useEffect(() => {
    // 初始化完成后才开始同步
    if (!isSliderValueInitialed) return;
    const newSliderValue = scaleToSlider(viewScale);
    if (Math.abs(sliderValue - newSliderValue) >= sliderStep) {
      setSliderValueSafely(newSliderValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewScale]);

  // Slider 组件 Dom 获取，为不同 DOM 处理监听事件
  const sliderRef = useRef<HTMLDivElement>(null);

  const sliderHandleEl =
    (sliderRef.current?.childNodes[0].childNodes[0].childNodes[2]
      .childNodes[0] as HTMLSpanElement | undefined) || null;

  const sliderRailEl =
    (sliderRef.current?.childNodes[0].childNodes[0].childNodes[0] as
      | HTMLDivElement
      | undefined) || null;

  const sliderTrackEl =
    (sliderRef.current?.childNodes[0].childNodes[0].childNodes[1] as
      | HTMLDivElement
      | undefined) || null;

  useEffect(() => {
    if (!sliderHandleEl) return;
    const mutationCallback: MutationCallback = (mutationsList) => {
      const mutation = mutationsList.find((item) => item.type === "attributes");
      if (
        mutation &&
        Array.from((mutation.target as HTMLSpanElement).classList).indexOf(
          "semi-slider-handle-clicked"
        ) === -1
      ) {
        commitScaleImmediately();
      }
    };

    const observer = new MutationObserver(mutationCallback);

    observer.observe(sliderHandleEl, { attributeFilter: ["class"] });
    return () => {
      const mutations = observer.takeRecords();
      mutationCallback(mutations, observer);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sliderHandleEl]);

  //#endregion

  //#region - AutoComplete 组件相关

  // scaleValue 映射为 scalePercentage 字符串
  const scalePercentage = numToPercentage(scaleValue);

  // autoCompleteValue 用于绑定给 AutoComplete 组件的 value
  const [autoCompleteValue, setAutoCompletetValue] = useState("");

  // sliderValue 绑定给 autoCompleteValue
  useEffect(() => {
    setAutoCompletetValue(scalePercentage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sliderValue]);

  // 用户在 AutoComplete 组件中输入内容后提交，将其同步给 sliderValue 并触发渲染
  function handleAutoCompleteCommit() {
    let value: string;
    if (/^(\d+(?:\.\d+)?%)$/.test(autoCompleteValue)) {
      value = autoCompleteValue;
    } else if (/^(\d+(?:\.\d+)?)$/.test(autoCompleteValue)) {
      value = autoCompleteValue + "%";
    } else {
      setAutoCompletetValue(scalePercentage);
      return;
    }
    const scaleValue = getSafeScaleValue(percentageToNum(value));
    const sliderValue = scaleToSlider(scaleValue);
    setSliderValueSafely(sliderValue);
    commitScaleImmediately();
    // 为了避免一些情况下 autoCompletetValue 没有更新，此处手动更新一下
    setAutoCompletetValue(numToPercentage(scaleValue));
  }

  // AutoComplete 中输入内容时弹出下拉列表
  const zoomOptions = ["原始大小", "适应宽度", "适应高度"];

  // 选中下拉列表内容
  const getScaleToFitClient = usePdfReaderStore((s) => s.getScaleToFitClient);
  const offsetCurrentPageNum = usePdfReaderStore((s) => s.offsetCurrentPageNum);

  function handleAutoCompleteSearch(value: string) {
    setAutoCompletetValue(value + "");
  }
  function handleAutoCompleteChange(value: string | number) {
    switch (value) {
      case "原始大小":
        setAutoCompletetValue("100%");
        // setSliderValueSafely(scaleToSlider(1));
        setViewScale(1);
        commitScaleImmediately();
        break;
      case "适应宽度":
        {
          const scale = getScaleToFitClient(true);
          if (!scale) break;
          setAutoCompletetValue(numToPercentage(scale));
          setViewScale(scale);
          commitScaleImmediately();
        }
        break;
      case "适应高度":
        {
          const scale = getScaleToFitClient(false);
          if (!scale) break;
          setAutoCompletetValue(numToPercentage(scale));
          offsetCurrentPageNum(0);
          setViewScale(scale, null, 0);
          commitScaleImmediately();
        }
        break;
    }
  }

  //#endregion

  return (
    <div className={className}>
      <Icon
        type="#icon-minus"
        {...iconProps}
        onClick={() => {
          offsetSliderValue(-0.5);
          commitScaleOnClick();
        }}
      ></Icon>
      {/*
         semi-ui 的 Slider 组件的 onMouseUp 触发时机不可控（有bug），因此使用一个 div 包裹来处理点击 rail 和 track 的事件
         见 https://github.com/DouyinFE/semi-design/issues/2171
       */}
      <div
        ref={sliderRef}
        onClick={(e) => {
          if (e.target === sliderTrackEl || e.target === sliderRailEl) {
            commitScaleOnClick();
          }
        }}
      >
        <Slider
          className="w-20 select-none max-sm:hidden lg:w-60 md:w-40 sm:w-20"
          value={sliderValue}
          max={sliderMaxValue}
          min={sliderMinValue}
          step={sliderStep}
          tipFormatter={(n) => {
            if (n !== undefined) {
              return scalePercentage;
            }
          }}
          onChange={(value) => {
            setSliderValue(value as number);
            commitScaleOnDrag();
          }}
        />
      </div>
      <Icon
        type="#icon-plus"
        {...iconProps}
        onClick={() => {
          offsetSliderValue(0.5);
          commitScaleOnClick();
        }}
      ></Icon>
      <div className="select-none">
        <AutoComplete
          className="ml-2 w-22"
          value={autoCompleteValue}
          data={zoomOptions}
          onSearch={handleAutoCompleteSearch}
          onChange={handleAutoCompleteChange}
          onBlur={handleAutoCompleteCommit}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") {
              handleAutoCompleteCommit();
            }
          }}
        />
        <Icon
          type="#icon-arrow-down"
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
          color={colors["on-bg-2"]}
        />
      </div>
    </div>
  );
});
