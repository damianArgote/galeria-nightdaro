"use client";

import { useState, useTransition } from "react";
import type { PatreonPost } from "@/core/patreon/patreon";
import type { ArtworkRef, PatreonSyncPreview } from "@/core/patreon/post-sync";
import { Panel, PanelHeader } from "@/components/admin/panel";
import { selectClassName } from "@/components/admin/form-field";
import { Button } from "@/components/ui/button";
import { createDraftsAction, linkPostAction } from "./actions";

const MAX_DRAFTS = 20;

const date = (value: Date | null) =>
  value
    ? new Intl.DateTimeFormat("es-AR", {
        dateStyle: "medium",
        timeZone: "America/Argentina/Buenos_Aires",
      }).format(new Date(value))
    : "sin fecha";

function PostTitle({ post }: { post: PatreonPost }) {
  return (
    <div className="min-w-0">
      {post.url ? (
        <a
          href={post.url}
          target="_blank"
          rel="noreferrer"
          className="font-bold underline-offset-2 hover:underline"
        >
          {post.title || "Post sin título"}
        </a>
      ) : (
        <b>{post.title || "Post sin título"}</b>
      )}
      <span className="ml-2 font-mono text-xs text-muted-foreground">{date(post.publishedAt)}</span>
    </div>
  );
}

/** Pick an artwork (preselected when the title matched) and link it to the post. */
function LinkRow({
  post,
  suggested,
  available,
  onError,
}: {
  post: PatreonPost;
  suggested?: ArtworkRef;
  available: ArtworkRef[];
  onError: (message: string | undefined) => void;
}) {
  const [artworkId, setArtworkId] = useState(suggested?.id ?? "");
  const [pending, startTransition] = useTransition();
  const options = suggested
    ? [suggested, ...available.filter((a) => a.id !== suggested.id)]
    : available;

  return (
    <li
      data-testid="sync-row"
      className="flex flex-wrap items-center justify-between gap-3 rounded-sm border-2 border-border bg-background p-3"
    >
      <PostTitle post={post} />
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label={`Obra para «${post.title ?? "post"}»`}
          className={selectClassName}
          value={artworkId}
          onChange={(event) => setArtworkId(event.target.value)}
        >
          <option value="">Elegí una obra…</option>
          {options.map((artwork) => (
            <option key={artwork.id} value={artwork.id}>
              {artwork.title}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant={suggested ? "default" : "outline"}
          disabled={!artworkId || pending}
          onClick={() =>
            startTransition(async () => {
              onError(undefined);
              const result = await linkPostAction({ artworkId, postId: post.id });
              if (!result.ok) onError(result.error);
            })
          }
        >
          Vincular
        </Button>
      </div>
    </li>
  );
}

export function SyncReview({ preview }: { preview: PatreonSyncPreview }) {
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string>();
  const [pending, startTransition] = useTransition();

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_DRAFTS) next.add(id);
      return next;
    });

  return (
    <div className="grid max-w-4xl gap-6">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-brand-green">
          {notice}
        </p>
      )}

      <Panel data-tour="sync-suggested">
        <PanelHeader
          title={`Coinciden por título (${preview.suggested.length})`}
          description="Posts que parecen ser una obra que ya está en la galería. Revisá la obra elegida y vinculá."
        />
        {preview.suggested.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay coincidencias por título.</p>
        ) : (
          <ul className="grid gap-2">
            {preview.suggested.map(({ post, artwork }) => (
              <LinkRow
                key={post.id}
                post={post}
                suggested={artwork}
                available={preview.available}
                onError={setError}
              />
            ))}
          </ul>
        )}
      </Panel>

      <Panel data-tour="sync-missing">
        <PanelHeader
          title={`Sin obra en la galería (${preview.missing.length})`}
          description={`Marcá los que querés traer como borrador (hasta ${MAX_DRAFTS} por vez), o vinculá uno a una obra existente.`}
        />
        {preview.missing.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todos los posts tienen su obra.</p>
        ) : (
          <>
            <ul className="mb-4 grid gap-2">
              {preview.missing.map((post) => (
                <li
                  key={post.id}
                  data-testid="sync-missing-row"
                  className="flex flex-wrap items-center justify-between gap-3 rounded-sm border-2 border-border bg-background p-3"
                >
                  <label className="flex min-w-0 cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      className="size-4 accent-brand-violet"
                      checked={selected.has(post.id)}
                      onChange={() => toggle(post.id)}
                    />
                    <PostTitle post={post} />
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Cada borrador llega como explícito y desenfocado, con el link al post y su imagen si
                Patreon la incluye. Lo revisás y lo publicás desde Galería.
              </p>
              <Button
                disabled={selected.size === 0 || pending}
                onClick={() =>
                  startTransition(async () => {
                    setError(undefined);
                    setNotice(undefined);
                    const result = await createDraftsAction({ postIds: [...selected] });
                    if (!result.ok) return setError(result.error);
                    setSelected(new Set());
                    setNotice(`Listo: ${result.data.created} borradores en Galería.`);
                  })
                }
              >
                {pending
                  ? "Creando…"
                  : selected.size > 0
                    ? `Crear ${selected.size} borradores`
                    : "Crear borradores"}
              </Button>
            </div>
          </>
        )}
      </Panel>

      {preview.missing.length > 0 && preview.available.length > 0 && (
        <Panel>
          <PanelHeader
            title="¿Alguno ya está en la galería con otro nombre?"
            description="Vinculalo a mano en vez de crear un borrador."
          />
          <ul className="grid gap-2">
            {preview.missing.map((post) => (
              <LinkRow key={post.id} post={post} available={preview.available} onError={setError} />
            ))}
          </ul>
        </Panel>
      )}

      <Panel>
        <details>
          <summary className="cursor-pointer font-bold">
            Ya vinculados ({preview.linked.length})
          </summary>
          <ul className="mt-3 grid gap-1.5 text-sm">
            {preview.linked.map(({ post, artwork }) => (
              <li key={post.id} className="flex flex-wrap justify-between gap-2">
                <PostTitle post={post} />
                <span className="text-muted-foreground">→ {artwork.title}</span>
              </li>
            ))}
          </ul>
        </details>
      </Panel>
    </div>
  );
}
