import { defineConfig } from "@playwright/test";

const chromiumPath = process.env.CHROMIUM_PATH || "/usr/bin/chromium";
const serverPort = process.env.SERVER_PORT || "18765";
const pagesPort = process.env.PAGES_PORT || "18766";
const repeatEach = Number(process.env.E2E_REPEAT ?? 3);

export default defineConfig({
  testDir: "./tests",
  timeout: 25_000,
  expect: {
    timeout: 8_000,
  },
  fullyParallel: false,
  workers: 4,
  retries: 0,
  repeatEach,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    headless: true,
    launchOptions: {
      executablePath: chromiumPath,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "server",
      use: {
        baseURL: `http://127.0.0.1:${serverPort}/`,
      },
    },
    {
      name: "pages",
      use: {
        baseURL: `http://127.0.0.1:${pagesPort}/proy3-logica/`,
      },
    },
  ],
  webServer: [
    {
      command: "node serve-server.mjs",
      url: `http://127.0.0.1:${serverPort}/`,
      reuseExistingServer: false,
      timeout: 90_000,
      env: { ...process.env, SERVER_PORT: serverPort },
    },
    {
      command: "node serve-pages.mjs",
      url: `http://127.0.0.1:${pagesPort}/proy3-logica/`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { ...process.env, PAGES_PORT: pagesPort },
    },
  ],
});
