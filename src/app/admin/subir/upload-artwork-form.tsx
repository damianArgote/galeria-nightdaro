"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";
import { Upload as TusUpload } from "tus-js-client";
import { z } from "zod";
import type { ActionResult } from "@/app/admin/_lib/action-result";
import { ARTWORK_RATINGS } from "@/core/artworks/artwork";
import { artworkFieldsSchema } from "@/core/artworks/artwork-schemas";
import { applyFieldErrors } from "@/components/admin/apply-field-errors";
import { KIND_LABELS, RATING_LABELS } from "@/components/admin/artwork-labels";
import { FormField } from "@/components/admin/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { deleteArtworkAction } from "../galeria/actions";
import { startTimelapseUploadAction } from "./actions";

const MAX_BYTES = 30 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp";
const ACCEPT_VIDEO = "video/mp4,video/quicktime,video/webm,video/x-matroska";
const UPLOAD_KINDS = ["finished", "wip", "timelapse"] as const;
const KIND_NAMES: Record<(typeof UPLOAD_KINDS)[number], string> = {
  finished: "Terminado",
  wip: "En proceso",
  timelapse: "Timelapse",
};

const formSchema = z.object({
  title: artworkFieldsSchema.shape.title,
  description: z.string().max(500),
  kind: z.enum(UPLOAD_KINDS),
  rating: z.enum(ARTWORK_RATINGS, { error: "Elegí un rating" }),
  tags: z.string().max(800),
  charactersAreAdults: z.literal(true, {
    error: "Confirmá que todos los personajes son adultos",
  }),
});
type FormValues = z.input<typeof formSchema>;

/** Quick client check; the server checks the real file type by its magic bytes. */
function fileProblem(file: File): string | undefined {
  if (!ACCEPT.split(",").includes(file.type)) return "Solo JPG, PNG o WebP";
  if (file.size > MAX_BYTES) return "El archivo supera los 30 MB";
}

/** Bunny Stream validates the video itself; it fails the encoding if the file is not one. */
function videoProblem(file: File): string | undefined {
  if (!file.type.startsWith("video/")) return "Elegí un archivo de video";
}

export function UploadArtworkForm() {
  const router = useRouter();
  const [image, setImage] = useState<File>();
  const [censored, setCensored] = useState<File>();
  const [fileErrors, setFileErrors] = useState<{ image?: string; censored?: string }>({});
  const [progress, setProgress] = useState<number>();
  const [formError, setFormError] = useState<string>();
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", description: "", kind: "finished", tags: "" },
  });
  const explicit = watch("rating") === "explicit";
  const timelapse = watch("kind") === "timelapse";

  async function uploadTimelapse(values: FormValues, file: File) {
    const tags = values.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const started = await startTimelapseUploadAction({
      title: values.title,
      description: values.description,
      rating: values.rating,
      tags,
      charactersAreAdults: true,
    });
    if (!started.ok) {
      setFormError(started.error);
      applyFieldErrors(setError, started.fieldErrors);
      return;
    }

    const { artworkId, upload } = started.data;
    setProgress(0);
    try {
      await uploadToStream(file, values.title, upload, setProgress);
      router.push("/admin/galeria?tipo=timelapse");
    } catch {
      await deleteArtworkAction({ id: artworkId });
      setProgress(undefined);
      setFormError("La subida del video falló. Probá de nuevo.");
    }
  }

  const submit = handleSubmit(async (values) => {
    setFormError(undefined);
    if (!image) {
      setFileErrors({ image: timelapse ? "Elegí un video" : "Elegí una imagen" });
      return;
    }
    if (values.kind === "timelapse") {
      await uploadTimelapse(values, image);
      return;
    }
    const body = new FormData();
    body.set("title", values.title);
    body.set("description", values.description);
    body.set("kind", values.kind);
    body.set("rating", values.rating);
    for (const tag of values.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)) {
      body.append("tags", tag);
    }
    body.set("charactersAreAdults", "true");
    body.set("image", image);
    if (explicit && censored) body.set("censored", censored);

    setProgress(0);
    const result = await uploadWithProgress(body, setProgress);
    if (result.ok) {
      router.push(`/admin/galeria?tipo=${result.data.kind}`);
      return;
    }
    setProgress(undefined);
    setFormError(result.error);
    const { image: imageError, censored: censoredError, ...rest } = result.fieldErrors ?? {};
    setFileErrors({ image: imageError?.[0], censored: censoredError?.[0] });
    applyFieldErrors(setError, rest);
  });

  const uploading = progress !== undefined;

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-bold">Tipo</legend>
        <div className="flex flex-wrap gap-1.5 rounded-sm border-2 border-black bg-card p-1 shadow-[3px_3px_0_#000]">
          {UPLOAD_KINDS.map((kind) => (
            <label
              key={kind}
              className="flex-1 cursor-pointer rounded-xs px-3 py-1.5 text-center text-sm font-bold text-muted-foreground has-checked:bg-foreground has-checked:text-background has-focus-visible:outline-2"
            >
              <input type="radio" value={kind} className="sr-only" {...register("kind")} />
              <span aria-hidden className="block text-xs tracking-[0.3em] opacity-80">
                {KIND_LABELS[kind].kanji}
              </span>
              {KIND_NAMES[kind]}
            </label>
          ))}
        </div>
      </fieldset>

      <ImageDrop
        key={timelapse ? "video" : "image"}
        label={timelapse ? "Video" : "Imagen"}
        hint={
          timelapse
            ? "MP4, MOV, WebM o MKV · se sube directo a Bunny Stream, que lo sirve en HLS con marca de agua"
            : "JPG, PNG o WebP · hasta 30 MB · el original se guarda en privado"
        }
        accept={timelapse ? ACCEPT_VIDEO : ACCEPT}
        file={image}
        error={fileErrors.image}
        onChange={(file) => {
          setImage(file);
          const problem = file && (timelapse ? videoProblem(file) : fileProblem(file));
          setFileErrors((e) => ({ ...e, image: problem }));
        }}
      />

      <FormField id="upload-title" label="Título" error={errors.title?.message}>
        <Input id="upload-title" aria-invalid={!!errors.title} {...register("title")} />
      </FormField>
      <FormField
        id="upload-description"
        label="Descripción"
        hint=" · Opcional, se ve debajo de la obra."
        error={errors.description?.message}
      >
        <Textarea id="upload-description" rows={2} {...register("description")} />
      </FormField>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-bold">Rating</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {ARTWORK_RATINGS.map((rating) => (
            <label
              key={rating}
              className={cn(
                "cursor-pointer rounded-md border-[3px] border-border bg-background p-3 has-focus-visible:outline-2",
                "has-checked:border-black has-checked:bg-card",
                rating === "explicit"
                  ? "has-checked:shadow-[4px_4px_0_#ff4fd8]"
                  : "has-checked:shadow-[4px_4px_0_var(--brand-green)]",
              )}
            >
              <input type="radio" value={rating} className="sr-only" {...register("rating")} />
              <b className="block text-sm">{RATING_LABELS[rating].label}</b>
              <span className="text-xs text-muted-foreground">
                {RATING_LABELS[rating].description}
              </span>
            </label>
          ))}
        </div>
        {errors.rating && <p className="text-xs text-destructive">{errors.rating.message}</p>}
      </fieldset>

      {explicit && !timelapse && (
        <ImageDrop
          accept={ACCEPT}
          label="Versión censurada"
          hint="Opcional. Si no la subís, la web muestra un desenfoque fuerte."
          file={censored}
          error={fileErrors.censored}
          onChange={(file) => {
            setCensored(file);
            setFileErrors((e) => ({ ...e, censored: file && fileProblem(file) }));
          }}
        />
      )}

      <FormField
        id="upload-tags"
        label="Etiquetas"
        hint=" · Separadas por coma."
        error={errors.tags?.message}
      >
        <Input id="upload-tags" {...register("tags")} />
      </FormField>

      <div>
        <label className="flex cursor-pointer items-start gap-3 rounded-sm border-2 border-border bg-background p-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-brand-violet"
            {...register("charactersAreAdults")}
          />
          <span>
            <b className="block">Todos los personajes son adultos</b>
            <span className="text-xs text-muted-foreground">
              Obligatorio. No se publica nada con personajes de aspecto infantil.
            </span>
          </span>
        </label>
        {errors.charactersAreAdults && (
          <p className="mt-1 text-xs text-destructive">{errors.charactersAreAdults.message}</p>
        )}
      </div>

      {uploading && (
        <div className="grid gap-1">
          <div
            role="progressbar"
            aria-label="Progreso de la subida"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            className="h-2 overflow-hidden rounded-full bg-border"
          >
            <div
              className="h-full bg-brand-sky transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {progress! < 100 ? `Subiendo… ${progress}%` : "Procesando la imagen…"}
          </p>
        </div>
      )}
      {formError && (
        <p className="text-sm text-destructive" data-testid="form-error">
          {formError}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={uploading || !!fileErrors.image || !!fileErrors.censored}>
          {uploading ? "Subiendo…" : "Crear borrador"}
        </Button>
      </div>
    </form>
  );
}

function ImageDrop({
  label,
  hint,
  accept,
  file,
  error,
  onChange,
}: {
  label: string;
  hint: string;
  accept: string;
  file?: File;
  error?: string;
  onChange: (file: File | undefined) => void;
}) {
  const id = useId();
  const [over, setOver] = useState(false);
  const [preview, setPreview] = useState<string>();

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) return setPreview(undefined);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-bold">{label}</span>
      <label
        htmlFor={id}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          onChange(event.dataTransfer.files[0]);
        }}
        className={cn(
          "relative grid cursor-pointer place-items-center gap-2 rounded-md border-[3px] border-dashed bg-background p-6 text-center transition-colors has-focus-visible:outline-2",
          over || file ? "border-brand-sky" : "border-border hover:border-brand-sky",
          error && "border-destructive",
        )}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
          <img src={preview} alt="" className="max-h-48 rounded-sm border-2 border-black" />
        ) : (
          <span aria-hidden className="text-4xl leading-none text-brand-sky">
            墨
          </span>
        )}
        <b className="text-sm">{file ? file.name : `Arrastrá el archivo o tocá para elegirlo`}</b>
        <small className="text-xs text-muted-foreground">{hint}</small>
        <input
          id={id}
          type="file"
          accept={accept}
          aria-label={label}
          className="sr-only"
          onChange={(event) => onChange(event.target.files?.[0])}
        />
      </label>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** fetch() cannot report upload progress; XMLHttpRequest can. */
function uploadWithProgress(
  body: FormData,
  onProgress: (percent: number) => void,
): Promise<ActionResult<{ kind: string }>> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/artworks");
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () =>
      resolve(
        xhr.response && typeof xhr.response === "object"
          ? xhr.response
          : { ok: false, error: `La subida falló (${xhr.status}).` },
      );
    xhr.onerror = () => resolve({ ok: false, error: "No se pudo conectar. Probá de nuevo." });
    xhr.send(body);
  });
}

/** Uploads straight to Bunny Stream with the server-signed, single-video authorization. */
function uploadToStream(
  file: File,
  title: string,
  auth: {
    endpoint: string;
    videoId: string;
    libraryId: string;
    signature: string;
    expires: number;
  },
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new TusUpload(file, {
      endpoint: auth.endpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        AuthorizationSignature: auth.signature,
        AuthorizationExpire: String(auth.expires),
        VideoId: auth.videoId,
        LibraryId: auth.libraryId,
      },
      metadata: { filetype: file.type, title },
      onProgress: (sent, total) => onProgress(Math.round((sent / total) * 100)),
      onError: reject,
      onSuccess: () => resolve(),
    });
    upload.start();
  });
}
