import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(here, "..");
const port = process.env.SERVER_PORT || "18765";
const addr = `127.0.0.1:${port}`;
const binPath = path.join(os.tmpdir(), `proy3-logica-e2e-${process.pid}`);

execSync("npm run build:web", { cwd: rootDir, stdio: "inherit" });
execSync(`go build -o "${binPath}" .`, { cwd: rootDir, stdio: "inherit" });

const child = spawn(binPath, [], {
  cwd: rootDir,
  env: { ...process.env, ADDR: addr },
  stdio: "inherit",
});

function cleanup() {
  if (!child.killed) {
    child.kill("SIGTERM");
  }
  try {
    fs.unlinkSync(binPath);
  } catch {
    // ignore cleanup errors
  }
}

process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});
child.on("exit", (code) => {
  try {
    fs.unlinkSync(binPath);
  } catch {
    // ignore
  }
  process.exit(code ?? 0);
});
