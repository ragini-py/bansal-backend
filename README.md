# bansalnx-backend

Express + MongoDB API for the Bansal-nx storefront (`bansalnx-regal-suite`).
Cookie + JWT auth with role-based access control (customer vs admin),
replacing the frontend's `localStorage`-mocked auth in `src/lib/store.tsx`.

## Setup

```bash
npm install
npm run dev
```

Requires a MongoDB instance reachable at `MONGODB_URI` (default:
`mongodb://127.0.0.1:27017/bansalnx`) — install locally, run via Docker, or
point at Atlas. `.env` already has dev-safe defaults; only `MONGODB_URI`
needs to point at something real to actually boot.

## What's here

- `src/config/env.ts` — validated env config (zod)
- `src/db/connect.ts` — Mongoose connection
- `src/constants/roles.ts` — mirrors the frontend's `User["role"]` union (`customer` | `admin`)
- `src/utils/jwt.ts` — sign/verify the access token (JWT)
- `src/utils/random-token.ts` — opaque token + hash generation, used for refresh tokens
- `src/utils/password.ts` — bcrypt hash/compare
- `src/utils/cookies.ts` — httpOnly refresh-cookie helpers
- `src/middleware/authenticate.ts` — verifies `Authorization: Bearer <accessToken>`, attaches `req.user`
- `src/middleware/authorize.ts` — role-based access control, layers on top of `authenticate`
- `src/middleware/rate-limit.ts` — rate-limiter factory (test-isolated in `test/rate-limit.test.ts`)
- `src/middleware/validate.ts` — generic zod request-body validator
- `src/middleware/error-handler.ts` — central error handling (`AppError`, Zod validation errors)
- `src/modules/auth/models/` — `User` (with embedded `addresses`, matching the frontend's `User`/`Address` shape exactly) and `Session` (native MongoDB TTL index auto-expires it, no cleanup job needed)
- `src/modules/auth/` — routes → controller (HTTP only: req/res, cookies) → `auth.service.ts` (all business logic + Mongo calls)
- `src/modules/users/` — address management (`POST`/`DELETE /api/users/me/addresses`), authenticated; first address is always default, marking a new one default demotes the old one, deleting the default promotes another
- `src/modules/catalog/` — `Product`/`Collection` models + public read endpoints + one admin write endpoint (see below)
- `src/scripts/seed-catalog.ts` — migrates the frontend's mock catalog into MongoDB, upserted by slug (`npm run seed`)
- `src/modules/orders/` — `Order` model (embedded lines/address/payment/shipment/returnRequest snapshot, matching the frontend's `Order` type exactly) + create/list/update/return/track endpoints (see below)
- `src/modules/cart/` — one `Cart` document per user, full-replace GET/PUT (see below)
- `src/modules/wishlist/` — one `Wishlist` document per user (`productIds: string[]`), full-replace GET/PUT, same pattern as cart
- `src/modules/uploads/` — admin image upload, Cloudinary or local-disk fallback (see below)
- `src/utils/email.ts` — transactional email, real SMTP or console-log fallback (see below)
- `src/modules/settings/` — one singleton `Settings` document for the whole store, public GET, admin-editable PATCH for shipping/COD fields (see below)
- `src/modules/content/` — one singleton `Content` document backing the homepage (announcement bar, hero, editorial/promo/story copy, section visibility, featured product/collection picks), public GET, admin-editable PATCH (see below)
- `src/modules/coupons/` — `Coupon` model + public list, admin create/delete (matches AdminPage's CouponsManagerTab, which only creates and deletes — no edit-existing flow)
- `src/modules/auth/models/password-reset-token.model.ts` — opaque + DB-backed (same pattern as the refresh token), native TTL index
- `test/auth.e2e.test.ts`, `test/addresses.e2e.test.ts`, `test/catalog.e2e.test.ts`, `test/orders.e2e.test.ts`, `test/coupons.e2e.test.ts`, `test/password-reset.e2e.test.ts`, `test/admin-users.e2e.test.ts`, `test/cart.e2e.test.ts`, `test/uploads.e2e.test.ts`, `test/settings.e2e.test.ts`, `test/wishlist.e2e.test.ts`, `test/content.e2e.test.ts` — end-to-end against a real (in-memory) MongoDB instance
- `test/rate-limit.test.ts` — the rate-limiter mechanism, tested in isolation with its own tiny Express app

## Access token vs refresh token

- **Access token**: short-lived JWT (15m default), sent as `Authorization: Bearer <token>`, held in memory on the frontend. Never in a cookie, so it isn't CSRF-exposed.
- **Refresh token**: opaque random token (not a JWT), stored **hashed** in the `Session` collection, and raw in an `httpOnly`/`sameSite=lax` cookie scoped to `/api/auth`. `POST /api/auth/refresh` hashes the incoming cookie value, looks up the matching non-revoked `Session`, revokes it, and issues a brand-new session (rotation) — so a stolen-but-unused refresh token has a short shelf life, and logout can genuinely revoke it server-side rather than just clearing a cookie.

## Endpoints

Auth, matching the frontend's `User` shape in `data/types.ts` exactly:

| Method & path | Auth | Notes |
|---|---|---|
| `POST /api/auth/register` | — | rate-limited (5/hour); logs the user in immediately (matches `store.tsx`'s current `register()` behavior) |
| `POST /api/auth/login` | — | rate-limited (5/15min); `403` if the account is `blocked` |
| `POST /api/auth/refresh` | refresh cookie | rotates the session |
| `POST /api/auth/logout` | refresh cookie | revokes the session |
| `GET /api/auth/me` | access token | |

Addresses:

| Method & path | Auth | Notes |
|---|---|---|
| `POST /api/users/me/addresses` | access token | first address is always default; `isDefault: true` demotes the previous default |
| `DELETE /api/users/me/addresses/:id` | access token | removing the default promotes another address to default |

Catalog:

| Method & path | Auth | Notes |
|---|---|---|
| `GET /api/products` | — | full list, published and unpublished (client filters/sorts, matching the existing single-fetch mock pattern) |
| `GET /api/products/:slug` | — | |
| `POST /api/products` | admin | create; slug must be unique |
| `PUT /api/products/:id` | admin | full product replace |
| `DELETE /api/products/:id` | admin | |
| `GET /api/collections` | — | |
| `GET /api/collections/:slug` | — | |
| `POST /api/collections` | admin | create; slug must be unique |
| `PUT /api/collections/:id` | admin | full collection replace |
| `DELETE /api/collections/:id` | admin | |

Orders:

| Method & path | Auth | Notes |
|---|---|---|
| `POST /api/orders` | access token | creates an order; `userId` comes from the token, never the request body. **Line price/mrp, subtotal, discount, and total are all re-derived server-side** from live `Product`/`Coupon` data — the client's numbers are only used for request shape, never trusted for the actual charge (see "Order pricing & coupon enforcement" below) |
| `GET /api/orders/mine` | access token | the caller's own orders |
| `GET /api/orders` | admin | every order, across every customer |
| `PATCH /api/orders/:id` | admin | generic partial update — matches the frontend's `updateOrder(id, patch)` exactly (status changes, shipment dispatch, return approval) |
| `POST /api/orders/:id/return` | access token | must be the order's own owner |
| `POST /api/orders/:id/cancel` | access token | must be the order's own owner; only allowed while status is `confirmed`/`processing`/`packed`/`ready_for_pickup` (not yet shipped). Marks payment `refunded` if it was `paid`, `cancelled` otherwise |
| `GET /api/orders/track?id=&email=` | — | public guest lookup, matches TrackPage; **both `id` and `email` are required** — rate-limited (20/15min) since an order id alone (a Mongo ObjectId, not fully random) must never be enough on its own to pull someone else's name/phone/address |

### Order pricing & coupon enforcement

`createOrder` in `orders.service.ts` never trusts the client's price data:

- Every line's `price`/`mrp` is re-read from the live `Product` document by id (404s if the product no longer exists) — a request can't buy at an arbitrary price by editing the request body.
- `subtotal` is recomputed as the sum of re-priced lines.
- If a `couponCode` is present, it's re-validated from scratch against the live `Coupon` document: `active`, within `startsAt`/`expiresAt`, `subtotal >= minOrder`, `usageLimit` not exceeded, `perUserLimit` not exceeded for this caller (counted via existing `Order` documents), `newCustomerOnly` (caller must have zero prior orders), and `restrictedCollections` (at least one line's product must belong to one of the listed collections) — any failure is a 409, not a silent full-price fallback. `discount` is computed from the coupon's real `type`/`value`/`maxDiscount`, and the coupon's `timesUsed` is incremented once the order is created.
- `shippingFee` is re-derived from the live `Settings` document too: waived once `subtotal - discount` meets `freeShippingThreshold`, otherwise `shippingFee` + (`codFee` if the payment method is `cod`). A `cod` order is rejected outright (409) if `codEnabled` is off, or if the order total exceeds `codMaxOrderValue` — closing the same class of gap as pricing/coupons, since a tampered request could otherwise get free shipping or dodge the COD cap. `tax` is fixed at 0 (GST is included in listed prices, same as the frontend's own `totals()`).
- `total` is `max(subtotal - discount, 0) + shippingFee + tax`, and `payment.amount` is set to match.

Coupons:

| Method & path | Auth | Notes |
|---|---|---|
| `GET /api/coupons` | — | public — coupon codes/terms are visible to any storefront visitor today (checkout validates a code entirely client-side against this list), matching the existing mock behavior |
| `POST /api/coupons` | admin | code is uppercased and must be unique |
| `DELETE /api/coupons/:id` | admin | |

Password reset:

| Method & path | Auth | Notes |
|---|---|---|
| `POST /api/auth/forgot-password` | — | rate-limited (5/hour); **always** 204 regardless of whether the email matches an account (prevents enumeration, matches the frontend's own copy) |
| `POST /api/auth/reset-password` | — | token is single-use and expires after `PASSWORD_RESET_TTL_MS` (default 30 min); resetting revokes every existing session for that user |

No email provider is wired up — `requestPasswordReset` logs the reset link
(`{CORS_ORIGIN}/reset-password?token=...`) to the server console instead of
sending an email. Grab it from there to test the flow locally.

Admin user management:

| Method & path | Auth | Notes |
|---|---|---|
| `GET /api/users` | admin | every user, minus `passwordHash` |
| `PATCH /api/users/:id` | admin | `{role?, status?}` — promote/demote, block/unblock. An admin can't modify their own row here (self-lockout guard) |

Cart:

| Method & path | Auth | Notes |
|---|---|---|
| `GET /api/cart` | access token | returns `{ lines: [] }` if nothing's been saved yet |
| `PUT /api/cart` | access token | full replace (upsert) — the frontend sends its whole cart on every change |

One document per user. Guests keep a purely local/localStorage cart exactly
as before (no auth = no server cart); once signed in, the frontend merges
its local cart into whatever's saved server-side (summing quantities for
matching variants) and pushes every change after that, so a cart survives
across devices and sessions instead of living only in one browser.

Wishlist:

| Method & path | Auth | Notes |
|---|---|---|
| `GET /api/wishlist` | access token | returns `{ productIds: [] }` if nothing's been saved yet |
| `PUT /api/wishlist` | access token | full replace (upsert) |

Same sync model as cart: guests keep a local-only wishlist; once signed in,
the frontend merges the local list into the server's (union of both, since
there's no quantity to sum — just presence) and pushes every change after.

Image uploads:

| Method & path | Auth | Notes |
|---|---|---|
| `POST /api/uploads` | admin | multipart, field name `image`, 5MB limit, images only. Returns `{ url }` |

No credentials configured yet (see `.env.example`'s `CLOUDINARY_*`) — files
are written to `backend/uploads/` and served at `{APP_URL}/uploads/<file>`
instead, so admin product/collection image upload works fully today with
zero setup. Filling in all three `CLOUDINARY_*` values switches to
Cloudinary automatically, no code changes — see `modules/uploads/uploads.service.ts`.

Transactional email:

No credentials configured yet (see `.env.example`'s `SMTP_*`) — `sendEmail`
(`src/utils/email.ts`) logs the email to the console instead of sending it,
so the password-reset and order-confirmation flows are fully testable in
dev with zero setup. Filling in `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` switches
to real delivery through any SMTP provider (Postmark, SES, Mailgun, Gmail,
Mailtrap, ...) automatically, no code changes.

Settings:

| Method & path | Auth | Notes |
|---|---|---|
| `GET /api/settings` | — | public — Footer/ContactPage/ShippingPage/TermsPage etc. all read brand name, support contact, and shipping policy without signing in. Creates the (singleton) settings document with schema defaults on first call if none exists yet |
| `PATCH /api/settings` | admin | `{freeShippingThreshold?, shippingFee?, codMaxOrderValue?}` — the only fields AdminPage's SettingsManagerTab actually edits; other keys in the body are silently ignored, not rejected |

One document for the whole store (no per-user/tenant concept here). This is
what `createOrder`'s shipping/COD pricing reads from — an admin changing the
free-shipping threshold or shipping fee here takes effect on the very next
order. `emailProviderConnected` in the response is never stored — it's a
live `env.smtp !== null` check, so it always reflects whether SMTP is
actually configured, not a flag someone could forget to flip.

Homepage content:

| Method & path | Auth | Notes |
|---|---|---|
| `GET /api/content` | — | public — the homepage and navbar read this without signing in. Creates the (singleton) content document, seeded with the storefront's original launch copy, on first call if none exists yet |
| `PATCH /api/content` | admin | `{announcement?, hero?, editorial?, promo?, story?, sections?, featuredCollectionIds?, featuredProductIds?}` — every field the frontend actually renders is editable; `featuredCollectionIds`/`featuredProductIds` are slugs (matched against the live catalog by slug, not id, since ids are DB-generated and vary per deployment) |

One document for the whole store, same convention as Settings. `sections`
is an ordered list of `{key, label, visible}` toggles the homepage checks
before rendering each block (`collections`, `new-arrivals`, `editorial`,
`featured`, `bestsellers`, `promo`, `newsletter`, `story`) — an admin can
hide a section without deleting its copy.

## Security hardening

- **Refresh-token reuse detection** — a refresh token is only ever revoked by rotation, logout, or a password reset. If a *second* request tries to use one that's already revoked, that's treated as a compromise signal (stolen token replayed, or a race against the real client) and every other live session for that account is revoked too, not just the one request rejected. See `auth.service.ts`'s `rotateSession`.
- **CSRF protection on the two cookie-authenticated routes** — `POST /api/auth/refresh` and `POST /api/auth/logout` are the only routes that authenticate purely off the httpOnly refresh cookie (everything else requires a Bearer access token, which a cross-site request can't forge). Both now require a double-submit CSRF token: `setCsrfCookie` (`utils/csrf.ts`) sets a readable `csrfToken` cookie *and* returns the same value in the JSON body on register/login/refresh; the frontend sends it back as an `X-CSRF-Token` header, and `verifyCsrf` (`middleware/verify-csrf.ts`) 403s unless the cookie and header match. Returning the value in the response body (not just the cookie) means this keeps working even if the frontend and API end up on genuinely different domains later, where the frontend's JS couldn't read the API's cookie directly. Deploying this update means existing sessions that predate the `csrfToken` cookie will be signed out on their next refresh — a one-time transition cost, not a bug.
- **Coupon usage limits are enforced atomically** — `usageLimit` is claimed with a single conditional `findOneAndUpdate` immediately before the order is written, not read-then-increment-later, so two checkouts racing near the limit can't both slip through. If the order write fails afterward (no product, tampered line, etc.), the claimed slot is handed back. See `orders.service.ts`'s `createOrder`.
- **Idempotency key on `POST /orders`** — pass an `Idempotency-Key` header per checkout attempt; a retried request with the same key returns the original order instead of creating a duplicate. Scoped per-user via a partial unique index on `{userId, idempotencyKey}` (only enforced when a key is actually present, so older/keyless requests never collide).
- **Upload magic-byte verification** — `POST /api/uploads` sniffs the actual file bytes (`file-type` package) rather than trusting the client-declared mimetype/extension, which are trivially spoofed. Stored filenames are already randomized (`randomUUID()`), so there's no path-traversal/overwrite surface from the original filename either.
- **CORS is an allowlist, not a single origin** — `CORS_ORIGIN` accepts a comma-separated list; the `cors()` middleware checks the request's `Origin` against it via a function rather than a fixed string, so staging/prod domains can be added without a code change.
- **Lightweight NoSQL-injection guard** — `sanitizeMongo` (mounted globally in `app.ts`) strips any request body/params/query key starting with `$` or containing `.` before it reaches a route handler. Zod already blocks most of this today (a `z.string()` field rejects an object outright), but this is defense-in-depth for anything added later without strict validation.
- **`GET /healthz`** — a bare-path alias for `GET /api/health`, for load balancers/orchestrators that probe `/healthz` by convention.

Deliberately **not** addressed in this pass (each needs an infra or product decision first, not just code): CSRF protection for the refresh cookie, a Redis-backed rate limiter/blocklist for multi-instance deployments, Mongo multi-document transactions (needs a replica set), a secrets manager, and horizontal-scaling-safe local uploads (already mitigated by the existing Cloudinary fallback — force it in any multi-instance deployment).

## Scope of this pass — what's deliberately not here yet

Built incrementally, one module at a time — everything below is a deliberate
gap, not an oversight:

- **Most of `Settings` is read-only via the API** — `brandName`, `tagline`, `supportEmail`/`supportPhone`, `codEnabled`, `razorpayEnabled`/`razorpayConnected`, `delhiveryConnected`, `allowGuestBrowsing` all exist on the model (and are served by `GET /api/settings`) but have no admin UI to edit them yet, so there's no write path for them — same "don't build endpoints nothing calls" rule as everywhere else in this backend. `razorpayConnected`/`delhiveryConnected` are honestly `false` (no real integration exists for either).

## Testing

```bash
npm test        # full flow against a real (in-memory) MongoDB — node:test + mongodb-memory-server
npm run typecheck
npm run lint
npm run seed     # (re-)populate MongoDB with the migrated mock catalog — upserts by slug
```
