import { execSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(here, "..");
const distDir = path.join(rootDir, "dist");
const port = Number(process.env.PAGES_PORT || 18766);
const prefix = "/proy3-logica";

execSync("./scripts/build-pages.sh", { cwd: rootDir, stdio: "inherit" });

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url || "/", `http://127.0.0.1:${port}`);
  let pathname = decodeURIComponent(reqUrl.pathname);

  if (pathname === prefix) {
    res.writeHead(302, { Location: `${prefix}/` });
    res.end();
    return;
  }

  if (!pathname.startsWith(`${prefix}/`)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  let relPath = pathname.slice(`${prefix}/`.length);
  if (relPath === "" || relPath.endsWith("/")) {
    relPath = path.join(relPath, "index.html");
  }

  const filePath = path.resolve(distDir, relPath);
  if (!filePath.startsWith(distDir + path.sep) && filePath !== distDir) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Pages server listening on http://127.0.0.1:${port}${prefix}/`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
