import { cn } from "@/lib/utils";

/** Manga-style panel: thick black border with a hard shadow. */
export function Panel({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-md border-[3px] border-black bg-card p-5 shadow-[6px_6px_0_#000]",
        className,
      )}
      {...props}
    />
  );
}

export function PanelHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-heading text-xl font-black">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function ViewHeader({
  kanji,
  eyebrow,
  title,
  description,
}: {
  kanji: string;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="mb-6 flex items-end justify-between gap-4">
      <div>
        <p className="font-mono text-[11px] tracking-[0.14em] text-brand-green uppercase">
          <span className="mr-2 text-sm tracking-[0.2em] text-foreground normal-case">{kanji}</span>
          {eyebrow}
        </p>
        <h1 className="mt-1.5 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-1.5 max-w-[60ch] text-muted-foreground">{description}</p>
      </div>
      <span
        aria-hidden
        className="hidden self-start text-5xl leading-none tracking-[0.15em] text-foreground/15 sm:block"
      >
        {kanji}
      </span>
    </header>
  );
}
