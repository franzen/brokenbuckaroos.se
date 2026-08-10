import { Check, Copy, ExternalLink, Mail, X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

type EmailDetails = {
  address: string;
  subject: string;
  body: string;
};

function parseMailto(href: string): EmailDetails | null {
  if (!href.toLowerCase().startsWith("mailto:")) return null;
  try {
    const [recipient, query = ""] = href.slice(7).split("?", 2);
    const params = new URLSearchParams(query);
    const address = decodeURIComponent(recipient).trim();
    if (!address) return null;
    return {
      address,
      subject: params.get("subject") || "",
      body: params.get("body") || "",
    };
  } catch {
    return null;
  }
}

function webmailUrl(provider: "gmail" | "outlook", details: EmailDetails) {
  if (provider === "gmail") {
    const params = new URLSearchParams({ view: "cm", fs: "1", to: details.address });
    if (details.subject) params.set("su", details.subject);
    if (details.body) params.set("body", details.body);
    return `https://mail.google.com/mail/?${params}`;
  }
  const params = new URLSearchParams({ to: details.address });
  if (details.subject) params.set("subject", details.subject);
  if (details.body) params.set("body", details.body);
  return `https://outlook.office.com/mail/deeplink/compose?${params}`;
}

async function copyAddress(address: string) {
  try {
    await navigator.clipboard.writeText(address);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = address;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
}

export function EmailFallback({ children }: { children: ReactNode }) {
  const [details, setDetails] = useState<EmailDetails | null>(null);
  const [copied, setCopied] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href^="mailto:"]') : null;
      if (!target) return;
      const parsed = parseMailto(target.href);
      if (!parsed) return;
      event.preventDefault();
      setCopied(false);
      setDetails(parsed);
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    if (!details) return;
    closeButton.current?.focus();
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") setDetails(null);
    }
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [details]);

  return (
    <>
      {children}
      {details && (
        <div className="email-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetails(null); }}>
          <section className="email-dialog" role="dialog" aria-modal="true" aria-labelledby="email-dialog-title">
            <button ref={closeButton} className="email-dialog-close" type="button" onClick={() => setDetails(null)} aria-label="Stäng">
              <X aria-hidden="true" />
            </button>
            <div className="email-dialog-icon"><Mail aria-hidden="true" /></div>
            <p className="eyebrow">Kontakta oss</p>
            <h2 id="email-dialog-title">Skicka e-post</h2>
            <p className="email-dialog-help">Välj din webmail eller kopiera adressen och använd valfri e-posttjänst.</p>
            <div className="email-address-row">
              <span>{details.address}</span>
              <button type="button" onClick={async () => setCopied(await copyAddress(details.address))}>
                {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                {copied ? "Kopierad" : "Kopiera"}
              </button>
            </div>
            <div className="webmail-actions">
              <a href={webmailUrl("gmail", details)} target="_blank" rel="noopener noreferrer">Öppna Gmail <ExternalLink aria-hidden="true" /></a>
              <a href={webmailUrl("outlook", details)} target="_blank" rel="noopener noreferrer">Öppna Outlook <ExternalLink aria-hidden="true" /></a>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
