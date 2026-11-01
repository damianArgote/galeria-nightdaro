/** Sends an analytics event; never blocks or breaks the page. */
export function track(event: { type: "view" | "age_ok"; artworkId?: string }) {
  try {
    void fetch("/api/events", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...event, referrer: document.referrer || undefined }),
    }).catch(() => {});
  } catch {
    // Analytics must never affect the gallery.
  }
}
