export function safeLink(value: unknown): string {
  if (typeof value !== "string" || [...value].some((character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127)) return "";
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return value;
  if (value.startsWith("#")) return value;
  try {
    const url = new URL(value);
    return ["https:", "http:", "mailto:", "tel:"].includes(url.protocol) ? value : "";
  } catch { return ""; }
}
