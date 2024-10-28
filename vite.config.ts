import { defineConfig } from "vite";
import UnoCSS from "unocss/vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import topLevelAwait from "vite-plugin-top-level-await";
// import SemiPlugin from "vite-plugin-semi-theme";
import SemiPlugin from "./vite-plugins/vite-plugin-semi-theme";
import checker from "vite-plugin-checker";

// https://vitejs.dev/config/
export default defineConfig({
  base: "./",
  server: {
    host: "0.0.0.0",
  },
  build: {
    rollupOptions: {
      output: {
        format: "es",
      },
    },
  },
  worker: {
    format: "es",
    rollupOptions: {
      output: {
        dir: "./dist/worker",
      },
    },
  },
  assetsInclude: ["./statics/*"],
  plugins: [
    checker({ typescript: false }),
    UnoCSS({
      configFile: "./uno.config.ts",
    }),
    react(),
    tsconfigPaths(),
    topLevelAwait({
      // The export name of top-level await promise for each chunk module
      promiseExportName: "__tla",
      // The function to generate import names of top-level await promise in each chunk module
      promiseImportName: (i) => `__tla_${i}`,
    }),
    SemiPlugin({
      theme: "@semi-bot/semi-theme-together",
      include: "~@semi-bot/semi-theme-together/scss/local.scss",
    }),
  ],
});
