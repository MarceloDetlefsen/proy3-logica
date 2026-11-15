import { test, expect } from "@playwright/test";
import {
  VIEWPORTS_FAST,
  VIEWPORTS_FULL,
  THEMES,
  attachDiagnostics,
  suppressAutoTutorial,
  enterEvaluator,
  selectTheme,
  assertNoHorizontalScroll,
  assertAxeClean,
  saveScreenshot,
} from "./helpers.mjs";

const isFast = process.env.E2E_MODE === "fast";
const viewports = isFast ? VIEWPORTS_FAST : VIEWPORTS_FULL;

test.describe("Evaluador y buscador de modelos", () => {
  for (const vp of viewports) {
    for (const theme of THEMES) {
      const fastTag =
        VIEWPORTS_FAST.some((f) => f.name === vp.name) ? " @fast" : "";

      test(`evaluador vacío, ejemplo evaluado con árbol y buscador (${vp.name}, ${theme.label})${fastTag}`, async ({
        browser,
      }, testInfo) => {
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          colorScheme: theme.colorScheme,
          hasTouch: vp.isTouch,
        });
        await suppressAutoTutorial(context);
        const page = await context.newPage();
        const diag = attachDiagnostics(page);

        await page.goto("./", { waitUntil: "networkidle" });
        await enterEvaluator(page);
        await selectTheme(page, theme.id);

        // 1. Evaluador vacío
        await expect(page.locator("#stage-title")).toBeVisible();
        await assertNoHorizontalScroll(page, `evaluador vacío ${vp.name} ${theme.label}`);
        await assertAxeClean(page, `evaluador vacío ${vp.name} ${theme.label}`);
        if (testInfo.repeatEachIndex === 0) {
          await saveScreenshot(page, "evaluador-vacio", vp.name, theme.label);
        }

        // 2. Cargar ejemplo y evaluar con árbol paso a paso
        await page.click("#toggle-examples");
        await expect(page.locator("#examples-panel")).not.toHaveClass(/hidden/);
        const firstExample = page.locator("#examples-grid .example-card").first();
        await expect(firstExample).toBeVisible();
        await firstExample.click();

        await expect(page.locator("#examples-panel")).toHaveClass(/hidden/);
        await expect(page.locator("#evaluate")).toBeEnabled();
        await expect(page.locator("#evaluate")).toBeFocused();

        await page.click("#evaluate");
        await expect(page.locator("#result .result-badge, #result strong").first()).toBeVisible();

        const nextStepBtn = page.getByRole("button", { name: /Revelar siguiente nodo/i });
        if (await nextStepBtn.count()) {
          await nextStepBtn.click();
        }
        await assertNoHorizontalScroll(page, `evaluador resultado ${vp.name} ${theme.label}`);
        if (testInfo.repeatEachIndex === 0) {
          await saveScreenshot(page, "evaluador-evaluado", vp.name, theme.label);
        }

        // 3. Buscador de modelos y contramodelos (con límite N = 2)
        await page.fill("#model-search-limit", "2");
        await page.click("#search-models");
        await expect(page.locator("#model-search-results")).not.toBeEmpty({ timeout: 15_000 });
        await assertNoHorizontalScroll(page, `buscador modelos ${vp.name} ${theme.label}`);
        if (testInfo.repeatEachIndex === 0) {
          await saveScreenshot(page, "buscador-modelos", vp.name, theme.label);
        }

        diag.assertClean(`evaluador ${vp.name} ${theme.label}`);
        await context.close();
      });
    }
  }

  test("modo ?mock=1 responde coherentemente en /api/models/search @fast", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    await suppressAutoTutorial(context);
    const page = await context.newPage();
    const diag = attachDiagnostics(page);

    await page.goto("./?mock=1", { waitUntil: "networkidle" });
    await enterEvaluator(page);
    await page.click("#toggle-examples");
    await page.locator("#examples-grid .example-card").first().click();
    await page.fill("#model-search-limit", "2");
    await page.click("#search-models");
    await expect(page.locator("#model-search-results")).not.toBeEmpty();
    await expect(page.locator("#model-search-status")).not.toContainText(/error/i);

    diag.assertClean("mock=1 model search");
    await context.close();
  });
});
