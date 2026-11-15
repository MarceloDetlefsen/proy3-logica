import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
export const SCREENSHOTS_DIR = path.resolve(here, "../screenshots");

export const VIEWPORTS_FULL = [
  { name: "1920x1080", width: 1920, height: 1080, isTouch: false },
  { name: "1440x900", width: 1440, height: 900, isTouch: false },
  { name: "1366x768", width: 1366, height: 768, isTouch: false },
  { name: "1280x720", width: 1280, height: 720, isTouch: false },
  { name: "1024x768", width: 1024, height: 768, isTouch: false },
  { name: "768x1024", width: 768, height: 1024, isTouch: true },
  { name: "390x844", width: 390, height: 844, isTouch: true },
];

export const VIEWPORTS_FAST = [
  { name: "1920x1080", width: 1920, height: 1080, isTouch: false },
  { name: "1280x720", width: 1280, height: 720, isTouch: false },
  { name: "390x844", width: 390, height: 844, isTouch: true },
];

export const THEMES = [
  { id: "grafito", label: "oscuro", colorScheme: "dark" },
  { id: "papel", label: "claro", colorScheme: "light" },
];

export const REDUCED_MOTIONS = ["no-preference", "reduce"];

export function attachDiagnostics(page) {
  const consoleErrors = [];
  const consoleWarnings = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on("console", (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (type === "error") {
      consoleErrors.push(text);
    } else if (type === "warning") {
      // Ignore third-party browser deprecation noise if any, capture app warnings
      consoleWarnings.push(text);
    }
  });

  page.on("pageerror", (err) => {
    pageErrors.push(String(err));
  });

  page.on("requestfailed", (req) => {
    failedRequests.push(`${req.method()} ${req.url()} (${req.failure()?.errorText || "failed"})`);
  });

  page.on("response", (res) => {
    if (res.status() >= 400) {
      failedRequests.push(`${res.status()} ${res.url()}`);
    }
  });

  return {
    assertClean(contextLabel = "") {
      const prefix = contextLabel ? `[${contextLabel}] ` : "";
      expect(consoleErrors, `${prefix}Errores de consola`).toEqual([]);
      expect(consoleWarnings, `${prefix}Warnings de consola`).toEqual([]);
      expect(pageErrors, `${prefix}Errores no capturados (pageerror)`).toEqual([]);
      expect(failedRequests, `${prefix}Peticiones fallidas o 404`).toEqual([]);
    },
  };
}

export async function suppressAutoTutorial(context) {
  await context.addInitScript(() => {
    try {
      localStorage.setItem("parcial3-tutorial-v2", "1");
    } catch {
      // ignore
    }
  });
}

export async function dismissTutorial(page) {
  const tutorial = page.locator("#tutorial");
  if (await tutorial.isVisible().catch(() => false)) {
    const closeBtn = page.locator("#close-tutorial");
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
    }
    await expect(tutorial).toHaveClass(/hidden/);
  }
}

export async function enterEvaluator(page) {
  const enterBtn = page.locator("#enter-evaluator");
  if (await enterBtn.isVisible()) {
    await enterBtn.click();
  }
  await expect(page.locator("#evaluator-workspace")).not.toHaveClass(/hidden/);
  await dismissTutorial(page);
}

export async function selectTheme(page, themeId) {
  await page.click("#open-appearance");
  const radio = page.locator(`input[name="appearance"][value="${themeId}"]`);
  await radio.check({ force: true });
  await page.click("#open-appearance");
  await expect(page.locator("html")).toHaveAttribute("data-theme", themeId);
}

export async function assertNoHorizontalScroll(page, contextLabel = "") {
  const { scrollWidth, clientWidth, culprits } = await page.evaluate(() => {
    const cw = document.documentElement.clientWidth;
    const sw = document.documentElement.scrollWidth;
    const found = [];
    if (sw > cw) {
      for (const el of document.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > cw + 0.5) {
          found.push(`${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : ""} (right=${r.right.toFixed(1)})`);
          if (found.length >= 5) break;
        }
      }
    }
    return { scrollWidth: sw, clientWidth: cw, culprits: found };
  });
  expect(
    scrollWidth,
    `${contextLabel}: scrollWidth (${scrollWidth}) supera clientWidth (${clientWidth}). Culprits: ${culprits.join(", ")}`
  ).toBeLessThanOrEqual(clientWidth);
}

export async function assertAxeClean(page, contextLabel = "") {
  const results = await new AxeBuilder({ page })
    .withRules([
      "color-contrast",
      "aria-hidden-focus",
      "button-name",
      "image-alt",
      "aria-allowed-attr",
    ])
    .analyze();
  expect(
    results.violations,
    `${contextLabel}: violaciones axe-core: ${JSON.stringify(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.length })), null, 2)}`
  ).toEqual([]);
}

export async function saveScreenshot(page, scenario, viewportName, themeLabel) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const filePath = path.join(SCREENSHOTS_DIR, `${scenario}-${viewportName}-${themeLabel}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  return filePath;
}
