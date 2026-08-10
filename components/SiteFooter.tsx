import { Facebook, Instagram, Mail, Music2, Youtube } from "lucide-react";
import type { NavigationLink, SiteTranslation, SocialLink } from "@/lib/cms";

function SocialIcon({ url }: { url: string }) {
  const host = url.toLowerCase();
  if (host.includes("instagram")) return <Instagram aria-hidden="true" />;
  if (host.includes("facebook")) return <Facebook aria-hidden="true" />;
  if (host.includes("youtube")) return <Youtube aria-hidden="true" />;
  return <Music2 aria-hidden="true" />;
}

export function SiteFooter({ title, translation, navigation, socials }: { title: string; translation: SiteTranslation | null; navigation: NavigationLink[]; socials: SocialLink[] }) {
  return (
    <footer className="site-footer">
      <div className="footer-rule"><span /></div>
      <div className="footer-grid">
        <div className="footer-intro">
          <p className="footer-kicker">Broken Buckaroos</p>
          <h2>{translation?.title || title}</h2>
          {translation?.description && <p>{translation.description}</p>}
        </div>
        {(navigation.length > 0 || socials.length > 0) && (
          <div className="footer-links">
            {navigation.length > 0 && <nav aria-label="Sidfotsnavigation"><ul>{navigation.map((item) => <li key={item.id}><a href={item.href} target={item.newTab ? "_blank" : undefined} rel={item.newTab ? "noopener noreferrer" : undefined}>{item.label}</a></li>)}</ul></nav>}
            {socials.length > 0 && <div className="social-links">{socials.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" aria-label={link.label}><SocialIcon url={link.url} /></a>)}</div>}
          </div>
        )}
        {(translation?.contact_email || translation?.contact_phone || translation?.address) && (
          <address className="footer-contact">
            {translation.contact_email && <a href={`mailto:${translation.contact_email}`}><Mail aria-hidden="true" size={18} />{translation.contact_email}</a>}
            {translation.contact_phone && <a href={`tel:${translation.contact_phone.replace(/\s/g, "")}`}>{translation.contact_phone}</a>}
            {translation.address && <span>{translation.address}</span>}
          </address>
        )}
      </div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} {translation?.organization || title}</span><a href="#main">Till toppen ↑</a></div>
    </footer>
  );
}
