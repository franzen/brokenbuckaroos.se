import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { getPreviewConfiguration, getReferencedMedia, getSiteContext, siteHref, type ContentTranslation, type SiteContext } from "@/lib/cms";
import { applyMetadata, clearPreviewMetadata } from "@/lib/metadata";
import { previewContent, previewMediaIds, startPreview, type PreviewState, type PreviewStatus } from "@/lib/preview";
import { PageScreen } from "./PageScreen";

type PreviewView = { context: SiteContext; content: ContentTranslation };
const messages: Record<"sv" | "en", Record<PreviewStatus, string>> = {
  sv: {
    connecting: "Ansluter till förhandsvisningen…", connected: "Ansluten",
    disconnected: "Frånkopplad — försöker igen", expired: "Förhandsvisningen har gått ut",
    unavailable: "Förhandsvisningslänken är inte längre tillgänglig", mismatch: "Förhandsvisningen matchar inte webbplatsen eller adressen",
    "configuration-error": "Förhandsvisningen saknar CMS- eller webbplatsinställningar", ended: "Förhandsvisningen har avslutats",
  },
  en: {
    connecting: "Connecting to preview…", connected: "Connected",
    disconnected: "Disconnected — retrying", expired: "Preview expired",
    unavailable: "Preview link unavailable", mismatch: "Preview does not match this website or address",
    "configuration-error": "Preview CMS or website configuration is missing", ended: "Preview ended",
  },
};

export function PreviewScreen() {
  const [state, setState] = useState<PreviewState<PreviewView>>({ status: "connecting", view: null });
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let controller: ReturnType<typeof startPreview<PreviewView>> | null = null;
    let cachedContext: SiteContext | null = null;
    const hide = () => { if (content.current) content.current.hidden = true; };
    const begin = () => {
      controller?.dispose();
      clearPreviewMetadata();
      controller = startPreview<PreviewView>({
        ...getPreviewConfiguration(new URL(window.location.href)),
        address: () => new URL(window.location.href),
        resolve: async (snapshot, signal) => {
          if (!cachedContext || cachedContext.locale !== snapshot.locale) {
            const context = await getSiteContext(snapshot.locale, { siteId: snapshot.siteId, signal });
            signal.throwIfAborted();
            if (context.site.id !== snapshot.siteId) throw new Error("SITE_NOT_FOUND");
            cachedContext = { ...context, preview: true };
          }
          const missing = previewMediaIds(snapshot).filter((id) => !cachedContext!.media.has(id));
          const media = await getReferencedMedia(snapshot.siteId, missing, signal);
          signal.throwIfAborted();
          const context = { ...cachedContext, media: new Map([...cachedContext.media, ...media.map((item) => [item.id, item] as const)]) };
          cachedContext = context;
          return { context, content: previewContent(snapshot) };
        },
        onChange: (next) => {
          if (!next.view) { hide(); clearPreviewMetadata(); }
          else applyMetadata(next.view.context, next.view.content, true);
          // Terminal changes must remove draft DOM before the next paint, including
          // when timers resume after a suspended tab. Startup runs in a microtask.
          flushSync(() => setState(next));
          if (content.current) content.current.hidden = !next.view || document.hidden;
        },
      });
    };
    const check = () => {
      if (document.hidden) hide();
      if (controller?.check() && content.current?.hasAttribute("data-preview-ready")) content.current.hidden = document.hidden;
    };
    const leave = () => {
      hide();
      controller?.dispose();
      clearPreviewMetadata();
      flushSync(() => setState({ status: "connecting", view: null }));
    };
    const restore = (event: PageTransitionEvent) => { if (event.persisted) begin(); };
    begin();
    window.addEventListener("focus", check);
    window.addEventListener("popstate", check);
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", restore);
    document.addEventListener("visibilitychange", check);
    return () => {
      controller?.dispose();
      hide();
      window.removeEventListener("focus", check);
      window.removeEventListener("popstate", check);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("pageshow", restore);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  const locale = state.locale || "sv";
  const label = locale === "en" ? "Preview" : "Förhandsvisning";
  const message = messages[locale][state.status];
  const expiry = state.expiresAt ? new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "medium" }).format(new Date(state.expiresAt)) : "";
  return (
    <>
      <div id="page-content" ref={content} data-preview-ready={state.view ? "" : undefined}>
        {state.view && <PageScreen context={state.view.context} content={state.view.content} />}
      </div>
      {!state.view && <main id="main" className="cms-state" aria-busy={state.status === "connecting" || state.status === "disconnected"}><div><p className="eyebrow">{label}</p><h1>{message}</h1><p><a href={siteHref("/")}>{locale === "en" ? "Go to homepage" : "Till startsidan"}</a></p></div></main>}
      <aside className="preview-status" data-state={state.status} aria-label={label}>
        <strong>{label}</strong><span role="status">{message}</span>
        {state.expiresAt && <span>{locale === "en" ? "Expires" : "Giltig till"} <time dateTime={state.expiresAt}>{expiry}</time></span>}
      </aside>
    </>
  );
}
