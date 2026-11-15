export type BackendMode = "http" | "wasm";

export interface Transport {
  request<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T>;
  exportDocument(
    body: unknown,
    signal?: AbortSignal,
  ): Promise<{ kind: "pdf" | "tex"; blob: Blob; filename: string }>;
}

const DEFAULT_WASM_TIMEOUT_MS = 10_000;

const WASM_METHODS: Record<string, string> = {
  "api/language/validate": "validateLanguage",
  "api/analyze": "analyze",
  "api/interpretation/validate": "validateInterpretation",
  "api/interpretation/generate": "generateInterpretation",
  "api/evaluate": "evaluate",
};

export function getBackendMode(): BackendMode {
  const configured = (window as any).PROY3_BACKEND;
  return configured === "wasm" ? "wasm" : "http";
}

export function isWasmMode(): boolean {
  return getBackendMode() === "wasm";
}

function normalizeEndpoint(path: string): string {
  return path.replace(/^\/+/, "");
}

class HttpTransport implements Transport {
  async request<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    const response = await fetch(normalizeEndpoint(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `Error HTTP ${response.status}`);
    }
    return data as T;
  }

  async exportDocument(
    body: unknown,
    signal?: AbortSignal,
  ): Promise<{ kind: "pdf" | "tex"; blob: Blob; filename: string }> {
    const response = await fetch("api/evaluate/export/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "No se pudo generar el PDF.");
    }
    return {
      kind: "pdf",
      blob: await response.blob(),
      filename: "resolucion-semantica.pdf",
    };
  }
}

interface PendingCall {
  resolve: (value: string) => void;
  reject: (reason?: any) => void;
  timer: ReturnType<typeof setTimeout>;
  cleanupAbort?: () => void;
}

class WasmTransport implements Transport {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, PendingCall>();
  private timeoutMs: number;

  constructor(timeoutMs = DEFAULT_WASM_TIMEOUT_MS) {
    this.timeoutMs = timeoutMs;
  }

  private ensureWorker(): Worker {
    if (this.worker) {
      return this.worker;
    }
    const worker = new Worker("build/src/worker.js");
    worker.addEventListener("message", (event: MessageEvent) => {
      const { id, ok, result, error } = event.data;
      const entry = this.pending.get(id);
      if (!entry) return;
      this.pending.delete(id);
      clearTimeout(entry.timer);
      entry.cleanupAbort?.();
      if (ok) {
        entry.resolve(result);
      } else {
        entry.reject(new Error(error || "Error en WebAssembly."));
      }
    });
    worker.addEventListener("error", (event) => {
      const message = event.message || "Error inesperado en el Web Worker.";
      this.resetWorker(new Error(message));
    });
    this.worker = worker;
    return worker;
  }

  private resetWorker(reason: Error) {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    for (const [id, entry] of this.pending.entries()) {
      this.pending.delete(id);
      clearTimeout(entry.timer);
      entry.cleanupAbort?.();
      entry.reject(reason);
    }
  }

  private callWorker(method: string, payload: string, signal?: AbortSignal): Promise<any> {
    if (signal?.aborted) {
      return Promise.reject(new DOMException("Operación cancelada.", "AbortError"));
    }
    const worker = this.ensureWorker();
    const id = this.nextId++;

    return new Promise<string>((resolve, reject) => {
      let cleanupAbort: (() => void) | undefined;
      if (signal) {
        const onAbort = () => {
          const entry = this.pending.get(id);
          if (entry) {
            this.pending.delete(id);
            clearTimeout(entry.timer);
            entry.reject(new DOMException("Operación cancelada.", "AbortError"));
          }
        };
        signal.addEventListener("abort", onAbort, { once: true });
        cleanupAbort = () => signal.removeEventListener("abort", onAbort);
      }

      const timer = setTimeout(() => {
        this.pending.delete(id);
        cleanupAbort?.();
        this.resetWorker(
          new Error(
            `La operación excedió el límite de ${Math.round(this.timeoutMs / 1000)} segundos en el navegador. Simplifica la fórmula o reduce el dominio.`,
          ),
        );
      }, this.timeoutMs);

      this.pending.set(id, { resolve, reject, timer, cleanupAbort });
      worker.postMessage({ id, method, payload });
    }).then((raw) => {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.__httpError) {
        throw new Error(parsed.message || `Error ${parsed.status || 500}`);
      }
      return parsed;
    });
  }

  async request<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    const normalized = normalizeEndpoint(path);
    const method = WASM_METHODS[normalized];
    if (!method) {
      throw new Error(`Endpoint no soportado en modo WASM: ${path}`);
    }
    return this.callWorker(method, JSON.stringify(body), signal) as Promise<T>;
  }

  async exportDocument(
    body: unknown,
    signal?: AbortSignal,
  ): Promise<{ kind: "pdf" | "tex"; blob: Blob; filename: string }> {
    const data = await this.callWorker("exportEvaluationTeX", JSON.stringify(body), signal);
    if (Array.isArray(data?.errors) && data.errors.length > 0) {
      throw new Error(data.errors.map((err: any) => err.message).join(" "));
    }
    if (typeof data?.tex !== "string") {
      throw new Error("No se pudo generar el documento LaTeX.");
    }
    return {
      kind: "tex",
      blob: new Blob([data.tex], { type: "application/x-tex;charset=utf-8" }),
      filename: "resolucion-semantica.tex",
    };
  }
}

const httpTransport = new HttpTransport();
const wasmTransport = new WasmTransport();

export function getTransport(): Transport {
  return isWasmMode() ? wasmTransport : httpTransport;
}
