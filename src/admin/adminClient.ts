// Native admin client for the bundled local engine. Routes admin API calls
// through the Rust proxy, which authenticates with the stored admin password
// (the desktop app is the admin of its own engine). Only meaningful for a
// local connection — a paired remote server is administered in its own web
// console, so remote connections never construct one of these.
import { invoke } from "@tauri-apps/api/core";

export class AdminClient {
  constructor(private baseUrl: string) {}

  private call<T>(method: string, path: string, body?: unknown): Promise<T> {
    return invoke<T>("engine_admin", {
      baseUrl: this.baseUrl,
      method,
      path,
      body: body ?? null,
    });
  }

  get<T>(path: string): Promise<T> {
    return this.call<T>("GET", path);
  }
  post<T>(path: string, body?: unknown): Promise<T> {
    return this.call<T>("POST", path, body);
  }
  put<T>(path: string, body?: unknown): Promise<T> {
    return this.call<T>("PUT", path, body);
  }
  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.call<T>("PATCH", path, body);
  }
  del<T>(path: string): Promise<T> {
    return this.call<T>("DELETE", path);
  }
}
