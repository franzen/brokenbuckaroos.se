import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { PageScreen } from "@/components/PageScreen";
import { contentSocialImage, getContent, getRedirect, getSiteContext, isCmsConfigured, mediaUrl } from "@/lib/cms";

export async function pageMetadata(path: string): Promise<Metadata> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
  const fallbackSocialImage = host ? `${protocol}://${host}/og.png` : undefined;
  if (!isCmsConfigured()) return { title: "Broken Buckaroos", description: "CMS-anslutning saknas.", openGraph: { images: fallbackSocialImage ? [{ url: fallbackSocialImage }] : undefined } };
  try {
    const context = await getSiteContext("sv");
    const content = await getContent(context.site.id, path, context.locale);
    if (!content) return {};
    const image = contentSocialImage(content, context.media) || (context.site.social_image ? context.media.get(String(context.site.social_image)) : null);
    const title = content.seo_title || content.title;
    const description = content.seo_description || content.summary || context.translation?.description || "";
    return {
      title,
      description,
      alternates: content.canonical_url ? { canonical: content.canonical_url } : undefined,
      robots: content.no_index ? { index: false, follow: false } : undefined,
      openGraph: { title, description, type: "website", images: image ? [{ url: mediaUrl(image, "1600x900"), alt: mediaAltFallback(image, context.locale) }] : fallbackSocialImage ? [{ url: fallbackSocialImage, alt: "Broken Buckaroos" }] : undefined },
      twitter: { card: "summary_large_image", title, description, images: image ? [mediaUrl(image, "1600x900")] : fallbackSocialImage ? [fallbackSocialImage] : undefined },
    };
  } catch { return {}; }
}

function mediaAltFallback(image: { [key: string]: unknown }, locale: "sv" | "en") {
  return String(image[`alt_${locale}`] || image.alt_sv || image.alt_en || "Broken Buckaroos");
}

export async function renderCmsPage(path: string) {
  if (!isCmsConfigured()) {
    return <main id="main" className="cms-state"><div><p className="eyebrow">Broken Buckaroos</p><h1>Webbplatsen väntar på innehåll</h1><p>Anslut den publicerade webbplatsen till Oortis CMS för att visa sidor, bilder och navigation.</p></div></main>;
  }
  const context = await getSiteContext("sv");
  const content = await getContent(context.site.id, path, context.locale);
  if (!content) {
    const target = await getRedirect(context.site.id, path, context.locale);
    if (target?.destination) {
      if (target.permanent) permanentRedirect(target.destination);
      redirect(target.destination);
    }
    notFound();
  }
  return <PageScreen context={context} content={content} />;
}
