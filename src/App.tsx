import { useEffect, useState } from "react";
import { PageScreen } from "@/components/PageScreen";
import { PreviewScreen } from "@/components/PreviewScreen";
import type { ContentTranslation, SiteContext } from "@/lib/cms";
import { getContent, getRedirect, getSiteContext, isCmsConfigured, siteHref } from "@/lib/cms";
import { applyMetadata } from "@/lib/metadata";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; context: SiteContext; content: ContentTranslation }
  | { status: "not-found" }
  | { status: "error"; message: string };

export default function App() {
  return new URL(window.location.href).searchParams.has("preview") ? <PreviewScreen /> : <PublicPage />;
}

function PublicPage() {
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
        const base = import.meta.env.BASE_URL.replace(/\/$/, "");
        const withinBase = window.location.pathname === base || window.location.pathname.startsWith(`${base}/`);
        const path = (base && withinBase ? window.location.pathname.slice(base.length) : window.location.pathname) || "/";
        const content = await getContent(context.site.id, path, context.locale);
        if (!content) {
          const target = await getRedirect(context.site.id, path, context.locale);
          if (target?.destination) {
            window.location.replace(siteHref(target.destination));
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
  if (state.status === "not-found") return <main id="main" className="cms-state"><div><p className="eyebrow">404</p><h1>Sidan finns inte</h1><p><a href={siteHref("/")}>Till startsidan</a></p></div></main>;
  if (state.status === "error") return <main id="main" className="cms-state"><div><p className="eyebrow">Broken Buckaroos</p><h1>Webbplatsen väntar på innehåll</h1><p>Anslut den publicerade webbplatsen till Oortis CMS för att visa sidor, bilder och navigation.</p></div></main>;
  return <main id="main" className="cms-state" aria-busy="true"><div><p className="eyebrow">Broken Buckaroos</p><h1>Hämtar innehåll</h1></div></main>;
}
