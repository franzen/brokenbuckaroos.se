import type { ContentTranslation, SiteContext } from "./cms";
import { contentSocialImage, mediaUrl } from "./cms";

function meta(selector: string, attributes: Record<string, string>, enabled = true) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!enabled) { element?.remove(); return; }
  if (!element) {
    element = document.createElement("meta");
    document.head.append(element);
  }
  Object.entries(attributes).forEach(([key, value]) => element?.setAttribute(key, value));
}

export function applyMetadata(context: SiteContext, content: ContentTranslation, preview = false) {
  const siteTitle = context.translation?.title || context.site.name;
  const title = content.seo_title || content.title || siteTitle;
  const description = content.seo_description || content.summary || context.translation?.description || "";
  const image = contentSocialImage(content, context.media) || context.media.get(String(context.site.social_image || ""));
  document.documentElement.lang = context.locale;
  document.title = title === siteTitle ? title : `${title} | ${siteTitle}`;
  meta('meta[name="description"]', { name: "description", content: description }, Boolean(description));
  meta('meta[property="og:description"]', { property: "og:description", content: description }, Boolean(description));
  meta('meta[property="og:title"]', { property: "og:title", content: title });
  meta('meta[property="og:image"]', { property: "og:image", content: mediaUrl(image, "1600x900") }, Boolean(image));
  meta('meta[name="robots"]', { name: "robots", content: "noindex,nofollow" }, preview || content.no_index);
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (/^https?:\/\//i.test(content.canonical_url)) {
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.append(canonical); }
    canonical.href = content.canonical_url;
  } else canonical?.remove();
}

export function clearPreviewMetadata() {
  document.title = "Förhandsvisning | Broken Buckaroos";
  document.head.querySelectorAll('meta[name="description"], meta[property="og:title"], meta[property="og:description"], meta[property="og:image"], link[rel="canonical"]').forEach((element) => element.remove());
  meta('meta[name="robots"]', { name: "robots", content: "noindex,nofollow" });
}
