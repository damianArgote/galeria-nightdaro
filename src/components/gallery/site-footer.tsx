import type { SiteSocials } from "@/core/site/site-settings";

const LABELS: Record<keyof SiteSocials, string> = {
  instagram: "IG",
  x: "X",
  facebook: "FB",
  tiktok: "TT",
};

function handle(url: string) {
  try {
    return new URL(url).pathname.replace(/^\/|\/$/g, "") || url;
  } catch {
    return url;
  }
}

export function SiteFooter({ name, socials }: { name: string; socials: SiteSocials }) {
  const contact = process.env.CONTACT_EMAIL;
  return (
    <footer id="redes" className="border-t border-[#2e2470] py-11">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-6 px-4">
        <div className="flex flex-wrap gap-2.5">
          {(Object.keys(LABELS) as (keyof SiteSocials)[]).map((network) =>
            socials[network] ? (
              <a
                key={network}
                href={socials[network]}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-[#2e2470] px-3 py-2 font-label text-[13px] hover:border-brand-green"
              >
                {LABELS[network]} · {handle(socials[network]!)}
              </a>
            ) : null,
          )}
          <a
            href="/apoyar"
            className="rounded-full border border-brand-violet px-3 py-2 font-label text-[13px]"
          >
            Patreon
          </a>
        </div>
        <p className="m-0 max-w-[60ch] text-[13px] text-[#aaa4d8]">
          © {new Date().getFullYear()} {name}. Todas las ilustraciones son obra original o fan art
          de personajes adultos. Prohibida su redistribución.
          {contact && (
            <>
              {" "}
              Contacto:{" "}
              <a href={`mailto:${contact}`} className="underline">
                {contact}
              </a>
              .
            </>
          )}
        </p>
      </div>
    </footer>
  );
}
