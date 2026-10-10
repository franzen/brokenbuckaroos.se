import { CalendarDays, MapPin } from "lucide-react";
import type { ContentTranslation, SiteContext } from "@/lib/cms";
import { eventRecord, mediaAlt, mediaUrl, postCover, socialLinks } from "@/lib/cms";
import { BlockRenderer } from "./BlockRenderer";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

function ContentIntro({ content, context }: { content: ContentTranslation; context: SiteContext }) {
  const event = eventRecord(content);
  const date = event?.start_at ? new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "long", year: "numeric", hour: event.all_day ? undefined : "2-digit", minute: event.all_day ? undefined : "2-digit" }).format(new Date(String(event.start_at))) : "";
  const venue = event?.venue ? String(event.venue) : "";
  if (!content.summary && !content.byline && !event && !context.preview) return null;
  return (
    <header className="content-intro">
      <p className="eyebrow">{content.kind === "event" ? "Spelning" : content.kind === "post" ? "Aktuellt" : "Broken Buckaroos"}</p>
      <h1>{content.title || (context.locale === "en" ? "Untitled page" : "Sida utan titel")}</h1>
      {content.summary && <p className="lead">{content.summary}</p>}
      {(content.byline || date || venue) && <div className="content-meta">{content.byline && <span>{content.byline}</span>}{date && <span><CalendarDays aria-hidden="true" size={17} />{date}</span>}{venue && <span><MapPin aria-hidden="true" size={17} />{venue}</span>}</div>}
    </header>
  );
}

export function PageScreen({ context, content }: { context: SiteContext; content: ContentTranslation }) {
  const title = context.translation?.title || context.site.name;
  const logoUrl = mediaUrl(context.logo, "640x0");
  const blocks = content.blocks?.items || [];
  const hasFirstHero = blocks[0]?.type === "hero";
  const cover = postCover(content);
  return (
    <>
      <SiteHeader title={title} logoUrl={logoUrl} logoAlt={mediaAlt(context.logo, context.locale)} navigation={context.navigation} />
      <main id="main" data-template={content.pageData?.template || "default"} className={hasFirstHero ? "with-hero" : "without-hero"}>
        {!hasFirstHero && <ContentIntro content={content} context={context} />}
        {cover && !hasFirstHero && <figure className="content-cover"><img src={mediaUrl(cover, "1600x900")} alt={mediaAlt(cover, context.locale)} /></figure>}
        {blocks.map((block, index) => <BlockRenderer key={block.id || `${block.type}-${index}`} block={block} context={context} isFirst={index === 0} />)}
      </main>
      <SiteFooter title={title} translation={context.translation} navigation={context.footerNavigation} socials={socialLinks(context.translation)} />
    </>
  );
}
