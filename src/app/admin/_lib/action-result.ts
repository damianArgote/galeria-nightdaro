export type FieldErrors = Record<string, string[] | undefined>;

export type ActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: FieldErrors };
