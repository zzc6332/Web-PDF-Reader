import { defineConfig, presetUno } from "unocss";
import presetAttributify from "@unocss/preset-attributify";
import transformerAttributifyJsx from "@unocss/transformer-attributify-jsx";

const colors = {
  "pri-0": "var(--pri-0)",
  "pri-1": "var(--pri-1)",
  "pri-2": "var(--pri-2)",
  "pri-3": "var(--pri-3)",
  "bg-1": "var(--bg-1)",
  "bg-2": "var(--bg-2)",
  "bg-3": "var(--bg-3)",
  "bg-translucence-1": "var(--bg-translucence-1)",
  "bg-translucence-2": "var(--bg-translucence-2)",
  "bg-translucence-3": "var(--bg-translucence-3)",
  "on-bg-1": "var(--on-bg-1)",
  "on-bg-2": "var(--on-bg-2)",
  "on-bg-3": "var(--on-bg-3)",
  "on-pri-1": "var(--on-pri-1)",
  "on-pri-2": "var(--on-pri-2)",
  "on-pri-3": "var(--on-pri-3)",
  "border-l1": "var(--border-l1)",
  "border-l2": "var(--border-l2)",
  "border-l3": "var(--border-l3)",
};

const theme = {
  colors,
};

export default defineConfig({
  presets: [
    presetAttributify({
      prefixedOnly: true,
      prefix: "un-",
    }),
    presetUno(),
  ],
  transformers: [transformerAttributifyJsx()],
  theme,
  rules: [
    [
      "transform-cpu",
      {
        transform:
          "translateX(var(--un-translate-x)) translateY(var(--un-translate-y)) rotate(var(--un-rotate)) skewX(var(--un-skew-x)) skewY(var(--un-skew-y)) scaleX(var(--un-scale-x)) scaleY(var(--un-scale-y))",
      },
    ],
    [
      "shadow-l1",
      {
        "box-shadow": "0 0 0 1px var(--border-l1)",
      },
    ],
    [
      "outline-l1",
      {
        outline: "1px solid var(--border-l1)",
      },
    ],
    [
      "outline-l2",
      {
        outline: "1px solid var(--border-l2)",
      },
    ],
    [
      "outline-l3",
      {
        outline: "1px solid var(--border-l3)",
      },
    ],
  ],
});
