import { test, expect } from "@playwright/test";
import {
  VIEWPORTS_FAST,
  VIEWPORTS_FULL,
  THEMES,
  REDUCED_MOTIONS,
  attachDiagnostics,
  suppressAutoTutorial,
  dismissTutorial,
  selectTheme,
  assertNoHorizontalScroll,
  assertAxeClean,
  saveScreenshot,
} from "./helpers.mjs";

const isFast = process.env.E2E_MODE === "fast";
const viewports = isFast ? VIEWPORTS_FAST : VIEWPORTS_FULL;
const motions = isFast ? ["no-preference"] : REDUCED_MOTIONS;

async function assertFocusLayoutGeometry(page, vp, label) {
  const metrics = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const history = document.querySelector("#history-view");
    const stage = document.querySelector(".stage");
    const header = document.querySelector(".history-header");
    const backBtn = document.querySelector("#history-back-to-work");
    const menuBtn = document.querySelector("#history-toggle-menu");
    const progress = document.querySelector("#history-progress");
    const handleL = document.querySelector("#focus-handle-left");
    const handleR = document.querySelector("#focus-handle-right");

    const hRect = history?.getBoundingClientRect();
    const sRect = stage?.getBoundingClientRect();
    const hdrRect = header?.getBoundingClientRect();
    const backRect = backBtn?.getBoundingClientRect();
    const menuRect = menuBtn?.getBoundingClientRect();
    const progRect = progress?.getBoundingClientRect();
    const lRect = handleL?.getBoundingClientRect();
    const rRect = handleR?.getBoundingClientRect();

    // Check overlap of handles with visible text elements inside history-view
    const textOverlaps = [];
    if (history) {
      const walker = document.createTreeWalker(history, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (!node.textContent || !node.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const rects = range.getClientRects();
        for (const tr of rects) {
          if (tr.width < 2 || tr.height < 2) continue;
          for (const [name, hr] of [
            ["left", lRect],
            ["right", rRect],
          ]) {
            if (!hr || hr.width === 0) continue;
            const intersects = !(
              hr.right <= tr.left ||
              hr.left >= tr.right ||
              hr.bottom <= tr.top ||
              hr.top >= tr.bottom
            );
            if (intersects) {
              textOverlaps.push({
                handle: name,
                text: node.textContent.trim().slice(0, 40),
              });
            }
          }
        }
      }
    }

    const timeline = document.querySelector("#history-timeline");
    const tlRect = timeline?.getBoundingClientRect();
    const steps = [...document.querySelectorAll("#history-timeline .history-step")].map(
      (el) => el.getBoundingClientRect()
    );

    return {
      vw,
      vh,
      hRect,
      sRect,
      hdrRect,
      backRect,
      menuRect,
      progRect,
      lRect,
      rRect,
      textOverlaps,
      tlRect,
      steps,
    };
  });

  expect(metrics.hRect, `${label}: #history-view sin rect`).toBeTruthy();

  if (metrics.vw >= 1280) {
    const minExpected = Math.min(1000, metrics.vw * 0.85);
    expect(
      metrics.hRect.width,
      `${label}: #history-view ancho (${metrics.hRect.width}) < min(${minExpected})`
    ).toBeGreaterThanOrEqual(minExpected);

    const leftMargin = metrics.hRect.left;
    const rightMargin = metrics.vw - metrics.hRect.right;
    expect(
      leftMargin,
      `${label}: región vacía izquierda (${leftMargin}) > 35%`
    ).toBeLessThanOrEqual(metrics.vw * 0.35);
    expect(
      rightMargin,
      `${label}: región vacía derecha (${rightMargin}) > 35%`
    ).toBeLessThanOrEqual(metrics.vw * 0.35);
  }

  // Top bar in ONE row at >= 768px
  if (metrics.vw >= 768 && metrics.backRect && metrics.menuRect && metrics.progRect) {
    const centers = [
      metrics.backRect.top + metrics.backRect.height / 2,
      metrics.menuRect.top + metrics.menuRect.height / 2,
      metrics.progRect.top + metrics.progRect.height / 2,
    ];
    const spread = Math.max(...centers) - Math.min(...centers);
    expect(
      spread,
      `${label}: botones superiores de Historia apilados (diferencia vertical ${spread}px)`
    ).toBeLessThanOrEqual(16);
  }

  // Handles do not overlap any text and meet minimum clickable size
  expect(
    metrics.textOverlaps,
    `${label}: tiradores se superponen a texto: ${JSON.stringify(metrics.textOverlaps)}`
  ).toEqual([]);

  const minTarget = vp.isTouch ? 44 : 32;
  if (metrics.lRect && metrics.lRect.width > 0) {
    expect(metrics.lRect.width, `${label}: tirador izq ancho`).toBeGreaterThanOrEqual(minTarget);
    expect(metrics.lRect.height, `${label}: tirador izq alto`).toBeGreaterThanOrEqual(minTarget);
  }
  if (metrics.rRect && metrics.rRect.width > 0) {
    expect(metrics.rRect.width, `${label}: tirador der ancho`).toBeGreaterThanOrEqual(minTarget);
    expect(metrics.rRect.height, `${label}: tirador der alto`).toBeGreaterThanOrEqual(minTarget);
  }

  // Timeline steps are arranged horizontally on one row
  if (metrics.steps.length >= 2) {
    const firstTop = metrics.steps[0].top;
    const secondTop = metrics.steps[1].top;
    expect(
      Math.abs(firstTop - secondTop),
      `${label}: línea de tiempo no es horizontal (step0.top=${firstTop}, step1.top=${secondTop})`
    ).toBeLessThanOrEqual(8);
  }

  return metrics.hRect;
}

async function waitForPanelSettled(page, panelSelector) {
  await expect
    .poll(async () =>
      page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const st = getComputedStyle(el);
        return { opacity: st.opacity, transform: st.transform };
      }, panelSelector)
    )
    .toEqual({ opacity: "1", transform: "matrix(1, 0, 0, 1, 0, 0)" });
}

async function assertFloatingPanelGeometry(page, panelSelector, handleSelector, label) {
  const result = await page.evaluate(
    ({ pSel, hSel }) => {
      const topbar = document.querySelector(".topbar");
      const panel = document.querySelector(pSel);
      const handle = document.querySelector(hSel);
      const appearanceBtn = document.querySelector("#open-appearance");
      const helpBtn = document.querySelector("#open-tutorial");
      const vh = document.documentElement.clientHeight;

      const tRect = topbar.getBoundingClientRect();
      const pRect = panel.getBoundingClientRect();
      const hRect = handle.getBoundingClientRect();
      const aRect = appearanceBtn.getBoundingClientRect();
      const helpRect = helpBtn.getBoundingClientRect();

      const aTop = document.elementFromPoint(
        aRect.left + aRect.width / 2,
        aRect.top + aRect.height / 2
      );
      const helpTop = document.elementFromPoint(
        helpRect.left + helpRect.width / 2,
        helpRect.top + helpRect.height / 2
      );
      const handleTop = document.elementFromPoint(
        hRect.left + hRect.width / 2,
        hRect.top + hRect.height / 2
      );

      return {
        topbarBottom: tRect.bottom,
        panelTop: pRect.top,
        panelBottom: pRect.bottom,
        vh,
        appearanceVisible: appearanceBtn.contains(aTop) || aTop === appearanceBtn,
        helpVisible: helpBtn.contains(helpTop) || helpTop === helpBtn,
        handleVisible: handle.contains(handleTop) || handleTop === handle,
      };
    },
    { pSel: panelSelector, hSel: handleSelector }
  );

  expect(
    result.panelTop,
    `${label}: panel ${panelSelector} top (${result.panelTop}) < topbarBottom + 8 (${result.topbarBottom + 8})`
  ).toBeGreaterThanOrEqual(result.topbarBottom + 8);
  expect(
    result.panelBottom,
    `${label}: panel ${panelSelector} bottom (${result.panelBottom}) > vh (${result.vh})`
  ).toBeLessThanOrEqual(result.vh + 1);
  expect(result.appearanceVisible, `${label}: panel tapa Apariencia`).toBe(true);
  expect(result.helpVisible, `${label}: panel tapa Ayuda`).toBe(true);
  expect(result.handleVisible, `${label}: tirador ${handleSelector} queda oculto`).toBe(true);
}

test.describe("Historia, modo enfoque y matriz visual", () => {
  for (const vp of viewports) {
    for (const theme of THEMES) {
      for (const reducedMotion of motions) {
        const fastTag =
          VIEWPORTS_FAST.some((f) => f.name === vp.name) && reducedMotion === "no-preference"
            ? " @fast"
            : "";

        test(`modo enfoque, paneles, a11y y capítulos (${vp.name}, ${theme.label}, motion=${reducedMotion})${fastTag}`, async ({
          browser,
        }, testInfo) => {
          const context = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            colorScheme: theme.colorScheme,
            reducedMotion,
            hasTouch: vp.isTouch,
          });
          await suppressAutoTutorial(context);
          const page = await context.newPage();
          const diag = attachDiagnostics(page);

          await page.goto("./#historia", { waitUntil: "networkidle" });
    await dismissTutorial(page);
          await dismissTutorial(page);
          await selectTheme(page, theme.id);

          await expect(page.locator(".workspace")).toHaveClass(/history-focus/);
          await expect(page.locator("#history-view")).not.toHaveClass(/hidden/);

          // Contador limpio en capítulo 1: "1 leído" (no "11 leídos")
          await expect(page.locator("#history-progress")).toContainText("Capítulo 01 / 11");
          await expect(page.locator("#history-progress")).toContainText("1 leído");
          await expect(page.locator("#history-progress")).not.toContainText("11 leídos");

          // Verificar reducedMotion
          if (reducedMotion === "reduce") {
            const durations = await page.evaluate(() => {
              const els = [".workspace", ".sidebar", ".model-rail", ".focus-handle"];
              return els.map((s) => {
                const el = document.querySelector(s);
                return el ? getComputedStyle(el).transitionDuration : "0s";
              });
            });
            for (const d of durations) {
              expect(d, "con reducedMotion: reduce transitionDuration debe ser 0s").toBe("0s");
            }
          }

          // Barra derecha NO debe desplegarse ni mostrarse en Historia
          await expect(page.locator("#evaluator-sidebar")).toHaveAttribute("inert", "");
          await expect(page.locator("#model-rail")).toHaveAttribute("inert", "");
          await expect(page.locator("#model-rail")).toBeHidden();
          await expect(page.locator("#focus-handle-right")).toBeHidden();
          await expect(page.locator("#focus-edge-right")).toBeHidden();

          await assertNoHorizontalScroll(page, `historia cap 1 ${vp.name} ${theme.label}`);
          await assertFocusLayoutGeometry(
            page,
            vp,
            `historia cap 1 ${vp.name} ${theme.label}`
          );
          await assertAxeClean(page, `historia cap 1 ${vp.name} ${theme.label}`);

          if (testInfo.repeatEachIndex === 0 && reducedMotion === "no-preference") {
            await saveScreenshot(page, "historia-cap1", vp.name, theme.label);
          }

          // Abrir panel izquierdo mediante tirador (click/tap)
          await page.click("#focus-handle-left");
          await expect(page.locator("#evaluator-sidebar")).toHaveClass(/is-peek/);
          await waitForPanelSettled(page, "#evaluator-sidebar");
          await expect(page.locator("#focus-handle-left")).toHaveAttribute("aria-expanded", "true");
          await expect(page.locator("#evaluator-sidebar")).not.toHaveAttribute("inert", "");

          // En >= 900px, el contenido se corre a la derecha para no quedar tapado por el menú izquierdo
          if (vp.width >= 900) {
            await expect
              .poll(async () => {
                const sb = await page.locator("#evaluator-sidebar").boundingBox();
                const hv = await page.locator("#history-view").boundingBox();
                return sb && hv ? hv.x >= sb.x + sb.width - 2 : false;
              })
              .toBe(true);
            await assertNoHorizontalScroll(page, `historia panel izq ${vp.name} ${theme.label}`);
          }

          await assertFloatingPanelGeometry(
            page,
            "#evaluator-sidebar",
            "#focus-handle-left",
            `panel izq ${vp.name} ${theme.label}`
          );
          if (testInfo.repeatEachIndex === 0 && reducedMotion === "no-preference") {
            await saveScreenshot(page, "historia-panel-izq", vp.name, theme.label);
          }

          // Esc cierra el panel
          await page.keyboard.press("Escape");
          await expect(page.locator("#evaluator-sidebar")).not.toHaveClass(/is-peek/);
          await expect(page.locator("#focus-handle-left")).toHaveAttribute("aria-expanded", "false");

          // Capítulo 2: verificar 1 matemático a la izquierda y 1 a la derecha en >= 960px
          await page.locator("#history-timeline .history-step").nth(1).click();
          if (vp.width >= 960) {
            const cap2Layout = await page.evaluate(() => {
              const left = document.querySelector(".history-portraits-left")?.getBoundingClientRect();
              const copy = document.querySelector(".history-copy")?.getBoundingClientRect();
              const right = document.querySelector(".history-portraits-right")?.getBoundingClientRect();
              return { left, copy, right };
            });
            expect(cap2Layout.left && cap2Layout.copy && cap2Layout.right).toBeTruthy();
            expect(cap2Layout.left.right).toBeLessThanOrEqual(cap2Layout.copy.left + 2);
            expect(cap2Layout.right.left).toBeGreaterThanOrEqual(cap2Layout.copy.right - 2);
          }
          if (testInfo.repeatEachIndex === 0 && reducedMotion === "no-preference") {
            await saveScreenshot(page, "historia-cap2", vp.name, theme.label);
          }

          // Visitar capítulos clave (5, 9, 11) y verificar imágenes, Game of Life automático y capturas
          for (const chap of [
            { num: 5, slug: "cap5" },
            { num: 9, slug: "cap9" },
            { num: 11, slug: "cap11" },
          ]) {
            const step = page.locator("#history-timeline .history-step").nth(chap.num - 1);
            await step.scrollIntoViewIfNeeded();
            await step.click();
            await expect(page.locator("#history-progress")).toContainText(
              `Capítulo ${String(chap.num).padStart(2, "0")} / 11`
            );
            if (chap.num === 11 && reducedMotion === "no-preference") {
              await expect(page.locator("#glider-play")).toHaveText("Pausar");
              await expect(page.locator("#glider-gen")).not.toHaveText("Generación 0", {
                timeout: 3_000,
              });
            }
            await assertNoHorizontalScroll(page, `historia ${chap.slug} ${vp.name} ${theme.label}`);
            if (testInfo.repeatEachIndex === 0 && reducedMotion === "no-preference") {
              await saveScreenshot(page, `historia-${chap.slug}`, vp.name, theme.label);
            }
          }

          diag.assertClean(`historia-focus ${vp.name} ${theme.label}`);
          await context.close();
        });
      }
    }
  }

  test("hover en borde 24px (120ms/300ms), Tab en tiradores e imágenes de los 11 capítulos @fast", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    await suppressAutoTutorial(context);
    const page = await context.newPage();
    const diag = attachDiagnostics(page);

    await page.goto("./#historia", { waitUntil: "networkidle" });
    await dismissTutorial(page);

    // Hover en borde izquierdo (24px): no debe abrir de inmediato (< 100ms), sí tras ~150ms
    await page.mouse.move(6, 400);
    await page.waitForTimeout(60);
    await expect(page.locator("#evaluator-sidebar")).not.toHaveClass(/is-peek/);
    await page.waitForTimeout(140);
    await expect(page.locator("#evaluator-sidebar")).toHaveClass(/is-peek/);

    // Mover dentro del panel no debe parpadear ni cerrarlo
    await page.mouse.move(140, 350);
    await page.waitForTimeout(350);
    await expect(page.locator("#evaluator-sidebar")).toHaveClass(/is-peek/);

    // Salir del panel y del borde lo cierra tras ~300ms
    await page.mouse.move(700, 350);
    await page.waitForTimeout(450);
    await expect(page.locator("#evaluator-sidebar")).not.toHaveClass(/is-peek/);

    // Verificar todas las imágenes y demos de los 11 capítulos
    for (let i = 0; i < 11; i += 1) {
      const step = page.locator("#history-timeline .history-step").nth(i);
      await step.scrollIntoViewIfNeeded();
      await step.click();
      const imgs = page.locator("#history-stage img");
      const count = await imgs.count();
      for (let j = 0; j < count; j += 1) {
        const imgCheck = await imgs.nth(j).evaluate((img) => {
          const rect = img.getBoundingClientRect();
          const natRatio = img.naturalWidth / Math.max(1, img.naturalHeight);
          const renRatio = rect.width / Math.max(1, rect.height);
          return {
            complete: img.complete,
            naturalWidth: img.naturalWidth,
            natRatio,
            renRatio,
            src: img.getAttribute("src"),
          };
        });
        expect(imgCheck.complete, `Cap ${i + 1} img ${imgCheck.src} not complete`).toBe(true);
        expect(imgCheck.naturalWidth, `Cap ${i + 1} img ${imgCheck.src} naturalWidth=0`).toBeGreaterThan(0);
        const relDiff = Math.abs(imgCheck.natRatio - imgCheck.renRatio) / imgCheck.natRatio;
        expect(
          relDiff,
          `Cap ${i + 1} img ${imgCheck.src} deformada (nat=${imgCheck.natRatio.toFixed(2)}, ren=${imgCheck.renRatio.toFixed(2)})`
        ).toBeLessThanOrEqual(0.2);
      }
    }

    // Demos interactivos: Cantor (#cantor-step, cap 3), Gödel (#godel-encode, cap 8), Turing (#tm-step, cap 9), Glider (#glider-step, cap 11)
    for (const [demoIdx, btnSel] of [
      [2, "#cantor-step"],
      [7, "#godel-encode"],
      [8, "#tm-step"],
      [10, "#glider-step"],
    ]) {
      const step = page.locator("#history-timeline .history-step").nth(demoIdx);
      await step.scrollIntoViewIfNeeded();
      await step.click();
      await page.click(btnSel);
    }

    // Cargar un ejemplo desde Historia al evaluador (cap 3 o cap 1)
    const cap1 = page.locator("#history-timeline .history-step").nth(0);
    await cap1.scrollIntoViewIfNeeded();
    await cap1.click();
    const loadToEval = page.getByRole("button", { name: /evaluador/i }).last();
    await loadToEval.click();
    await expect(page.locator(".workspace")).not.toHaveClass(/history-focus/);

    diag.assertClean("hover-images-demos");
    await context.close();
  });
});
