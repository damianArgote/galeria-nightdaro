"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useState, useTransition } from "react";
import type { Artwork, ArtworkKind } from "@/core/artworks/artwork";
import { ArtworkForm } from "@/components/admin/artwork-form";
import { RATING_LABELS, STATUS_LABELS } from "@/components/admin/artwork-labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  deleteArtworkAction,
  hideArtworkAction,
  publishArtworkAction,
  reorderGalleryAction,
  updateArtworkAction,
} from "./actions";

export interface Thumb {
  url: string;
  blurData: string | null;
}

export function GalleryManager({
  kind,
  artworks,
  thumbs,
}: {
  kind: ArtworkKind;
  artworks: Artwork[];
  thumbs: Record<string, Thumb>;
}) {
  const [items, setItems] = useState(artworks);
  const [error, setError] = useState<string>();
  const [, startTransition] = useTransition();

  // Server data wins after every revalidation.
  useEffect(() => setItems(artworks), [artworks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const previous = items;
    const next = arrayMove(
      items,
      items.findIndex((a) => a.id === active.id),
      items.findIndex((a) => a.id === over.id),
    );
    setItems(next);
    setError(undefined);
    startTransition(async () => {
      const result = await reorderGalleryAction({ kind, ids: next.map((a) => a.id) });
      if (!result.ok) {
        setItems(previous);
        setError(result.error);
      }
    });
  }

  if (items.length === 0) {
    return (
      <p className="rounded-md border-2 border-dashed border-border p-8 text-center text-muted-foreground">
        No hay obras en esta pestaña todavía.
      </p>
    );
  }

  return (
    <>
      {error && (
        <p role="status" className="mb-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((a) => a.id)} strategy={verticalListSortingStrategy}>
          <ul className="grid gap-2.5" aria-label="Obras en orden de la galería">
            {items.map((artwork, index) => (
              <ArtworkRow
                key={artwork.id}
                artwork={artwork}
                position={index + 1}
                thumb={thumbs[artwork.id]}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </>
  );
}

function ArtworkRow({
  artwork,
  position,
  thumb,
}: {
  artwork: Artwork;
  position: number;
  thumb?: Thumb;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: artwork.id,
  });

  const hidden = artwork.status === "hidden";

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-testid="artwork-row"
      className={cn(
        "grid grid-cols-[28px_56px_minmax(0,1fr)] items-center gap-3 rounded-sm border-2 border-border bg-background p-2.5 hover:border-brand-sky sm:grid-cols-[28px_56px_minmax(0,1fr)_auto]",
        isDragging && "relative z-10 opacity-60",
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-lg leading-none text-muted-foreground select-none"
        aria-label={`Mover ${artwork.title} (posición ${position})`}
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <div
        aria-hidden
        className={cn(
          "h-[70px] w-14 overflow-hidden rounded-xs border-2 border-black bg-[radial-gradient(60%_45%_at_40%_40%,var(--brand-violet),transparent_70%),radial-gradient(50%_40%_at_60%_80%,var(--brand-sky),transparent_70%),linear-gradient(160deg,var(--card),var(--background))] bg-cover bg-center",
          hidden && "opacity-45",
        )}
        style={thumb?.blurData ? { backgroundImage: `url(${thumb.blurData})` } : undefined}
      >
        {thumb && (
          // eslint-disable-next-line @next/next/no-img-element -- signed CDN URL, already resized
          <img
            src={thumb.url}
            alt=""
            draggable={false}
            loading="lazy"
            className="size-full object-cover"
            data-testid="artwork-thumb"
          />
        )}
      </div>
      <div className={cn("min-w-0", hidden && "opacity-60")}>
        <b className="block truncate">{artwork.title}</b>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Badge
            variant={artwork.status === "published" ? "default" : "outline"}
            className={cn(artwork.status === "published" && "bg-brand-green text-black")}
          >
            {STATUS_LABELS[artwork.status]}
          </Badge>
          <Badge variant="secondary">{RATING_LABELS[artwork.rating].label}</Badge>
          <span className="font-mono">/{artwork.slug}</span>
        </div>
      </div>
      <div className="col-span-3 flex flex-wrap gap-1.5 sm:col-span-1">
        <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>
          {editing ? "Cerrar" : "Editar"}
        </Button>
        {artwork.status === "published" ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => hideArtworkAction({ id: artwork.id }))}
          >
            Ocultar
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => run(() => publishArtworkAction({ id: artwork.id }))}
          >
            Publicar
          </Button>
        )}
        <Button
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={() => {
            if (confirm(`¿Borrar "${artwork.title}"? No se puede deshacer.`)) {
              run(() => deleteArtworkAction({ id: artwork.id }));
            }
          }}
        >
          Borrar
        </Button>
      </div>
      {error && <p className="col-span-full text-sm text-destructive">{error}</p>}
      {editing && (
        <div className="col-span-full mt-2 rounded-sm border-2 border-primary bg-card p-4">
          <ArtworkForm
            idPrefix={`edit-${artwork.id}`}
            artwork={artwork}
            submitLabel="Guardar cambios"
            onCancel={() => setEditing(false)}
            onSubmit={async (values) => {
              const result = await updateArtworkAction({ id: artwork.id, ...values });
              if (result.ok) setEditing(false);
              return result;
            }}
          />
        </div>
      )}
    </li>
  );
}
