import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./app.css";
import { initThemes } from "./state/theme";
import { logWebview } from "./diagnostics";

// Window chrome and macOS traffic-light padding key off this attribute.
document.documentElement.dataset.platform = navigator.userAgent.includes("Mac")
  ? "darwin"
  : navigator.userAgent.includes("Linux")
    ? "linux"
    : "other";
initThemes();
// Surface webview errors to the process stderr — the packaged app has no
// reachable devtools, so this is how a running build is diagnosed.
const safeText = (value: unknown) => value instanceof Error ? value.message : typeof value === "string" ? value : "Non-Error rejection";
window.addEventListener("error", (e) => void logWebview({
  level: "error",
  message: e.message || "Window error",
  stack: e.error instanceof Error ? e.error.stack : undefined,
  location: e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : undefined,
}).catch(() => {}));
window.addEventListener("unhandledrejection", (e) => void logWebview({
  level: "error",
  message: `Unhandled rejection: ${safeText(e.reason)}`,
  stack: e.reason instanceof Error ? e.reason.stack : undefined,
}).catch(() => {}));

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
