import { pageMetadata, renderCmsPage } from "@/lib/page";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return pageMetadata("/");
}

export default function Home() {
  return renderCmsPage("/");
}
