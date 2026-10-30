import type { ArtworkKind, ArtworkRating, ArtworkStatus } from "@/core/artworks/artwork";

export const KIND_LABELS: Record<ArtworkKind, { label: string; kanji: string }> = {
  finished: { label: "Terminado", kanji: "完成" },
  wip: { label: "En proceso", kanji: "制作中" },
  timelapse: { label: "Timelapses", kanji: "動画" },
};

export const RATING_LABELS: Record<ArtworkRating, { label: string; description: string }> = {
  sfw: { label: "Apto para todos", description: "Se ve sin la puerta +18." },
  suggestive: { label: "Sugerente", description: "Solo después de aceptar la puerta +18." },
  explicit: { label: "Explícito", description: "En la web solo la versión censurada." },
};

export const STATUS_LABELS: Record<ArtworkStatus, string> = {
  draft: "Borrador",
  published: "Publicada",
  hidden: "Oculta",
};
