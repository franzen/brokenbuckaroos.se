import type { ReactNode } from "react";
import { siteHref, type RichTextNode } from "@/lib/cms";

function safeHref(value: unknown) {
  if (typeof value !== "string") return "";
  return /^(https?:\/\/|mailto:|tel:|\/|#)/i.test(value) ? value : "";
}

function withMarks(node: RichTextNode, content: ReactNode, key: string): ReactNode {
  return (node.marks || []).reduce<ReactNode>((child, mark, index) => {
    const markKey = `${key}-mark-${index}`;
    switch (mark.type) {
      case "bold": return <strong key={markKey}>{child}</strong>;
      case "italic": return <em key={markKey}>{child}</em>;
      case "underline": return <u key={markKey}>{child}</u>;
      case "strike": return <s key={markKey}>{child}</s>;
      case "code": return <code key={markKey}>{child}</code>;
      case "link": {
        const href = safeHref(mark.attrs?.href);
        if (!href) return child;
        const external = /^https?:\/\//i.test(href);
        return <a key={markKey} href={siteHref(href)} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>{child}</a>;
      }
      default: return child;
    }
  }, content);
}

function renderNode(node: RichTextNode, key: string): ReactNode {
  if (node.type === "text") return withMarks(node, node.text || "", key);
  const children = (node.content || []).map((child, index) => renderNode(child, `${key}-${index}`));
  switch (node.type) {
    case "doc": return children;
    case "paragraph": return <p key={key}>{children.length ? children : <br />}</p>;
    case "heading": {
      const level = Number(node.attrs?.level || 2);
      if (level === 1) return <h1 key={key}>{children}</h1>;
      if (level === 3) return <h3 key={key}>{children}</h3>;
      if (level === 4) return <h4 key={key}>{children}</h4>;
      return <h2 key={key}>{children}</h2>;
    }
    case "bulletList": return <ul key={key}>{children}</ul>;
    case "orderedList": return <ol key={key}>{children}</ol>;
    case "listItem": return <li key={key}>{children}</li>;
    case "blockquote": return <blockquote key={key}>{children}</blockquote>;
    case "hardBreak": return <br key={key} />;
    case "horizontalRule": return <hr key={key} />;
    case "codeBlock": return <pre key={key}><code>{children}</code></pre>;
    default: return children;
  }
}

export function RichText({ content, className = "prose" }: { content: RichTextNode; className?: string }) {
  return <div className={className}>{renderNode(content, "root")}</div>;
}
