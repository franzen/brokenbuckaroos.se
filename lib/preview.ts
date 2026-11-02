import type { CmsLocale, ContentBlock, ContentTranslation } from "./cms";

// Mirrors PagePreviewSnapshot in @oortis/cms-contracts. That package is private
// to the CMS workspace; this static site must build independently of it.
export type PreviewPage = { id: string; site: string; template: "default" | "landing"; parent: string; sort_order: number };
export type PagePreviewSnapshot = {
  schemaVersion: 1;
  siteId: string;
  pageId: string;
  locale: CmsLocale;
  targetPath: string;
  expiresAt: string;
  revision: number;
  page: PreviewPage;
  translation: {
    page: string; site: string; locale: CmsLocale; path: string;
    title: string; slug: string; summary: string;
    blocks: { version: 1; items: ContentBlock[] };
    seo_title: string; seo_description: string; canonical_url: string;
    social_image: string; no_index: boolean;
    status: "draft" | "published" | "archived"; publish_at: string;
  };
};

export type PreviewStatus = "connecting" | "connected" | "disconnected" | "expired" | "unavailable" | "mismatch" | "configuration-error" | "ended";
export type PreviewState<T> = { status: PreviewStatus; view: T | null; expiresAt?: string; locale?: CmsLocale };

export function normalizePath(path: string) {
  return path.replace(/\/+$/, "") || "/";
}

export function deploymentPath(address: URL, primaryUrl: string): string | null {
  const deployment = new URL(primaryUrl);
  const base = deployment.pathname.replace(/\/+$/, "");
  if (address.origin !== deployment.origin || (address.pathname !== base && !address.pathname.startsWith(`${base}/`))) return null;
  return normalizePath(address.pathname.slice(base.length) || "/");
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function button(value: unknown) {
  return record(value) && typeof value.label === "string" && typeof value.url === "string" && ["primary", "secondary", "text"].includes(String(value.style));
}

function richText(value: unknown, depth = 0): boolean {
  if (depth > 30 || !record(value)) return false;
  if (value.type !== undefined && typeof value.type !== "string") return false;
  if (value.text !== undefined && typeof value.text !== "string") return false;
  if (value.attrs !== undefined && !record(value.attrs)) return false;
  if (value.marks !== undefined && (!Array.isArray(value.marks) || !value.marks.every((mark) => record(mark) && (mark.type === undefined || typeof mark.type === "string") && (mark.attrs === undefined || record(mark.attrs))))) return false;
  return value.content === undefined || (Array.isArray(value.content) && value.content.every((child) => richText(child, depth + 1)));
}

function block(value: unknown): boolean {
  if (!record(value) || typeof value.id !== "string" || !record(value.data)) return false;
  const data = value.data;
  const strings = (...keys: string[]) => keys.every((key) => typeof data[key] === "string");
  switch (value.type) {
    case "hero": return strings("eyebrow", "heading", "text", "mediaId") && Array.isArray(data.buttons) && data.buttons.every(button);
    case "rich_text": return richText(data.content);
    case "image": return strings("mediaId", "caption");
    case "image_text": return strings("mediaId", "heading") && richText(data.text) && ["left", "right"].includes(String(data.imagePosition));
    case "call_to_action": return strings("heading", "text") && button(data.button);
    case "quote": return strings("quote", "attribution");
    case "content_feed": return ["posts", "events"].includes(String(data.collection)) && ["all", "upcoming", "past"].includes(String(data.range)) && Number.isInteger(data.limit) && Number(data.limit) >= 1 && Number(data.limit) <= 500;
    case "embed": return strings("url", "title");
    default: return false;
  }
}

export function validSnapshot(value: unknown, siteId: string, path: string): value is PagePreviewSnapshot {
  if (!record(value) || !record(value.page) || !record(value.translation)) return false;
  const { page, translation } = value;
  return value.schemaVersion === 1 && value.siteId === siteId
    && typeof value.pageId === "string" && /^[a-z0-9]{15}$/.test(value.pageId)
    && (value.locale === "sv" || value.locale === "en")
    && typeof value.targetPath === "string" && value.targetPath.startsWith("/") && !value.targetPath.startsWith("//") && normalizePath(value.targetPath) === path
    && typeof value.expiresAt === "string" && Number.isFinite(Date.parse(value.expiresAt))
    && Number.isSafeInteger(value.revision) && Number(value.revision) >= 1
    && page.id === value.pageId && page.site === siteId
    && ["default", "landing"].includes(String(page.template)) && typeof page.parent === "string" && Number.isSafeInteger(page.sort_order) && Number(page.sort_order) >= 0
    && translation.page === value.pageId && translation.site === siteId && translation.locale === value.locale && translation.path === value.targetPath
    && ["title", "slug", "summary", "seo_title", "seo_description", "canonical_url", "social_image", "publish_at"].every((key) => typeof translation[key] === "string")
    && typeof translation.no_index === "boolean" && ["draft", "published", "archived"].includes(String(translation.status))
    && record(translation.blocks) && translation.blocks.version === 1 && Array.isArray(translation.blocks.items) && translation.blocks.items.length <= 100 && translation.blocks.items.every(block);
}

export function previewContent(snapshot: PagePreviewSnapshot): ContentTranslation {
  return { ...snapshot.translation, id: snapshot.pageId, kind: "page", pageData: snapshot.page };
}

export function previewMediaIds(snapshot: PagePreviewSnapshot): string[] {
  return [...new Set([snapshot.translation.social_image, ...snapshot.translation.blocks.items.flatMap((item) => "mediaId" in item.data ? [item.data.mediaId] : [])].filter(Boolean))];
}

export function startPreview<T>(options: {
  cmsUrl: string; siteId: string | ((signal: AbortSignal) => Promise<string>); primaryUrl: string;
  address: () => URL;
  resolve: (snapshot: PagePreviewSnapshot, signal: AbortSignal) => Promise<T>;
  onChange: (state: PreviewState<T>) => void;
  fetch?: typeof fetch;
}) {
  let token = options.address().searchParams.get("preview") || "";
  let siteId = typeof options.siteId === "string" ? options.siteId : "";
  let snapshot: PagePreviewSnapshot | null = null;
  let view: T | null = null;
  let renderedRevision: number | null = null;
  let expiresAt: string | undefined;
  let locale: CmsLocale | undefined;
  let lastEmitted: PreviewState<T> | null = null;
  let stopped = false;
  let poll: ReturnType<typeof setTimeout> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let requestTimeout: ReturnType<typeof setTimeout> | undefined;
  let request: AbortController | null = null;
  let path: string | null = null;
  const emit = (status: PreviewStatus) => {
    if (lastEmitted?.status === status && lastEmitted.view === view && lastEmitted.expiresAt === expiresAt && lastEmitted.locale === locale) return;
    lastEmitted = { status, view, expiresAt, locale };
    options.onChange(lastEmitted);
  };
  const stop = (status: PreviewStatus, notify = true) => {
    if (stopped) return;
    stopped = true;
    clearTimeout(poll); clearTimeout(deadline); clearTimeout(requestTimeout);
    request?.abort();
    request = null;
    snapshot = null;
    view = null;
    token = "";
    if (notify) emit(status);
    else lastEmitted = null;
  };
  const check = () => {
    if (stopped) return false;
    if (snapshot && Date.now() >= Date.parse(snapshot.expiresAt)) stop("expired");
    else if (path !== null && (deploymentPath(options.address(), options.primaryUrl) !== path || options.address().searchParams.get("preview") !== token)) stop("ended");
    return !stopped;
  };
  const tick = async () => {
    if (!check()) return;
    try {
      request = new AbortController();
      requestTimeout = setTimeout(() => request?.abort(), 10000);
      if (!siteId && typeof options.siteId === "function") {
        const resolvedSiteId = await options.siteId(request.signal);
        if (!check()) return;
        request.signal.throwIfAborted();
        if (!/^[a-z0-9]{15}$/.test(resolvedSiteId)) { stop("configuration-error"); return; }
        siteId = resolvedSiteId;
      }
      const url = new URL("/api/cms/preview", options.cmsUrl);
      url.searchParams.set("site", siteId);
      if (snapshot) url.searchParams.set("revision", String(snapshot.revision));
      const response = await (options.fetch || fetch)(url, { headers: { "X-CMS-Preview": token }, cache: "no-store", credentials: "omit", signal: request.signal });
      if (!check()) return;
      if (response.status === 404 || response.status === 410) {
        stop(response.status === 410 ? "expired" : "unavailable");
        return;
      }
      if (response.status !== 204) {
        if (!response.ok) throw new Error("Preview connection failed");
        let next: unknown;
        try { next = await response.json(); } catch { stop("mismatch"); return; }
        if (!check()) return;
        if (path === null || !validSnapshot(next, siteId, path)
          || (snapshot && (next.pageId !== snapshot.pageId || next.locale !== snapshot.locale || next.expiresAt !== snapshot.expiresAt || next.revision < snapshot.revision))) {
          stop("mismatch");
          return;
        }
        snapshot = next;
        expiresAt = snapshot.expiresAt;
        locale = snapshot.locale;
        if (!check()) return;
        clearTimeout(deadline);
        deadline = setTimeout(check, Date.parse(snapshot.expiresAt) - Date.now());
      }
      if (!snapshot) throw new Error("Missing preview snapshot");
      if (renderedRevision !== snapshot.revision) {
        const nextView = await options.resolve(snapshot, request.signal);
        if (!check()) return;
        view = nextView;
        renderedRevision = snapshot.revision;
      }
      if (check()) emit("connected");
    } catch {
      if (check()) emit("disconnected");
    } finally {
      request = null;
      clearTimeout(requestTimeout);
      if (!stopped) poll = setTimeout(tick, 1000);
    }
  };
  // Defer startup so StrictMode's initial effect cleanup can cancel it safely.
  queueMicrotask(() => {
    if (stopped) return;
    try {
      if (!options.cmsUrl || (typeof options.siteId === "string" && !/^[a-z0-9]{15}$/.test(options.siteId)) || !options.primaryUrl || !["http:", "https:"].includes(new URL(options.cmsUrl).protocol) || !["http:", "https:"].includes(new URL(options.primaryUrl).protocol)) {
        stop("configuration-error");
        return;
      }
      path = deploymentPath(options.address(), options.primaryUrl);
      if (!token || path === null) { stop("mismatch"); return; }
      emit("connecting");
      void tick();
    } catch { stop("configuration-error"); }
  });
  return { check, dispose: () => stop("ended", false) };
}
