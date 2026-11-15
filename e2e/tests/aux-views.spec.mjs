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

const LESSONS = ["start", "language", "interpretation", "formula", "result", "search_export"];

test.describe("Vistas auxiliares, exclusividad y navegación", () => {
  for (const vp of viewports) {
    for (const theme of THEMES) {
      const fastTag =
        VIEWPORTS_FAST.some((f) => f.name === vp.name) ? " @fast" : "";

      test(`exclusividad, 6 lecciones de Aprender y Ejemplos (${vp.name}, ${theme.label})${fastTag}`, async ({
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

        // Abrir Aprender y luego Ejemplos: solo una debe quedar visible
        await page.click("#toggle-learn");
        await expect(page.locator("#learning-view")).not.toHaveClass(/hidden/);
        await expect(page.locator("#examples-panel")).toHaveClass(/hidden/);

        await page.click("#toggle-examples");
        await expect(page.locator("#examples-panel")).not.toHaveClass(/hidden/);
        await expect(page.locator("#learning-view")).toHaveClass(/hidden/);
        await assertNoHorizontalScroll(page, `Ejemplos ${vp.name} ${theme.label}`);
        await assertAxeClean(page, `Ejemplos ${vp.name} ${theme.label}`);
        if (testInfo.repeatEachIndex === 0) {
          await saveScreenshot(page, "ejemplos", vp.name, theme.label);
        }

        // Volver a Aprender y recorrer las 6 lecciones
        await page.click("#toggle-learn");
        await expect(page.locator("#learning-view")).not.toHaveClass(/hidden/);
        await expect(page.locator("#examples-panel")).toHaveClass(/hidden/);

        for (const lessonId of LESSONS) {
          await page.click(`.lesson-link[data-lesson="${lessonId}"]`);
          await expect(page.locator("#lesson-content h2")).toBeVisible();
          await assertNoHorizontalScroll(page, `Aprender ${lessonId} ${vp.name} ${theme.label}`);
        }
        await assertAxeClean(page, `Aprender ${vp.name} ${theme.label}`);
        if (testInfo.repeatEachIndex === 0) {
          await saveScreenshot(page, "aprender", vp.name, theme.label);
        }

        // Botón de acción de lección (Hacerlo con un ejemplo o Ir a fase)
        await page.click(`.lesson-link[data-lesson="language"]`);
        const actionBtn = page
          .locator("#lesson-content [data-learning-example], #lesson-content [data-go-phase]")
          .first();
        await expect(actionBtn).toBeVisible();
        await actionBtn.click();
        await expect(page.locator("#learning-view")).toHaveClass(/hidden/);

        diag.assertClean(`aux-views ${vp.name} ${theme.label}`);
        await context.close();
      });
    }
  }

  test("preservación de estado, recarga en #historia/5 y botón Atrás @fast", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    await suppressAutoTutorial(context);
    const page = await context.newPage();
    const diag = attachDiagnostics(page);

    await page.goto("./", { waitUntil: "networkidle" });
    await enterEvaluator(page);

    // Cargar un ejemplo para poblar lenguaje, interpretación y fórmula
    await page.click("#toggle-examples");
    await page.locator("#examples-grid .example-card").first().click();
    await expect(page.locator("#examples-panel")).toHaveClass(/hidden/);
    await expect(page.locator("#evaluate")).toBeFocused();

    const formulaBefore = await page.locator("#formula-input").inputValue();
    expect(formulaBefore.length).toBeGreaterThan(0);

    // Ir a Historia y volver: el estado debe conservarse
    await page.click("#toggle-history");
    await expect(page.locator(".workspace")).toHaveClass(/history-focus/);
    await expect(page.locator("#history-view")).not.toHaveClass(/hidden/);

    await page.click("#history-back-to-work");
    await expect(page.locator(".workspace")).not.toHaveClass(/history-focus/);
    await expect(page.locator("#formula-input")).toHaveValue(formulaBefore);

    // Recarga directa en #historia/5 abre capítulo 5 en modo enfoque
    await page.goto("./#historia/5", { waitUntil: "networkidle" });
    await expect(page.locator(".workspace")).toHaveClass(/history-focus/);
    await expect(page.locator("#history-progress")).toContainText("Capítulo 05 / 11");

    // Navegar a capítulo 6 y luego Atrás vuelve al 5
    await page.locator("#history-timeline .history-step").nth(5).click();
    await expect(page.locator("#history-progress")).toContainText("Capítulo 06 / 11");
    await page.goBack();
    await expect(page.locator("#history-progress")).toContainText("Capítulo 05 / 11");

    diag.assertClean("state-and-history-navigation");
    await context.close();
  });
});
