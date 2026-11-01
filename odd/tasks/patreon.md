# Feature: Patreon integration (Paso 12)

Objective: connect Daro's Patreon (read-only + webhook) to show subscriptions next to clicks, link artworks to their Patreon posts, and draft gallery artworks from new Patreon posts.
Branch: `feat/patreon`, stacked on `feat/beneficios` (PR #30, which owns migration 0003) until #30 merges, then rebased on `main`. Delivery: `ask-on-risk`. Tests: Vitest (unit + Postgres integration), Playwright e2e.

## Specs

- **S1** — From the plan: "Antes de codear verificá en https://docs.patreon.com los scopes, los triggers de webhook y el algoritmo de firma, y si algo difiere, actualizá docs/arquitectura.md en el mismo PR."
  Verified 2026-11-01 (see L3): scopes `campaigns`, `campaigns.members`, `campaigns.posts`, `w:campaigns.webhook`; triggers `members:create|update|delete`, `members:pledge:create|update|delete`, `posts:publish`; signature `X-Patreon-Signature` = hex HMAC-MD5 of the body with the webhook `secret`, event in `X-Patreon-Event`.
- **S2** — "PatreonPort en src/core y adaptador HTTP (API v2) en src/infra."
- **S3** — "/admin/links: botón Conectar Patreon (OAuth 2 con state contra CSRF); tokens cifrados con AES-256-GCM en una tabla nueva patreon_connection."
- **S4** — "Al conectar: leer la campaña y sus tiers, vincularlos con los tiers propios y crear el webhook de altas, bajas y cambios de pledge."
- **S5** — "Route handler /api/webhooks/patreon que verifica la firma sobre el body crudo, guarda el evento (idempotente) y actualiza una tabla patreon_members sin email ni nombre de fans."
- **S6** — "En el Resumen: altas, bajas, activos por tier e ingreso mensual estimado, junto a los clics."
- **S7** — User, 2026-11-01: "si sumalo" — answering the proposal: "Link de la obra a su post de Patreon. Un campo opcional en la obra, y en la ficha un botón "Ver completa en Patreon" que pase por `/r/` sabiendo **qué obra** generó el clic. Así el Resumen mostraría qué obras llevan más gente a Patreon."
- **S8** — User, 2026-11-01: "si" — answering: "Daro publica en Patreon, como siempre. Patreon avisa a la galería (`posts:publish`) y en el panel aparece **un borrador ya armado**, con el título, el link al post y la fecha. Daro solo agrega la imagen (la censurada o la sugerente), elige el rating y publica." Plus: "Cuando conectemos la cuenta, pruebo con un post real si la imagen viene en `content`." (needs scope `campaigns.posts`).
- **Done when** — "con la cuenta de Daro conectada aparecen sus tiers y una alta llega al Resumen."

Assumptions (not asked by the user, marked as such):

- A1: fans' Patreon member ids are stored to keep `patreon_members` current; names and emails are never requested (`campaigns.members[email]` is not asked) nor stored.
- A2: a draft created from a Patreon post gets rating `explicit` (the most restrictive) until Daro changes it.

## Tasks

| ID  | Specs     | Route         | Status  | Evidence                                                                                       |
| --- | --------- | ------------- | ------- | ---------------------------------------------------------------------------------------------- |
| T1  | S1        | inline        | done    | docs/arquitectura.md updated in T2's commit                                                    |
| T2  | S2, S3    | inline        | done    | 6b051f8: 238 unit + 5 e2e (patreon.spec) green; verifier PASS, 4 advisories fixed              |
| T3  | S4, S5    | inline        | done    | 319df64: 256 unit + 42 e2e green (patreon.spec: signed pledge once, 401/400); verifier pending |
| T4  | S6        | inline        | pending |                                                                                                |
| T5  | S7        | inline        | pending |                                                                                                |
| T6  | S8        | inline        | pending |                                                                                                |
| T7  | Done when | user + inline | pending | Patreon client registered, Render env vars, real connection                                    |

Route evidence: no Writer trigger — the units depend on each other (T3 needs T2's connection, T4 needs T3's data), so they run inline in order. T2, T3 and T6 touch security (OAuth, token encryption, webhook signature, fetching remote images): high-risk item 2, independent verifier after their checks.

## Log

- **L1** (2026-11-01, user): "se puede empezar el prompt 12?"
- **L2** (2026-11-01, user): "que se necesita de la cuenta de pateron? y que podria hacer con la integracion?" → answered: Daro's creator account + an API v2 client registered at patreon.com/portal with redirect `https://www.nightdaro.com/api/patreon/callback`.
- **L3** (2026-11-01): docs.patreon.com verified. OAuth authorize `https://www.patreon.com/oauth2/authorize`, token `https://www.patreon.com/api/oauth2/token` (refresh tokens are single-use); API rate limit 100 req/min per token; a User-Agent header is required; members paginate with `page[cursor]` and `meta.pagination.cursors.next`. Posts are read-only (no create/update endpoint), and the Post resource has no image attribute; `posts:publish` payload is not documented.
- **L4** (2026-11-01, user): "y cuando suba una obra cual seria el proceso?" / "me refiero el proceso con patreon" → S7 proposed.
- **L5** (2026-11-01, user): "si sumalo, entonces no hay forma de que suba una sola 1? si o si tiene que subir en patreon y en la galeria por separado?" → S8 proposed; user: "si".
- **L6** (2026-11-01): T2 done in 6b051f8. Disconnect deletes the webhook best-effort and forgets the connection even if Patreon fails. A connection sealed with another PATREON_TOKEN_KEY shows as disconnected (reconnect). e2e runs with a configured but unreachable Patreon client (stops at the redirect); the full OAuth exchange is covered by unit tests with the fake port.
- **L7** (2026-11-01, user): chose "Uno tras otro a main (Recommended)" for the chain strategy: each PR goes to main when ready, the next one starts from the updated main. PR 1 = T1+T2 (stacked on #30 until it merges).
- **L8** (2026-11-01): T2 verifier PASS. Fixed: refresh reuses a pair another caller already stored; a refresh saved-fail logs "reconnect"; GCM tag length pinned to 16; a misconfigured client only disables the Patreon panel. Deferred to T3: inject a shared PatreonAccess from the container.
- **L9** (2026-11-01): T3 done in 319df64 (PR 2, branch `feat/patreon-webhook` stacked on `feat/patreon`). On connect: Patreon tiers stored in `patreon_tiers`, ours linked by unique price then name (a hand-picked link stays; a Patreon tier is never linked twice: use-case ConflictError + unique index), the webhook is created once, members replaced. If set-up fails after the connection is saved, the panel says "incompleto" and connecting again retries. Webhook: signature checked before parsing, 1 MB cap, unknown event 400, `posts:publish` acknowledged (204) until T6; event key = sha256(trigger + raw body).
- Next: T4.
