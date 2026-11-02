import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { loadEnv } from "vite";

test("creates a GitHub Pages-ready static build", async () => {
  const [index, fallback] = await Promise.all([
    readFile(new URL("../dist/index.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/404.html", import.meta.url), "utf8"),
  ]);
  assert.equal(fallback, index);
  assert.match(index, /<html lang="sv">/);
  assert.match(index, /Broken Buckaroos/);
  assert.match(index, /og\.png/);
  const siteUrl = process.env.VITE_SITE_URL || loadEnv("production", process.cwd(), "VITE_").VITE_SITE_URL;
  const base = siteUrl ? `${new URL(siteUrl).pathname.replace(/\/+$/, "")}/` : "/brokenbuckaroos.se/";
  assert.ok(index.includes(`src="${base}assets/`));
  const referrer = index.indexOf('name="referrer"');
  const bootstrap = index.indexOf('searchParams.has("preview")');
  const firstAsset = Math.min(...['src="', 'rel="stylesheet"', 'rel="modulepreload"', 'rel="icon"'].map((value) => index.indexOf(value)).filter((position) => position >= 0));
  assert.ok(referrer >= 0 && referrer < firstAsset);
  assert.ok(bootstrap > referrer && bootstrap < firstAsset);
  assert.match(index, /noindex,nofollow/);
  await access(new URL("../dist/og.png", import.meta.url));
  await access(new URL("../dist/favicon.png", import.meta.url));
});
