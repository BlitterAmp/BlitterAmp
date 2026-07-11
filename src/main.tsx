import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./app.css";
import { invoke } from "@tauri-apps/api/core";
import { initThemes } from "./state/theme";

// The theme keys macOS traffic-light padding off this attribute.
document.documentElement.dataset.platform = navigator.userAgent.includes("Mac") ? "darwin" : "other";
initThemes();
// Surface webview errors to the process stderr — the packaged app has no
// reachable devtools, so this is how a running build is diagnosed.
const flog = (m: string) => void invoke("frontend_log", { message: m }).catch(() => {});
window.addEventListener("error", (e) => flog(`error: ${e.message}`));
window.addEventListener("unhandledrejection", (e) => flog(`unhandledrejection: ${String((e as PromiseRejectionEvent).reason)}`));

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
