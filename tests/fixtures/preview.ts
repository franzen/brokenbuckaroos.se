import type { PagePreviewSnapshot } from "../../lib/preview";

export const siteId = "previewsite0001";
export function snapshot(overrides: Partial<PagePreviewSnapshot> = {}): PagePreviewSnapshot {
  return {
    schemaVersion: 1, siteId, pageId: "previewpage0001", locale: "sv",
    targetPath: "/new/nested", expiresAt: new Date(Date.now() + 3600000).toISOString(), revision: 1,
    page: { id: "previewpage0001", site: siteId, template: "landing", parent: "", sort_order: 0 },
    translation: {
      page: "previewpage0001", site: siteId, locale: "sv", path: "/new/nested",
      title: "Draft page", slug: "nested", summary: "Unsaved preview content",
      blocks: { version: 1, items: [] }, seo_title: "Draft SEO", seo_description: "Draft description",
      canonical_url: "https://example.com/canonical", social_image: "", no_index: false, status: "draft", publish_at: "",
    },
    ...overrides,
  };
}
