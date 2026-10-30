import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { FieldErrors } from "@/app/admin/_lib/action-result";

/** Shows server-side validation errors on the matching form fields. */
export function applyFieldErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  fieldErrors: FieldErrors | undefined,
) {
  for (const [field, messages] of Object.entries(fieldErrors ?? {})) {
    if (messages?.[0]) setError(field as Path<T>, { message: messages[0] });
  }
}
