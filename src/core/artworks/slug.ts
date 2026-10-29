/** Builds a URL-safe artwork slug from its title, e.g. "Noche de Neón" -> "noche-de-neon". */
export function slugify(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
