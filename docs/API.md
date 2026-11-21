# API

Base path `/api`. JSON errors contain `error` and, where available, `code`. Authenticated requests use `Authorization: Bearer <token>`; tokens expire after seven days. The API returns 401 for invalid sessions, 403 for role restrictions, 404 for missing/inaccessible orders and 409 for workflow/version conflicts.

## Public

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/health` | Health, version, explicit demo flag |
| GET | `/services` | Active catalog and integer-paise prices |
| POST | `/auth/register` | Customer account: name, email, phone, password (10+ characters) |
| POST | `/auth/login` | Session: email and password |

## Session

`GET /auth/me` returns the public user profile. `POST /auth/logout` revokes the current token. Login/registration are rate-limited per API instance and remote IP.

## Orders

| Method | Route | Access / behavior |
| --- | --- | --- |
| GET | `/orders` | Customer’s own orders; outlet can list all (latest 500) |
| POST | `/orders` | Customer: items `{serviceId,quantity}`, address, phone, pickupDate, slot, notes, optional UUID requestId |
| GET | `/orders/:id` | Manifest, price snapshots, history, issues; customer ownership enforced |
| GET | `/orders/:id/estimate` | Planning estimate and its data source |
| POST | `/orders/:id/cancel` | Before collection only |
| POST | `/orders/:id/assign` | Outlet: staffId |
| POST | `/orders/:id/collect` | Outlet: physical count |
| POST | `/orders/:id/garments` | Outlet: type, color, optional note |
| POST | `/orders/:id/advance` | Outlet: next valid stage, invariant checks |
| POST | `/orders/:id/scan` | Outlet: garmentId, correct order and no duplicate |
| POST | `/orders/:id/unpack` | Outlet: garmentId, packing recheck |
| POST | `/orders/:id/delivery-code` | Customer only: generate/replace return acknowledgement code |
| POST | `/orders/:id/deliver` | Outlet: code and garmentIds actually handed over |
| POST | `/orders/:id/issues` | Customer: category, message, optional garmentId |
| POST | `/orders/:id/issues/:issueId/resolve` | Outlet: resolution |
| GET | `/orders/:id/tags/:garmentId` | Outlet: SVG QR label |

Every order mutation after booking requires `{eventId: UUID, version: currentOrderVersion, ...operationFields}`. Preserve the entire request for retries. Successful replay returns the original response. For a 409 caused by another action, fetch the latest order and review the physical work before creating a new action ID.

Booking `requestId` makes an unchanged booking retry return its original receipt and code. The app/web generate and reuse one ID for retries of the same form contents.

Delivery codes are returned only during creation/reset to the customer; staff order reads never contain them. Secrets may be present in private idempotency response records, so protect database files and backups as credential-bearing data.

## Outlet

`GET /outlet/staff`, `GET /outlet/summary`: staff or owner. `GET /outlet/export`: owner only; returns CSV booking values in paise.

Pickup dates use the Asia/Kolkata calendar and are limited to today through 14 days ahead. Slots are `09:00–12:00`, `12:00–15:00`, `15:00–18:00`. The pilot catalog is item-based, not weight-based.
