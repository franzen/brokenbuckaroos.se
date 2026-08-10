import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import type { ButtonData, ContentBlock, FeedEvent, FeedPost, MediaRecord, SiteContext } from "@/lib/cms";
import { getFeed, type FeedItem, mediaAlt, mediaUrl, siteHref } from "@/lib/cms";
import { RichText } from "./RichText";
import { EventCalendar } from "./EventCalendar";

function Button({ button }: { button: ButtonData }) {
  const external = /^https?:\/\//i.test(button.url);
  return <a className={`button button-${button.style}`} href={siteHref(button.url)} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>{button.label}<ArrowUpRight aria-hidden="true" size={17} /></a>;
}

function imageFor(media: Map<string, MediaRecord>, id: string) {
  return media.get(id) || null;
}

function PostCard({ item, locale }: { item: FeedPost; locale: string }) {
  const date = item.date ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(item.date)) : "";
  return (
    <article className="feed-card post-card">
      {item.image && <a href={siteHref(item.href)} className="feed-card-image"><img src={mediaUrl(item.image, "960x640")} alt={mediaAlt(item.image, locale === "sv" ? "sv" : "en")} loading="lazy" /></a>}
      <div className="feed-card-content">
        {date && <p className="card-meta">{date}</p>}
        <h3><a href={siteHref(item.href)}>{item.title}</a></h3>
        {item.summary && <p>{item.summary}</p>}
        <a className="text-link" href={siteHref(item.href)}>Läs mer <ArrowUpRight aria-hidden="true" size={16} /></a>
      </div>
    </article>
  );
}

function embedUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com")) return `https://www.youtube-nocookie.com/embed/${parsed.searchParams.get("v") || ""}`;
    if (parsed.hostname === "youtu.be") return `https://www.youtube-nocookie.com/embed/${parsed.pathname.slice(1)}`;
    if (parsed.hostname.includes("vimeo.com")) return `https://player.vimeo.com/video/${parsed.pathname.split("/").filter(Boolean).at(-1)}`;
    if (parsed.hostname.includes("spotify.com")) return `https://open.spotify.com/embed${parsed.pathname}`;
    if (parsed.hostname.includes("soundcloud.com")) return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}`;
  } catch { return ""; }
  return "";
}

function FeedBlock({ block, context }: { block: Extract<ContentBlock, { type: "content_feed" }>; context: SiteContext }) {
  const [items, setItems] = useState<FeedItem[]>([]);
  useEffect(() => {
    let active = true;
    getFeed(context.site.id, context.locale, block.data.collection, block.data.range, block.data.limit)
      .then((result) => { if (active) setItems(result); })
      .catch(() => { if (active) setItems([]); });
    return () => { active = false; };
  }, [block.data.collection, block.data.limit, block.data.range, context.locale, context.site.id]);
  if (!items.length) return null;
  return (
    <section className={`block feed-block ${block.data.collection === "events" ? "events-feed" : "posts-feed"}`} aria-label={block.data.collection === "events" ? "Evenemang" : "Aktuellt"}>
      <div className="section-heading"><p>{block.data.collection === "events" ? "På scen" : "Senaste nytt"}</p><h2>{block.data.collection === "events" ? "Kommande spelningar" : "Från Broken Buckaroos"}</h2></div>
      {block.data.collection === "events"
        ? <EventCalendar events={items.filter((item): item is FeedEvent => item.kind === "event")} locale={context.locale} />
        : <div className="feed-grid">{items.filter((item): item is FeedPost => item.kind === "post").map((item) => <PostCard key={item.id} item={item} locale={context.locale} />)}</div>}
    </section>
  );
}

export function BlockRenderer({ block, context, isFirst }: { block: ContentBlock; context: SiteContext; isFirst: boolean }) {
  const media = "mediaId" in block.data ? imageFor(context.media, String(block.data.mediaId || "")) : null;
  switch (block.type) {
    case "hero":
      return (
        <section className={`block hero ${media ? "has-image" : ""} ${isFirst ? "hero-first" : ""}`}>
          {media && <img className="hero-image" src={mediaUrl(media, "1920x1080")} alt={mediaAlt(media, context.locale)} fetchPriority={isFirst ? "high" : "auto"} />}
          <div className="hero-shade" />
          <div className="hero-grain" />
          <div className="hero-content reveal">
            {block.data.eyebrow && <p className="eyebrow">{block.data.eyebrow}</p>}
            <h1>{block.data.heading}</h1>
            {block.data.text && <p className="hero-text">{block.data.text}</p>}
            {block.data.buttons?.length > 0 && <div className="button-row">{block.data.buttons.map((button) => <Button key={`${button.label}-${button.url}`} button={button} />)}</div>}
          </div>
          <div className="hero-scroll" aria-hidden="true"><span />Scrolla</div>
        </section>
      );
    case "rich_text":
      return <section className="block rich-text-block reveal"><RichText content={block.data.content} /></section>;
    case "image":
      if (!media) return null;
      return <figure className="block image-block reveal"><img src={mediaUrl(media, "1920x0")} alt={mediaAlt(media, context.locale)} loading="lazy" />{block.data.caption && <figcaption>{block.data.caption}</figcaption>}</figure>;
    case "image_text":
      return (
        <section className={`block image-text ${block.data.imagePosition === "right" ? "image-right" : "image-left"}`}>
          {media && <div className="image-text-media reveal"><img src={mediaUrl(media, "1280x960")} alt={mediaAlt(media, context.locale)} loading="lazy" /></div>}
          <div className="image-text-copy reveal"><p className="eyebrow">Broken Buckaroos</p><h2>{block.data.heading}</h2><RichText content={block.data.text} /></div>
        </section>
      );
    case "call_to_action":
      return <section className="block cta-block reveal"><div><p className="eyebrow">Låt oss höras</p><h2>{block.data.heading}</h2>{block.data.text && <p>{block.data.text}</p>}</div><Button button={block.data.button} /></section>;
    case "quote":
      return <figure className="block quote-block reveal"><span aria-hidden="true">“</span><blockquote>{block.data.quote}</blockquote>{block.data.attribution && <figcaption>— {block.data.attribution}</figcaption>}</figure>;
    case "content_feed":
      return <FeedBlock block={block} context={context} />;
    case "embed": {
      const src = embedUrl(block.data.url);
      return <section className="block embed-block reveal">{src ? <iframe src={src} title={block.data.title} loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowFullScreen /> : <a className="embed-link" href={block.data.url} target="_blank" rel="noopener noreferrer"><span>{block.data.title}</span><ArrowUpRight aria-hidden="true" /></a>}</section>;
    }
    default:
      return null;
  }
}
