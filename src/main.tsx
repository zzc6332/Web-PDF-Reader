// import React from "react";
import ReactDOM from "react-dom/client";
import App from "src/App.tsx";
import "uno.css";
import "./index.css";
import "src/globals/index";
import "./assets/icons/icons.js";
import "@unocss/reset/tailwind-compat.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  // <React.StrictMode>
  <App />
  // </React.StrictMode>
);