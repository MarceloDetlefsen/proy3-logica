declare function importScripts(...urls: string[]): void;
declare class Go {
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): Promise<void>;
}

interface WorkerRequest {
  id: number;
  method: string;
  payload: string;
}

let readyPromise: Promise<void> | null = null;

function ensureWasm(): Promise<void> {
  // La promesa se memoriza para cargar wasm_exec.js y logic.wasm una sola vez,
  // aunque lleguen varias peticiones mientras inicializa el worker.
  if (readyPromise) {
    return readyPromise;
  }
  readyPromise = (async () => {
    importScripts("../../wasm_exec.js");
    const go = new Go();
    let instance: WebAssembly.Instance;
    const response = await fetch("../../logic.wasm");
    if (!response.ok) {
      throw new Error(`No se pudo cargar logic.wasm (HTTP ${response.status}).`);
    }
    if (typeof WebAssembly.instantiateStreaming === "function") {
      try {
        const result = await WebAssembly.instantiateStreaming(response.clone(), go.importObject);
        instance = result.instance;
      } catch {
        const bytes = await response.arrayBuffer();
        const result = await WebAssembly.instantiate(bytes, go.importObject);
        instance = result.instance;
      }
    } else {
      const bytes = await response.arrayBuffer();
      const result = await WebAssembly.instantiate(bytes, go.importObject);
      instance = result.instance;
    }
    void go.run(instance);
    const deadline = Date.now() + 5000;
    while (!(globalThis as any).proy3Wasm) {
      if (Date.now() > deadline) {
        throw new Error("El módulo WebAssembly no inicializó a tiempo.");
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  })();
  return readyPromise;
}

self.addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
  // Cada respuesta conserva el id de la petición para permitir concurrencia
  // lógica sobre el mismo canal postMessage.
  const { id, method, payload } = event.data;
  try {
    await ensureWasm();
    const wasmApi = (globalThis as any).proy3Wasm;
    if (!wasmApi || typeof wasmApi[method] !== "function") {
      throw new Error(`Método WASM desconocido: ${method}`);
    }
    const raw = wasmApi[method](payload);
    self.postMessage({ id, ok: true, result: raw });
  } catch (error: any) {
    self.postMessage({
      id,
      ok: false,
      error: error?.message || "Error interno en el worker WebAssembly.",
    });
  }
});
