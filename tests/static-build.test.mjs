import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("creates a GitHub Pages-ready static build", async () => {
  const [index, fallback] = await Promise.all([
    readFile(new URL("../dist/index.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/404.html", import.meta.url), "utf8"),
  ]);
  assert.equal(fallback, index);
  assert.match(index, /<html lang="sv">/);
  assert.match(index, /Broken Buckaroos/);
  assert.match(index, /og\.png/);
  assert.match(index, /src="\/brokenbuckaroos\.se\/assets\/[^"]+\.js"/);
  await access(new URL("../dist/og.png", import.meta.url));
  await access(new URL("../dist/favicon.png", import.meta.url));
});
