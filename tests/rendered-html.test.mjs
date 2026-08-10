import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the branded CMS connection state", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /lang="sv"/);
  assert.match(html, /Broken Buckaroos/);
  assert.match(html, /Webbplatsen väntar på innehåll/);
  assert.match(html, /favicon\.png/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Starter Project/);
});

test("keeps public routes dynamic without hard-coded pages", async () => {
  const response = await render("/valfri-cms-sida");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Webbplatsen väntar på innehåll/);
});
