import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 20000,
  fullyParallel: true,
  workers: 2,
  use: { browserName: "chromium", trace: "retain-on-failure" },
  projects: [
    { name: "project-base", use: { baseURL: "http://127.0.0.1:4179/brokenbuckaroos.se/" } },
    { name: "root-base", use: { baseURL: "http://127.0.0.1:4180/" } },
  ],
  webServer: {
    command: "node tests/helpers/static-preview-server.mjs",
    url: "http://127.0.0.1:4179/health",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
