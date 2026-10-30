"use client";

import { useRouter } from "next/navigation";
import { ArtworkForm } from "@/components/admin/artwork-form";
import { createArtworkAction } from "./actions";

export function CreateArtworkForm() {
  const router = useRouter();

  return (
    <ArtworkForm
      submitLabel="Crear borrador"
      onSubmit={async (values) => {
        const result = await createArtworkAction(values);
        if (result.ok) router.push(`/admin/galeria?tipo=${result.data.kind}`);
        return result;
      }}
    />
  );
}
