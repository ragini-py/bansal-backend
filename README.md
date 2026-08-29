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
- `src/modules/coupons/` — `Coupon` model + public list, admin create/delete (matches AdminPage's CouponsManagerTab, which only creates and deletes — no edit-existing flow)
- `src/modules/auth/models/password-reset-token.model.ts` — opaque + DB-backed (same pattern as the refresh token), native TTL index
- `src/modules/example.routes.ts` — reference routes showing both access-control layers in use, and a template for future admin-only routes
- `test/auth.e2e.test.ts`, `test/addresses.e2e.test.ts`, `test/catalog.e2e.test.ts`, `test/orders.e2e.test.ts`, `test/coupons.e2e.test.ts`, `test/password-reset.e2e.test.ts`, `test/admin-users.e2e.test.ts`, `test/cart.e2e.test.ts` — end-to-end against a real (in-memory) MongoDB instance
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
- `total` is `max(subtotal - discount, 0) + shippingFee + tax`, and `payment.amount` is set to match — `shippingFee`/`tax` are still taken from the client as-is, since `StoreSettings` (free-shipping threshold, shipping fee) isn't backend-owned yet (see below).

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

## Scope of this pass — what's deliberately not here yet

Built incrementally, one module at a time — everything below is a deliberate
gap, not an oversight:

- **Real image uploads** — product/collection images are entered as plain URL strings in the admin forms (newline/URL-per-field), not an uploaded-asset pipeline. The seeded catalog's images are static files under the frontend's `public/products/` and `public/collections/` folders for this reason. A real "upload a photo" flow is separate future work.
- **Shipping fee / tax are still client-supplied** — `StoreSettings` (free-shipping threshold, shipping fee amount) isn't a backend-owned model yet, so there's nothing authoritative to recompute those two fields against. Only the product-price and coupon-discount portions of the total are server-verified.
- **Real transactional email** — see "Password reset" above; a real provider (Postmark/SES/etc.) is a separate future integration.

## Testing

```bash
npm test        # full flow against a real (in-memory) MongoDB — node:test + mongodb-memory-server
npm run typecheck
npm run lint
npm run seed     # (re-)populate MongoDB with the migrated mock catalog — upserts by slug
```
