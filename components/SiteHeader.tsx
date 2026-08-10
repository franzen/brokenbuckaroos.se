"use client";

/* CMS media is already resized by PocketBase's thumbnail endpoint. */
/* eslint-disable @next/next/no-img-element */

import { ChevronDown, Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { NavigationLink } from "@/lib/cms";

type Props = { title: string; logoUrl: string; logoAlt: string; navigation: NavigationLink[] };

function NavAnchor({ item, onClick }: { item: NavigationLink; onClick?: () => void }) {
  const external = item.newTab || /^https?:\/\//i.test(item.href);
  if (!external) return <Link href={item.href} onClick={onClick}>{item.label}</Link>;
  return (
    <a href={item.href} target={item.newTab ? "_blank" : undefined} rel={item.newTab ? "noopener noreferrer" : undefined} onClick={onClick}>
      {item.label}
    </a>
  );
}

export function SiteHeader({ title, logoUrl, logoAlt, navigation }: Props) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.classList.toggle("nav-open", open);
    return () => document.body.classList.remove("nav-open");
  }, [open]);

  return (
    <header className="site-header">
      <a className="skip-link" href="#main">Hoppa till innehållet</a>
      <div className="header-inner">
        <Link className="brand" href="/" aria-label={`${title}, startsida`}>
          {logoUrl ? <img src={logoUrl} alt={logoAlt || title} /> : <span>{title}</span>}
        </Link>
        {navigation.length > 0 && (
          <nav className="desktop-nav" aria-label="Huvudnavigation">
            <ul>
              {navigation.map((item) => (
                <li key={item.id} className={item.children.length ? "has-children" : ""}>
                  <NavAnchor item={item} />
                  {item.children.length > 0 && (
                    <>
                      <ChevronDown aria-hidden="true" size={15} strokeWidth={2.25} />
                      <ul className="submenu">
                        {item.children.map((child) => <li key={child.id}><NavAnchor item={child} /></li>)}
                      </ul>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        )}
        {navigation.length > 0 && (
          <button className="menu-button" type="button" aria-label={open ? "Stäng meny" : "Öppna meny"} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen((value) => !value)}>
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        )}
      </div>
      <div className={`mobile-panel ${open ? "is-open" : ""}`} id="mobile-navigation">
        <nav aria-label="Mobilnavigation">
          <ul>
            {navigation.map((item) => (
              <li key={item.id}>
                <NavAnchor item={item} onClick={() => setOpen(false)} />
                {item.children.length > 0 && <ul>{item.children.map((child) => <li key={child.id}><NavAnchor item={child} onClick={() => setOpen(false)} /></li>)}</ul>}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
