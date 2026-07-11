import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./app.css";
import { initThemes } from "./state/theme";

// The theme keys macOS traffic-light padding off this attribute.
document.documentElement.dataset.platform = navigator.userAgent.includes("Mac") ? "darwin" : "other";
initThemes();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
