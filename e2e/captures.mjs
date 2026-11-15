import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(here, "..");
const outDir = path.join(rootDir, "docs", "captures");
const port = process.env.CAPTURE_PORT || "18769";
const baseUrl = `http://127.0.0.1:${port}/`;
const executablePath = process.env.CHROMIUM_PATH || "/usr/bin/chromium";
const binPath = path.join(os.tmpdir(), `proy3-logica-captures-${process.pid}`);

async function waitForHealth(url) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry until ready
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`El servidor no respondió en ${url}`);
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  execSync("npm run build:web", { cwd: rootDir, stdio: "inherit" });
  execSync(`go build -o "${binPath}" .`, { cwd: rootDir, stdio: "inherit" });

  const server = spawn(binPath, [], {
    cwd: rootDir,
    env: { ...process.env, ADDR: `127.0.0.1:${port}` },
    stdio: "inherit",
  });

  let browser;
  try {
    await waitForHealth(`${baseUrl}healthz`);
    browser = await chromium.launch({ executablePath, headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      reducedMotion: "no-preference",
    });
    await context.addInitScript(() => {
      localStorage.setItem("parcial3-tutorial-v2", "1");
      localStorage.setItem("parcial3-theme", "grafito");
    });

    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator("#enter-evaluator").click();
    await page.locator("#evaluator-workspace").waitFor({ state: "visible" });

    // Cargar un ejemplo didáctico rico y evaluarlo
    await page.locator("#toggle-examples").click();
    await page.locator("#examples-panel").waitFor({ state: "visible" });
    await page.locator("#examples-grid .example-card").nth(2).click();
    await page.locator("#evaluation.active").waitFor({ state: "visible" });
    await page.locator("#evaluate:not([disabled])").waitFor({ state: "visible" });
    await page.locator("#evaluate").click();
    await page.locator("#result .result-badge, #result strong").first().waitFor({ state: "visible" });
    await page.waitForTimeout(300);

    await page.screenshot({ path: path.join(outDir, "principal.png") });

    // Fase 01: Lenguaje
    await page.locator('.step-link[data-phase="language"]').click();
    await page.locator("#language.active").waitFor({ state: "visible" });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(outDir, "lenguaje.png") });

    // Fase 02: Interpretación
    await page.locator('.step-link[data-phase="interpretation"]').click();
    await page.locator("#interpretation.active").waitFor({ state: "visible" });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(outDir, "interpretacion.png") });

    // Fase 03: Fórmula
    await page.locator('.step-link[data-phase="formula"]').click();
    await page.locator("#formula.active").waitFor({ state: "visible" });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(outDir, "formula.png") });

    // Fase 04: Explicación paso a paso
    await page.locator('.step-link[data-phase="evaluation"]').click();
    await page.locator("#evaluation.active").waitFor({ state: "visible" });
    const nextBtn = page.getByRole("button", { name: /Revelar siguiente nodo/i });
    if (await nextBtn.isVisible() && await nextBtn.isEnabled()) {
      await nextBtn.click();
      await page.waitForTimeout(150);
    }
    await page.locator("#result").scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(outDir, "explicacion.png") });

    // Historia (Capítulo 1 en modo enfoque)
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator("#toggle-history").click();
    await page.locator("#history-view").waitFor({ state: "visible" });
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(outDir, "historia.png") });

    // Historia: Capítulo 8 (Gödel y codificador interactivo)
    await page.locator(".history-step").nth(7).click();
    await page.locator("#godel-input").waitFor({ state: "visible" });
    await page.locator(".history-demo-card").scrollIntoViewIfNeeded();
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(outDir, "historia-godel.png") });

    console.log("Capturas generadas correctamente en", outDir);
  } finally {
    if (browser) await browser.close();
    if (!server.killed) server.kill("SIGTERM");
    try {
      fs.unlinkSync(binPath);
    } catch {
      // ignorar si ya no existe
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
