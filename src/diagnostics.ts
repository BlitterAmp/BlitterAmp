import { invoke } from "@tauri-apps/api/core";

export type DiagnosticLevel = "debug" | "info" | "warn" | "error";
export type DiagnosticSource = "desktop" | "webview" | "server-stdout" | "server-stderr" | "server-lifecycle";

export interface DiagnosticRecord {
  sequence: number;
  timestampMs: number;
  timestamp: string;
  level: DiagnosticLevel;
  source: DiagnosticSource;
  message: string;
}

export interface DiagnosticSnapshot {
  records: DiagnosticRecord[];
  epoch: number;
  persistence: { enabled: boolean; message: string };
}

export function logWebview(entry: {
  level: DiagnosticLevel;
  message: string;
  stack?: string;
  location?: string;
}) {
  return invoke("frontend_log", { entry });
}
