import { GalleryView } from "@/components/gallery/gallery-view";
import { audienceFrom } from "../../audience-params";

export const revalidate = 300;

export default async function Page({ params }: { params: Promise<{ audience: string }> }) {
  return <GalleryView kind="wip" audience={await audienceFrom(params)} />;
}
