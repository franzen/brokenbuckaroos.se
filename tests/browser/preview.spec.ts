import { expect, test, type BrowserContext } from "@playwright/test";
import { snapshot, siteId } from "../fixtures/preview";
import type { PagePreviewSnapshot } from "../../lib/preview";

async function cms(context: BrowserContext, initial = snapshot()) {
  let current = initial;
  let status = 200;
  let offline = false;
  let siteStatus = 200;
  const reads: Array<{ url: string; headers: Record<string, string>; method: string }> = [];
  await context.route("https://cms.preview.test/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "X-CMS-Preview", "Cache-Control": "no-store" };
    if (request.method() === "OPTIONS") { await route.fulfill({ status: 204, headers }); return; }
    reads.push({ url: url.href, headers: await request.allHeaders(), method: request.method() });
    if (url.pathname === "/api/cms/preview") {
      if (offline) { await route.abort("connectionfailed"); return; }
      if (status !== 200) { await route.fulfill({ status, headers }); return; }
      if (url.searchParams.get("revision") === String(current.revision)) { await route.fulfill({ status: 204, headers }); return; }
      await route.fulfill({ json: current, headers }); return;
    }
    if (url.pathname.startsWith("/api/files/")) {
      await route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1sAAAAASUVORK5CYII=", "base64"), headers }); return;
    }
    const collection = url.pathname.split("/")[3];
    if (collection === "sites" && siteStatus !== 200) { await route.fulfill({ status: siteStatus, headers }); return; }
    const filter = url.searchParams.get("filter") || "";
    const en = filter.includes('locale = "en"');
    let items: unknown[] = [];
    switch (collection) {
      case "sites": items = [{ id: siteId, name: "Broken Buckaroos", key: "broken-buckaroos", default_locale: "sv", timezone: "Europe/Stockholm" }]; break;
      case "site_translations": items = [{ id: "site-translation", locale: en ? "en" : "sv", title: en ? "English Site" : "Svensk webbplats", description: "", social_links: [] }]; break;
      case "navigation_menus": items = filter.includes('key = "main"') ? [{ id: "main-menu" }] : []; break;
      case "navigation_items": items = [{ id: "nav-item", target_type: "page", page: "published-page", parent: "" }]; break;
      case "navigation_item_translations": items = [{ id: "nav-translation", navigation_item: "nav-item", label: en ? "Published page" : "Publicerad sida" }]; break;
      case "page_translations": items = filter.includes('page = "published-page"') || filter.includes('path = "/published"') ? [{ ...current.translation, id: "published-translation", page: "published-page", title: "Published content", path: "/published" }] : []; break;
      case "media": items = filter.includes('id = "newmedia0000001"') ? [{ id: "newmedia0000001", file: "image.png", alt_en: "Preview image", alt_sv: "Förhandsvisningsbild" }] : []; break;
      case "post_translations": items = filter.includes("slug = ") && !filter.includes('slug = "news"') ? [] : [{ id: "public-news", title: en ? "Public news" : "Publicerade nyheter", summary: "Public feed", slug: "news", publish_at: "2026-10-01T12:00:00Z", expand: { post: { id: "post" } } }]; break;
    }
    await route.fulfill({ json: { items }, headers });
  });
  return { reads, update: (next: PagePreviewSnapshot) => { current = next; }, status: (next: number) => { status = next; }, siteStatus: (next: number) => { siteStatus = next; }, offline: () => { offline = true; } };
}

test("renders unpublished nested routes through an HTTP 404 and keeps deployment-base assets", async ({ page, context, baseURL }) => {
  const mock = await cms(context);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const assets: Array<{ path: string; type: string; referrer?: string }> = [];
  page.on("request", (request) => { if (["script", "stylesheet", "font", "image"].includes(request.resourceType())) assets.push({ path: new URL(request.url()).pathname, type: request.resourceType(), referrer: request.headers().referer }); });
  const response = await page.goto(`${baseURL}new/nested/?preview=share-token`);
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Draft page", exact: true })).toBeVisible();
  await expect(page.locator(".site-header")).toBeVisible();
  await expect(page.locator(".site-footer")).toBeVisible();
  await expect(page.locator(".preview-status")).toContainText("Ansluten");
  await expect(page.locator(".preview-status time")).toHaveAttribute("datetime", /T/);
  await expect(page.locator("#main")).toHaveAttribute("data-template", "landing");
  await expect(page).toHaveURL(`${baseURL}new/nested/?preview=share-token`);
  expect(await page.locator('meta[name="referrer"]').getAttribute("content")).toBe("no-referrer");
  expect(await page.locator('meta[name="robots"]').getAttribute("content")).toBe("noindex,nofollow");
  const lookup = new URL(mock.reads[0].url);
  expect(lookup.pathname).toBe("/api/collections/sites/records");
  expect(lookup.searchParams.get("filter")).toBe('key = "broken-buckaroos" && active = true');
  expect(mock.reads[1].url).toContain(`/api/cms/preview?site=${siteId}`);
  expect(mock.reads[1].headers["x-cms-preview"]).toBe("share-token");
  expect(mock.reads.filter((read) => new URL(read.url).pathname !== "/api/cms/preview").every((read) => !read.headers["x-cms-preview"])).toBe(true);
  expect(mock.reads.every((read) => !read.url.includes("share-token") && !read.headers.referer && read.method === "GET")).toBe(true);
  expect(mock.reads.some((read) => read.url.includes("redirects") || new URL(read.url).searchParams.get("filter")?.includes('path = "/new/nested"'))).toBe(false);
  expect(assets.every((asset) => asset.path.startsWith(new URL(baseURL!).pathname) && !asset.referrer?.includes("preview=") && !asset.referrer?.includes("share-token"))).toBe(true);
  // Fonts can use the stylesheet's URL as their referrer. Document-initiated
  // requests must already have no-referrer before the application starts.
  expect(assets.filter((asset) => asset.type !== "font").every((asset) => !asset.referrer)).toBe(true);
  expect(errors).toEqual([]);
  expect(await page.evaluate(async () => ({ local: localStorage.length, session: sessionStorage.length, workers: (await navigator.serviceWorker.getRegistrations()).length }))).toEqual({ local: 0, session: 0, workers: 0 });
  await page.screenshot({ path: `test-results/preview-${test.info().project.name}.png`, fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.locator(".preview-status")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/preview-mobile-${test.info().project.name}.png` });
});

test("updates all tabs without reloading, uses session-language public data, and clears stale SEO", async ({ page, context, baseURL }) => {
  const initial = snapshot({ locale: "en" });
  initial.translation.locale = "en";
  initial.translation.social_image = "newmedia0000001";
  initial.translation.blocks.items = [{ id: "feedblock", type: "content_feed", data: { collection: "posts", range: "all", limit: 3 } }];
  const mock = await cms(context, initial);
  const other = await context.newPage();
  await Promise.all([page.goto(`${baseURL}new/nested?preview=share-token`), other.goto(`${baseURL}new/nested?preview=share-token`)]);
  await expect(page.getByRole("heading", { name: "Draft page", exact: true })).toBeVisible();
  await expect(other.getByRole("heading", { name: "Draft page", exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator(".desktop-nav")).toContainText("Published page");
  await expect(page.getByRole("heading", { name: "Public news", exact: true })).toBeVisible();
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /newmedia0000001/);
  const marker = await page.evaluate(() => performance.timeOrigin);
  mock.update({ ...initial, revision: 2, translation: { ...initial.translation, title: "Edited draft", seo_title: "", seo_description: "", summary: "", social_image: "", canonical_url: "" } });
  await expect(page.getByRole("heading", { name: "Edited draft", exact: true })).toBeVisible();
  await expect(other.getByRole("heading", { name: "Edited draft", exact: true })).toBeVisible();
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(marker);
  await expect(page).toHaveTitle("Edited draft | English Site");
  await expect(page.locator('meta[name="description"], meta[property="og:image"], link[rel="canonical"]')).toHaveCount(0);
  expect(mock.reads.some((read) => new URL(read.url).searchParams.get("revision") === "1")).toBe(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Edited draft", exact: true })).toBeVisible();
  expect(mock.reads.filter((read) => new URL(read.url).pathname === "/api/cms/preview" && !new URL(read.url).searchParams.has("revision")).length).toBeGreaterThanOrEqual(3);
});

test("handles homepage snapshots and safe unfinished blocks", async ({ page, context, baseURL }) => {
  const initial = snapshot({ targetPath: "/" });
  initial.translation = { ...initial.translation, path: "/", title: "", summary: "", blocks: { version: 1, items: [
    { id: "imageblock", type: "image", data: { mediaId: "", caption: "" } },
    { id: "embedblock", type: "embed", data: { url: "", title: "" } },
    { id: "ctablock0", type: "call_to_action", data: { heading: "Contact", text: "", button: { label: "Unsafe", url: "javascript:alert(1)", style: "primary" } } },
  ] } };
  await cms(context, initial);
  expect((await page.goto(`${baseURL}?preview=share-token`))?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Sida utan titel", exact: true })).toBeVisible();
  await expect(page.getByText("Välj en bild", { exact: true })).toBeVisible();
  await expect(page.getByText("Ange en inbäddningsadress", { exact: true })).toBeVisible();
  await expect(page.locator('a[href^="javascript:"], iframe')).toHaveCount(0);
});

for (const status of [404, 410]) {
  test(`API ${status} removes draft DOM and metadata`, async ({ page, context, baseURL }) => {
    const mock = await cms(context);
    await page.goto(`${baseURL}new/nested?preview=share-token`);
    await expect(page.getByRole("heading", { name: "Draft page", exact: true })).toBeVisible();
    mock.status(status);
    await expect(page.locator(".preview-status")).toHaveAttribute("data-state", status === 410 ? "expired" : "unavailable");
    await expect(page.locator("#page-content")).toBeEmpty();
    await expect(page.locator('meta[property="og:title"], link[rel="canonical"]')).toHaveCount(0);
  });
}

test("initial failures stay in preview mode and retry", async ({ page, context, baseURL }) => {
  const mock = await cms(context);
  mock.status(503);
  await page.goto(`${baseURL}published?preview=share-token`);
  await expect(page.locator(".preview-status")).toHaveAttribute("data-state", "disconnected");
  expect(mock.reads.every((read) => ["/api/collections/sites/records", "/api/cms/preview"].includes(new URL(read.url).pathname))).toBe(true);
  const next = snapshot({ targetPath: "/published" });
  next.translation.path = "/published";
  mock.update(next); mock.status(200);
  await expect(page.getByRole("heading", { name: "Draft page", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Published content", exact: true })).toHaveCount(0);
});

test("retries site lookup using the existing key without loading a published page", async ({ page, context, baseURL }) => {
  const mock = await cms(context);
  mock.siteStatus(503);
  await page.goto(`${baseURL}new/nested?preview=share-token`);
  await expect(page.locator(".preview-status")).toHaveAttribute("data-state", "disconnected");
  expect(mock.reads.every((read) => new URL(read.url).pathname === "/api/collections/sites/records" && !read.headers["x-cms-preview"])).toBe(true);
  mock.siteStatus(200);
  await expect(page.getByRole("heading", { name: "Draft page", exact: true })).toBeVisible();
});

test("expiry clears previews during failures and checks suspended-tab resume before revealing content", async ({ page, context, baseURL }) => {
  const now = new Date("2026-10-10T12:00:00Z");
  await page.clock.install({ time: now });
  const initial = snapshot({ expiresAt: new Date(now.getTime() + 30000).toISOString() });
  const mock = await cms(context, initial);
  await page.goto(`${baseURL}new/nested?preview=share-token`);
  await expect(page.getByRole("heading", { name: "Draft page", exact: true })).toBeVisible();
  mock.offline();
  await page.clock.runFor(1000);
  await expect(page.locator(".preview-status")).toHaveAttribute("data-state", "disconnected");
  await expect(page.getByRole("heading", { name: "Draft page", exact: true })).toBeVisible();
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(page.locator("#page-content")).toBeHidden();
  await page.clock.setSystemTime(new Date(now.getTime() + 60000));
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: false }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(page.locator("#page-content")).toBeEmpty();
  await expect(page.locator(".preview-status")).toHaveAttribute("data-state", "expired");
});

test("navigation clears preview state and published routing still works", async ({ page, context, baseURL }) => {
  await cms(context);
  await page.goto(`${baseURL}new/nested?preview=share-token`);
  await expect(page.getByRole("heading", { name: "Draft page", exact: true })).toBeVisible();
  await page.locator(".desktop-nav").getByRole("link", { name: "Publicerad sida" }).click();
  await expect(page).toHaveURL(`${baseURL}published`);
  await expect(page.getByRole("heading", { name: "Published content", exact: true })).toBeVisible();
  await expect(page.locator(".preview-status")).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await page.goto(`${baseURL}missing`);
  await expect(page.getByRole("heading", { name: "Sidan finns inte", exact: true })).toBeVisible();
});

test("browser restoration starts a fresh read instead of reviving a stored draft", async ({ page, context, baseURL }) => {
  const initial = snapshot();
  const mock = await cms(context, initial);
  await page.goto(`${baseURL}new/nested?preview=share-token`);
  await expect(page.getByRole("heading", { name: "Draft page", exact: true })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
  await expect(page.locator("#page-content")).toBeEmpty();
  mock.update({ ...initial, revision: 2, translation: { ...initial.translation, title: "Fresh restored draft" } });
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await expect(page.getByRole("heading", { name: "Fresh restored draft", exact: true })).toBeVisible();
  expect(mock.reads.filter((read) => new URL(read.url).pathname === "/api/cms/preview" && !new URL(read.url).searchParams.has("revision")).length).toBe(2);
});
