import { GalleryView } from "@/components/gallery/gallery-view";
import { audienceFrom, localeFrom } from "../../../audience-params";

export const revalidate = 300;

type Params = Promise<{ locale: string; audience: string }>;

export default async function Page({ params }: { params: Params }) {
  return (
    <GalleryView
      kind="wip"
      audience={await audienceFrom(params)}
      locale={await localeFrom(params)}
    />
  );
}
