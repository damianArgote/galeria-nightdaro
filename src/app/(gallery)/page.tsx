import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 text-center">
      <p className="text-sm font-semibold tracking-[0.3em] text-brand-green uppercase">Galería</p>
      <h1 className="text-6xl font-black tracking-tight text-primary drop-shadow-[0_0_24px_var(--brand-violet)] sm:text-8xl">
        NightDaro
      </h1>
      <p className="max-w-md text-lg text-secondary">Arte, procesos y timelapses.</p>
      <div className="flex gap-3">
        <Button>Ver galería</Button>
        <Button variant="secondary">Apoyar</Button>
      </div>
      <div className="flex gap-2" aria-hidden>
        <span className="size-3 rounded-full bg-brand-violet" />
        <span className="size-3 rounded-full bg-brand-sky" />
        <span className="size-3 rounded-full bg-brand-green" />
      </div>
    </main>
  );
}
