import { useEffect, useState } from "react";
import { PageScreen } from "@/components/PageScreen";
import type { ContentTranslation, SiteContext } from "@/lib/cms";
import { contentSocialImage, getContent, getRedirect, getSiteContext, isCmsConfigured, mediaUrl } from "@/lib/cms";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; context: SiteContext; content: ContentTranslation }
  | { status: "not-found" }
  | { status: "error"; message: string };

function upsertMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.append(element);
  }
  Object.entries(attributes).forEach(([key, value]) => element?.setAttribute(key, value));
}

function applyMetadata(context: SiteContext, content: ContentTranslation) {
  const siteTitle = context.translation?.title || context.site.name;
  const title = content.seo_title || content.title;
  const description = content.seo_description || content.summary || context.translation?.description || "";
  const image = contentSocialImage(content, context.media) || context.media.get(String(context.site.social_image || ""));
  document.title = title === siteTitle ? title : `${title} | ${siteTitle}`;
  if (description) {
    upsertMeta('meta[name="description"]', { name: "description", content: description });
    upsertMeta('meta[property="og:description"]', { property: "og:description", content: description });
  }
  upsertMeta('meta[property="og:title"]', { property: "og:title", content: title });
  if (image) upsertMeta('meta[property="og:image"]', { property: "og:image", content: mediaUrl(image, "1600x900") });
  if (content.no_index) upsertMeta('meta[name="robots"]', { name: "robots", content: "noindex, nofollow" });
  if (content.canonical_url) {
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.append(canonical);
    }
    canonical.href = content.canonical_url;
  }
}

export default function App() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    async function load() {
      if (!isCmsConfigured()) {
        setState({ status: "error", message: "CMS-anslutning saknas." });
        return;
      }
      try {
        const context = await getSiteContext("sv");
        const path = window.location.pathname || "/";
        const content = await getContent(context.site.id, path, context.locale);
        if (!content) {
          const target = await getRedirect(context.site.id, path, context.locale);
          if (target?.destination) {
            window.location.replace(target.destination);
            return;
          }
          if (active) setState({ status: "not-found" });
          return;
        }
        applyMetadata(context, content);
        if (active) setState({ status: "ready", context, content });
      } catch (error) {
        if (active) setState({ status: "error", message: error instanceof Error ? error.message : "CMS kunde inte läsas." });
      }
    }
    load();
    return () => { active = false; };
  }, []);

  if (state.status === "ready") return <PageScreen context={state.context} content={state.content} />;
  if (state.status === "not-found") return <main id="main" className="cms-state"><div><p className="eyebrow">404</p><h1>Sidan finns inte</h1><p><a href="/">Till startsidan</a></p></div></main>;
  if (state.status === "error") return <main id="main" className="cms-state"><div><p className="eyebrow">Broken Buckaroos</p><h1>Webbplatsen väntar på innehåll</h1><p>Anslut den publicerade webbplatsen till Oortis CMS för att visa sidor, bilder och navigation.</p></div></main>;
  return <main id="main" className="cms-state" aria-busy="true"><div><p className="eyebrow">Broken Buckaroos</p><h1>Hämtar innehåll</h1></div></main>;
}
