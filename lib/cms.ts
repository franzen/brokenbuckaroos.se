export type CmsLocale = "sv" | "en";

export type ButtonData = {
  label: string;
  url: string;
  style: "primary" | "secondary" | "text";
};

export type RichTextNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type?: string; attrs?: Record<string, unknown> }>;
  content?: RichTextNode[];
};

export type ContentBlock =
  | { id: string; type: "hero"; data: { eyebrow: string; heading: string; text: string; mediaId: string; buttons: ButtonData[] } }
  | { id: string; type: "rich_text"; data: { content: RichTextNode } }
  | { id: string; type: "image"; data: { mediaId: string; caption: string } }
  | { id: string; type: "image_text"; data: { mediaId: string; heading: string; text: RichTextNode; imagePosition: "left" | "right" } }
  | { id: string; type: "call_to_action"; data: { heading: string; text: string; button: ButtonData } }
  | { id: string; type: "quote"; data: { quote: string; attribution: string } }
  | { id: string; type: "content_feed"; data: { collection: "posts" | "events"; range: "all" | "upcoming" | "past"; limit: number } }
  | { id: string; type: "embed"; data: { url: string; title: string } };

export type CmsRecord = {
  id: string;
  collectionId?: string;
  collectionName?: string;
  created?: string;
  updated?: string;
  expand?: Record<string, CmsRecord | CmsRecord[]>;
  [key: string]: unknown;
};

export type MediaRecord = CmsRecord & {
  file: string;
  title_en?: string;
  title_sv?: string;
  alt_en?: string;
  alt_sv?: string;
  caption_en?: string;
  caption_sv?: string;
};

export type SiteRecord = CmsRecord & {
  key: string;
  name: string;
  primary_url?: string;
  default_locale: CmsLocale;
  timezone: string;
  logo?: string;
  favicon?: string;
  social_image?: string;
};

export type SiteTranslation = CmsRecord & {
  locale: CmsLocale;
  title: string;
  description: string;
  organization: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  seo_title: string;
  seo_description: string;
  social_links: unknown;
};

export type ContentTranslation = CmsRecord & {
  kind: "page" | "post" | "event";
  title: string;
  slug: string;
  path?: string;
  summary: string;
  byline?: string;
  blocks: { version: 1; items: ContentBlock[] };
  seo_title: string;
  seo_description: string;
  canonical_url: string;
  social_image: string;
  no_index: boolean;
};

export type NavigationLink = {
  id: string;
  label: string;
  href: string;
  newTab: boolean;
  parent: string;
  children: NavigationLink[];
};

export type SocialLink = { label: string; url: string };

export type SiteContext = {
  site: SiteRecord;
  translation: SiteTranslation | null;
  navigation: NavigationLink[];
  footerNavigation: NavigationLink[];
  logo: MediaRecord | null;
  media: Map<string, MediaRecord>;
  locale: CmsLocale;
};

export type FeedPost = {
  kind: "post";
  id: string;
  title: string;
  summary: string;
  href: string;
  date: string;
  image: MediaRecord | null;
};

export type FeedEvent = {
  kind: "event";
  id: string;
  title: string;
  summary: string;
  href: string;
  start: string;
  end: string;
  allDay: boolean;
  venue: string;
  address: string;
  externalUrl: string;
};

type Recurrence = "none" | "daily" | "weekly" | "monthly" | "yearly";

export type FeedItem = FeedPost | FeedEvent;

type ListResult<T> = { items: T[]; page: number; perPage: number; totalItems: number; totalPages: number };

const runtimeEnv = import.meta.env as Record<string, string | undefined>;
const CMS_URL = (runtimeEnv.VITE_CMS_URL || "").replace(/\/$/, "");
const SITE_KEY = runtimeEnv.VITE_CMS_SITE_KEY || "broken-buckaroos";
const PRIMARY_MENU_KEY = runtimeEnv.VITE_CMS_PRIMARY_MENU_KEY || "main";
const FOOTER_MENU_KEY = runtimeEnv.VITE_CMS_FOOTER_MENU_KEY || "footer";

export function siteHref(href: string) {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const base = runtimeEnv.BASE_URL || "/";
  return `${base.replace(/\/$/, "")}${href}` || "/";
}

function quoted(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function asRecord(value: unknown): CmsRecord | null {
  return value && typeof value === "object" && "id" in value ? (value as CmsRecord) : null;
}

function asRecordArray(value: unknown): CmsRecord[] {
  if (Array.isArray(value)) return value.filter((item): item is CmsRecord => Boolean(asRecord(item)));
  const record = asRecord(value);
  return record ? [record] : [];
}

async function list<T extends CmsRecord>(collection: string, options: {
  filter?: string;
  sort?: string;
  expand?: string;
  perPage?: number;
} = {}): Promise<T[]> {
  if (!CMS_URL) throw new Error("CMS_NOT_CONFIGURED");
  const params = new URLSearchParams({ page: "1", perPage: String(options.perPage ?? 500) });
  if (options.filter) params.set("filter", options.filter);
  if (options.sort) params.set("sort", options.sort);
  if (options.expand) params.set("expand", options.expand);
  const response = await fetch(`${CMS_URL}/api/collections/${encodeURIComponent(collection)}/records?${params}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    if (response.status === 404) return [];
    throw new Error(`CMS request failed (${response.status})`);
  }
  const data = await response.json() as ListResult<T>;
  return data.items || [];
}

async function first<T extends CmsRecord>(collection: string, filter: string, expand?: string): Promise<T | null> {
  const items = await list<T>(collection, { filter, expand, perPage: 1 });
  return items[0] || null;
}

export function isCmsConfigured() {
  return Boolean(CMS_URL);
}

export function mediaUrl(media: MediaRecord | null | undefined, thumb?: string) {
  if (!media?.file || !CMS_URL) return "";
  const collection = media.collectionName || media.collectionId || "media";
  const base = `${CMS_URL}/api/files/${encodeURIComponent(collection)}/${encodeURIComponent(media.id)}/${encodeURIComponent(media.file)}`;
  return thumb ? `${base}?thumb=${encodeURIComponent(thumb)}` : base;
}

export function mediaAlt(media: MediaRecord | null | undefined, locale: CmsLocale) {
  if (!media) return "";
  return String(media[`alt_${locale}`] || media.alt_sv || media.alt_en || media[`title_${locale}`] || media.title_sv || media.title_en || "");
}

function parseSocialLinks(value: unknown): SocialLink[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const entry = item as Record<string, unknown>;
    const url = typeof entry.url === "string" ? entry.url : typeof entry.href === "string" ? entry.href : "";
    if (!/^https:\/\//i.test(url)) return [];
    const label = typeof entry.label === "string" ? entry.label : typeof entry.platform === "string" ? entry.platform : new URL(url).hostname.replace(/^www\./, "");
    return [{ label, url }];
  });
}

export function socialLinks(translation: SiteTranslation | null) {
  return parseSocialLinks(translation?.social_links);
}

async function navigationFor(siteId: string, locale: CmsLocale, menuKey: string): Promise<NavigationLink[]> {
  const menu = await first<CmsRecord>("navigation_menus", `site = ${quoted(siteId)} && key = ${quoted(menuKey)} && active = true`);
  if (!menu) return [];
  const items = await list<CmsRecord>("navigation_items", {
    filter: `site = ${quoted(siteId)} && menu = ${quoted(menu.id)} && active = true`,
    sort: "sort_order",
  });
  if (!items.length) return [];
  const itemIds = items.map((item) => `navigation_item = ${quoted(item.id)}`).join(" || ");
  const translations = await list<CmsRecord>("navigation_item_translations", {
    filter: `site = ${quoted(siteId)} && locale = ${quoted(locale)} && (${itemIds})`,
  });
  const byItem = new Map(translations.map((item) => [String(item.navigation_item), item]));

  const pageIds = items.filter((item) => item.target_type === "page" && item.page).map((item) => String(item.page));
  const postIds = items.filter((item) => item.target_type === "post" && item.post).map((item) => String(item.post));
  const eventIds = items.filter((item) => item.target_type === "event" && item.event).map((item) => String(item.event));
  const [pages, posts, events] = await Promise.all([
    pageIds.length ? list<CmsRecord>("page_translations", { filter: `site = ${quoted(siteId)} && locale = ${quoted(locale)} && (${pageIds.map((id) => `page = ${quoted(id)}`).join(" || ")})` }) : [],
    postIds.length ? list<CmsRecord>("post_translations", { filter: `site = ${quoted(siteId)} && locale = ${quoted(locale)} && (${postIds.map((id) => `post = ${quoted(id)}`).join(" || ")})` }) : [],
    eventIds.length ? list<CmsRecord>("event_translations", { filter: `site = ${quoted(siteId)} && locale = ${quoted(locale)} && (${eventIds.map((id) => `event = ${quoted(id)}`).join(" || ")})` }) : [],
  ]);
  const targets = new Map<string, string>();
  pages.forEach((record) => targets.set(`page:${record.page}`, String(record.path || "/")));
  posts.forEach((record) => targets.set(`post:${record.post}`, `/${record.slug}`));
  events.forEach((record) => targets.set(`event:${record.event}`, `/${record.slug}`));

  const links = items.flatMap<NavigationLink>((item) => {
    const translation = byItem.get(item.id);
    if (!translation) return [];
    const targetType = String(item.target_type);
    const targetId = String(item[targetType] || "");
    const href = targetType === "external" ? String(translation.external_url || "") : targets.get(`${targetType}:${targetId}`) || "";
    if (!href) return [];
    return [{
      id: item.id,
      label: String(translation.label || ""),
      href,
      newTab: Boolean(item.open_in_new_tab),
      parent: String(item.parent || ""),
      children: [],
    }];
  });
  const byId = new Map(links.map((link) => [link.id, link]));
  const roots: NavigationLink[] = [];
  links.forEach((link) => {
    const parent = byId.get(link.parent);
    if (parent) parent.children.push(link);
    else roots.push(link);
  });
  return roots;
}

export async function getSiteContext(locale: CmsLocale = "sv"): Promise<SiteContext> {
  const site = await first<SiteRecord>("sites", `key = ${quoted(SITE_KEY)} && active = true`, "logo,favicon,social_image");
  if (!site) throw new Error("SITE_NOT_FOUND");
  const [translation, navigation, footerNavigation, allMedia] = await Promise.all([
    first<SiteTranslation>("site_translations", `site = ${quoted(site.id)} && locale = ${quoted(locale)}`),
    navigationFor(site.id, locale, PRIMARY_MENU_KEY),
    navigationFor(site.id, locale, FOOTER_MENU_KEY),
    list<MediaRecord>("media", { filter: `site = ${quoted(site.id)} && is_public = true`, perPage: 500 }),
  ]);
  const media = new Map(allMedia.map((record) => [record.id, record]));
  const expandedLogo = asRecord(site.expand?.logo) as MediaRecord | null;
  const logo = expandedLogo || media.get(String(site.logo || "")) || null;
  return { site, translation, navigation, footerNavigation, logo, media, locale };
}

function blocksFrom(value: unknown): { version: 1; items: ContentBlock[] } {
  if (!value || typeof value !== "object") return { version: 1, items: [] };
  const document = value as { version?: unknown; items?: unknown };
  return { version: 1, items: Array.isArray(document.items) ? document.items as ContentBlock[] : [] };
}

function normalizeContent(record: CmsRecord, kind: ContentTranslation["kind"]): ContentTranslation {
  return {
    ...record,
    kind,
    title: String(record.title || ""),
    slug: String(record.slug || ""),
    path: record.path ? String(record.path) : undefined,
    summary: String(record.summary || ""),
    byline: record.byline ? String(record.byline) : undefined,
    blocks: blocksFrom(record.blocks),
    seo_title: String(record.seo_title || ""),
    seo_description: String(record.seo_description || ""),
    canonical_url: String(record.canonical_url || ""),
    social_image: String(record.social_image || ""),
    no_index: Boolean(record.no_index),
  };
}

export async function getContent(siteId: string, path: string, locale: CmsLocale = "sv"): Promise<ContentTranslation | null> {
  const page = await first<CmsRecord>("page_translations", `site = ${quoted(siteId)} && locale = ${quoted(locale)} && path = ${quoted(path)}`, "page,page.parent,social_image");
  if (page) return normalizeContent(page, "page");
  const slug = path.split("/").filter(Boolean).at(-1);
  if (!slug) return null;
  const [post, event] = await Promise.all([
    first<CmsRecord>("post_translations", `site = ${quoted(siteId)} && locale = ${quoted(locale)} && slug = ${quoted(slug)}`, "post,post.cover,social_image"),
    first<CmsRecord>("event_translations", `site = ${quoted(siteId)} && locale = ${quoted(locale)} && slug = ${quoted(slug)}`, "event,social_image"),
  ]);
  if (post) return normalizeContent(post, "post");
  if (event) return normalizeContent(event, "event");
  return null;
}

export async function getRedirect(siteId: string, path: string, locale: CmsLocale = "sv") {
  const record = await first<CmsRecord>("redirects", `site = ${quoted(siteId)} && locale = ${quoted(locale)} && source_path = ${quoted(path)} && enabled = true`);
  if (!record) return null;
  return { destination: String(record.destination || ""), permanent: String(record.status_code) === "301" };
}

export async function getFeed(siteId: string, locale: CmsLocale, collection: "posts" | "events", range: "all" | "upcoming" | "past", limit: number): Promise<FeedItem[]> {
  const boundedLimit = Math.max(1, Math.min(500, limit));
  if (collection === "posts") {
    const records = await list<CmsRecord>("post_translations", {
      filter: `site = ${quoted(siteId)} && locale = ${quoted(locale)}`,
      sort: "-publish_at",
      expand: "post,post.cover",
      perPage: boundedLimit,
    });
    return records.slice(0, boundedLimit).map((record): FeedPost => {
      const post = asRecord(record.expand?.post);
      const cover = asRecord(post?.expand?.cover) as MediaRecord | null;
      return {
        kind: "post",
        id: record.id,
        title: String(record.title || ""),
        summary: String(record.summary || ""),
        href: `/${record.slug}`,
        date: String(record.publish_at || record.created || ""),
        image: cover,
      };
    });
  }
  const records = await list<CmsRecord>("event_translations", {
    filter: `site = ${quoted(siteId)} && locale = ${quoted(locale)}`,
    expand: "event",
    perPage: 500,
  });
  const now = Date.now();
  const windowStart = range === "upcoming" ? new Date(now) : new Date(new Date(now).setFullYear(new Date(now).getFullYear() - 2));
  const windowEnd = range === "past" ? new Date(now) : new Date(new Date(now).setFullYear(new Date(now).getFullYear() + 3));
  const expandedEvents = records.flatMap((record): FeedEvent[] => {
    const event = asRecord(record.expand?.event);
    if (!event) return [];
    const starts = expandOccurrences(
      new Date(String(event.start_at || "")),
      new Date(String(event.end_at || event.start_at || "")),
      String(event.recurrence || "none") as Recurrence,
      Math.max(1, Number(event.recurrence_interval || 1)),
      event.recurrence_end ? new Date(String(event.recurrence_end)) : null,
      windowStart,
      windowEnd,
    );
    return starts.flatMap(({ start, end }, occurrenceIndex) => {
      if (range === "upcoming" && end.getTime() < now) return [];
      if (range === "past" && end.getTime() >= now) return [];
      return [{
        kind: "event",
        id: `${record.id}-${occurrenceIndex}-${start.toISOString()}`,
        title: String(record.title || ""),
        summary: String(record.summary || ""),
        href: `/${record.slug}`,
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: Boolean(event.all_day),
        venue: String(event.venue || ""),
        address: String(event.address || ""),
        externalUrl: String(event.external_url || ""),
      }];
    });
  });
  const upcoming = expandedEvents.filter((event) => Date.parse(event.end) >= now).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const past = expandedEvents.filter((event) => Date.parse(event.end) < now).sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
  if (range === "upcoming") return upcoming.slice(0, boundedLimit);
  if (range === "past") return past.slice(0, boundedLimit);
  return [...upcoming.slice(0, boundedLimit), ...past.slice(0, boundedLimit)];
}

function addRecurrence(date: Date, recurrence: Recurrence, interval: number) {
  const next = new Date(date);
  if (recurrence === "daily") next.setUTCDate(next.getUTCDate() + interval);
  if (recurrence === "weekly") next.setUTCDate(next.getUTCDate() + (7 * interval));
  if (recurrence === "monthly") {
    const day = next.getUTCDate();
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + interval);
    const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
    next.setUTCDate(Math.min(day, lastDay));
  }
  if (recurrence === "yearly") {
    const month = next.getUTCMonth();
    const day = next.getUTCDate();
    next.setUTCDate(1);
    next.setUTCFullYear(next.getUTCFullYear() + interval);
    next.setUTCMonth(month);
    const lastDay = new Date(Date.UTC(next.getUTCFullYear(), month + 1, 0)).getUTCDate();
    next.setUTCDate(Math.min(day, lastDay));
  }
  return next;
}

function expandOccurrences(start: Date, end: Date, recurrence: Recurrence, interval: number, recurrenceEnd: Date | null, windowStart: Date, windowEnd: Date) {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const duration = Math.max(0, end.getTime() - start.getTime());
  const occurrences: Array<{ start: Date; end: Date }> = [];
  let current = new Date(start);
  const finalDate = recurrenceEnd && recurrenceEnd < windowEnd ? recurrenceEnd : windowEnd;
  for (let index = 0; index < 10000 && current <= finalDate; index += 1) {
    const occurrenceEnd = new Date(current.getTime() + duration);
    if (occurrenceEnd >= windowStart && current <= windowEnd) occurrences.push({ start: new Date(current), end: occurrenceEnd });
    if (recurrence === "none") break;
    const next = addRecurrence(current, recurrence, interval);
    if (next.getTime() <= current.getTime()) break;
    current = next;
  }
  return occurrences;
}

export function eventRecord(content: ContentTranslation) {
  return content.kind === "event" ? asRecord(content.expand?.event) : null;
}

export function contentSocialImage(content: ContentTranslation, media: Map<string, MediaRecord>) {
  const expanded = asRecord(content.expand?.social_image) as MediaRecord | null;
  return expanded || media.get(content.social_image) || null;
}

export function postCover(content: ContentTranslation) {
  if (content.kind !== "post") return null;
  const post = asRecord(content.expand?.post);
  return asRecord(post?.expand?.cover) as MediaRecord | null;
}

export function expandedRecords(value: unknown) {
  return asRecordArray(value);
}
