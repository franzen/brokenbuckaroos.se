import { pageMetadata, renderCmsPage } from "@/lib/page";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string[] }> };

function pathFrom(slug: string[]) {
  return `/${slug.map(encodeURIComponent).join("/")}`;
}

export async function generateMetadata({ params }: Props) {
  return pageMetadata(pathFrom((await params).slug));
}

export default async function DynamicPage({ params }: Props) {
  return renderCmsPage(pathFrom((await params).slug));
}
