# Feature: more admins with usernames and temporary passwords, and panel tutorials

Objective: an owner creates admins with a username and a temporary password that must be changed on first login; every panel section gets a driver.js tutorial.
Branch: one branch per PR from `main` (`feat/admins-auth`, `feat/admins-panel`, `feat/tutoriales`). Delivery: `stacked-to-main` style, one PR after another to `main` (user's choice for Paso 12, L7 of `odd/tasks/patreon.md`). Tests: Vitest + Playwright.

## Specs

- **S1** — User, 2026-11-01: "agregar mas admins generar sus usuarios y password temporal, luego que lo cambien al loguearse la primera vez"
- **S2** — User, 2026-11-01: "no tiene que ser un email el usuario pueder ser un username"
- **S3** — User, 2026-11-01: "para el panel agregar tutoriales de cada seccion con driver.js para que cada admin sepa como usar el panel y sea un onboarding facil"
- **S4** — User, 2026-11-01, answering "¿quién puede hacerlo?": "Solo un dueño (Recommended)" — "Hay un rol "dueño" (vos o Daro) que crea, resetea y desactiva admins. Los demás usan el panel igual que ahora, pero no ven la sección de usuarios."

Assumptions (marked, not asked):

- A1: existing users become owners (production has a single admin today). Their username is the part of the email before `@`; login accepts that username or the old email.
- A2: a temporary password is shown once in the panel, for the owner to pass on; it is never emailed or stored in clear.
- A3: a chosen password needs at least 12 characters and cannot be the temporary one.
- A4: disabling an admin, resetting their password or changing it ends their sessions immediately (session version checked on every request); an owner cannot disable themselves or the last active owner.
- A5: each tutorial starts by itself the first time an admin opens that section (remembered per admin in the browser) and can be replayed with a "Ver tutorial" button.

## Tasks

| ID  | Specs      | Route  | Status  | Evidence                                                                     |
| --- | ---------- | ------ | ------- | ---------------------------------------------------------------------------- |
| T1  | S1, S2, S4 | inline | done    | cf89277: 284 unit + 46 e2e green; verifier PASS, advisories fixed in 1df802f |
| T2  | S1, S4     | inline | pending | /admin/usuarios for the owner                                                |
| T3  | S3         | inline | pending | driver.js tours                                                              |

Route evidence: no Writer trigger — T2 depends on T1's model; T3 is independent but small. T1 and T2 touch authentication and permissions: high-risk item 2, independent verifier after their checks.

## Log

- **L1** (2026-11-01, user): "prs listos, faltaria agregar lo siguiente, agregar mas admins generar sus usuarios y password temporal, luego que lo cambien al loguearse la primera vez no tiene que ser un email el usuario pueder ser un username, y para el panel agregar tutoriales de cada seccion con driver.js para que cada admin sepa como usar el panel y sea un onboarding facil"
- **L2** (2026-11-01, user): permissions → "Solo un dueño (Recommended)".
- **L3** (2026-11-01): today sessions are 30-day JWTs and requireAdmin() only checks the token, so a disabled admin would keep access for a month; T1 adds a session version checked against the database.
- **L4** (2026-11-01): T1 done in cf89277. Migration 0006 backfills usernames from the email's local part (numbered on collision, padded to 3) and makes existing admins owners; tested on a scratch DB. requireAdmin() reads the admin on every call (active + session version); requireAdminPage() redirects to /login or /cambiar-clave. The guard test now scans every Server Action in src/app with an explicit public allowlist. The change-password form uses onSubmit because React 19 empties a form after its action (it wiped the temporary password after a rejected attempt). e2e uses CLIENT_IP_HEADER so a spec can have its own login rate-limit bucket.
- **L5** (2026-11-01): T1 verifier PASS. Fixed in 1df802f: adminRoute answers 403 (not 500) with a temporary password; password change limited to 5 attempts/min per admin; the password is written only if the session version is unchanged and the admin is active (cannot undo a concurrent disable/reset); only changePasswordAction may pass allowTemporaryPassword (guard test); the seed creates no admin once an owner exists. Not changed: migration edge case with crafted names like "foo-2" (single row in production).
- Pending elsewhere: Patreon T5–T7 (`odd/tasks/patreon.md`).
- Next: T1.
