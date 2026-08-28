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
- `src/modules/coupons/` — `Coupon` model + public list, admin create/delete (matches AdminPage's CouponsManagerTab, which only creates and deletes — no edit-existing flow)
- `src/modules/auth/models/password-reset-token.model.ts` — opaque + DB-backed (same pattern as the refresh token), native TTL index
- `src/modules/example.routes.ts` — reference routes showing both access-control layers in use, and a template for future admin-only routes
- `test/auth.e2e.test.ts`, `test/addresses.e2e.test.ts`, `test/catalog.e2e.test.ts`, `test/orders.e2e.test.ts`, `test/coupons.e2e.test.ts`, `test/password-reset.e2e.test.ts` — end-to-end against a real (in-memory) MongoDB instance
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
| `PUT /api/products/:id` | admin | full product replace; only path AdminPage's ProductsManagerTab actually uses (publish toggle, price edit) |
| `GET /api/collections` | — | |
| `GET /api/collections/:slug` | — | |

Orders:

| Method & path | Auth | Notes |
|---|---|---|
| `POST /api/orders` | access token | creates an order from CheckoutPage's already-computed cart/pricing; `userId` comes from the token, never the request body |
| `GET /api/orders/mine` | access token | the caller's own orders |
| `GET /api/orders` | admin | every order, across every customer |
| `PATCH /api/orders/:id` | admin | generic partial update — matches the frontend's `updateOrder(id, patch)` exactly (status changes, shipment dispatch, return approval) |
| `POST /api/orders/:id/return` | access token | must be the order's own owner |
| `GET /api/orders/track?id=&email=` | — | public guest lookup, matches TrackPage; `email` narrows the match if given |

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

## Scope of this pass — what's deliberately not here yet

Built incrementally, one module at a time — everything below is a deliberate
gap, not an oversight:

- **Product/collection create & delete, and all of collections management** — no admin UI calls them yet (AdminPage only toggles publish + edits price on existing products), so no endpoints were added for them. `saveCollection`/`deleteCollection`/`deleteProduct` still exist in the frontend's `useStore()` as local-only state.
- **Real image uploads** — seeded product/collection images are static files under the frontend's `public/products/` and `public/collections/` folders (stable, unhashed URLs), not an uploaded-asset pipeline. Fine for the migrated mock catalog; a real admin "add new product" flow will need actual image upload/storage.
- **Order pricing/cart is still client-computed** — `POST /api/orders` persists the order the frontend already builds (subtotal/discount/total etc.) rather than recomputing and verifying it server-side from live product prices. Cart itself remains entirely client-side/localStorage. Re-deriving pricing server-side (and rejecting a tampered total) is real future hardening, deliberately out of scope here — this pass made an existing client action durable, it didn't change the trust boundary.
- **`cancelOrder`** — no UI calls it; stays a local-only mutation in the frontend store, same rule as above.
- **Coupon usage enforcement** — `usageLimit`/`perUserLimit`/`newCustomerOnly`/`restrictedCollections` exist on the model and are stored, but (matching the pre-existing mock behavior exactly) nothing actually enforces them yet — `applyCoupon` only checks `active`, `expiresAt`, and `minOrder`. `timesUsed` is stored but never incremented.
- **Real transactional email** — see "Password reset" above; a real provider (Postmark/SES/etc.) is a separate future integration.
- **Admin user management** (promoting a user to `admin`, blocking accounts) — no endpoint exists; the `role`/`status` fields are there on the model, tested directly against the DB in `auth.e2e.test.ts`, but need a real admin-only route once the admin panel is wired up.

## Testing

```bash
npm test        # full flow against a real (in-memory) MongoDB — node:test + mongodb-memory-server
npm run typecheck
npm run lint
npm run seed     # (re-)populate MongoDB with the migrated mock catalog — upserts by slug
```
