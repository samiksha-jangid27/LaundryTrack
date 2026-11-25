# LaundryTrack

A mobile laundry service management app built with **React Native, Expo and JavaScript**, backed by **Express, Prisma ORM and PostgreSQL**.

Customers can book doorstep pickup for individual garments, see the complete price before confirming, and track the order through delivery. Staff count and label every garment, verify packing, and record the customer's return acknowledgement.

## Features

- **Transparent pricing:** prices come from the backend catalog. Wash & iron includes both services in one listed price; steam ironing is also available separately. Bookings save the agreed prices, so later catalog changes do not alter an existing receipt.
- **Flexible quantities:** book from one garment, with no minimum order value. Each service accepts 1–30 garments per booking. The current delivery charge is ₹0 and is shown before confirmation.
- **Doorstep pickup and return:** address, phone number, pickup date/window, care notes, staff assignment and counted collection.
- **Order tracking:** timestamped updates from booking through collection, cleaning, quality check, packing and delivery.
- **Garment management:** a separate ID and QR label for every garment, colour/type/condition notes, duplicate and wrong-order scan rejection, and a complete packing check before dispatch.
- **Verified returns:** only the customer receives the six-digit handoff code. Partial returns leave the remaining garments open.
- **Support and outlet tools:** customer issues, staff resolutions, order history, outlet workload and owner-only CSV reports.
- **Offline packing support:** the phone saves pending scans and replays them when connected. Conflicting updates remain pending for review.

Customers, staff and owners use the same mobile app. Public registration creates customer accounts; staff and owners are provisioned through an administrative command. Payments are settled directly with the outlet. Delivery tracking uses status updates.

## Structure and architecture

```text
LaundryTrack/
├── frontend/
│   ├── src/app/          Expo Router screens
│   ├── src/components/   Mobile UI components
│   ├── src/lib/          API client, sessions and offline storage
│   ├── assets/           App icons and branding
│   └── test/             Mobile transport and queue tests
├── backend/
│   ├── src/              Express routes, authentication and order rules
│   ├── prisma/           Database schema and committed migrations
│   ├── shared/           Shared validation, workflow stages and QR format
│   ├── scripts/          Staff/owner account creation
│   └── test/             API integration tests
└── README.md
```

```mermaid
flowchart LR
  App[Expo mobile app] -->|HTTPS /api| API[Express backend]
  API --> Prisma[Prisma ORM]
  Prisma --> DB[(PostgreSQL)]
  App <--> Cache[(Phone SQLite cache)]
  Shared[Shared validation and workflow] -.-> App
  Shared -.-> API
```

The backend is the authority for prices, permissions and custody changes. The frontend uses the same shared rules and sends authenticated HTTP requests; it never connects to PostgreSQL. Session tokens use the phone's SecureStore. Local SQLite is only the mobile cache and scan queue.

Prisma transactions commit an order change, its history and its retry receipt together. Each update includes an order version and a unique action ID, preventing duplicate work after a lost response and rejecting stale changes. QR labels contain opaque garment IDs rather than customer details. Attach labels securely using material appropriate for washing.

## Run locally

Use **Node 22.18 or later within Node 22**, npm, and a PostgreSQL database. `.nvmrc` specifies the tested Node version.

1. Install from the repository root:

   ```sh
   npm ci
   cp backend/.env.example backend/.env
   ```

2. Create a PostgreSQL database named `laundrytrack` using your preferred PostgreSQL installation/provider. Set its connection string in `backend/.env`:

   ```dotenv
   DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/laundrytrack
   PORT=4000
   TRUST_PROXY_HOPS=0
   ```

   Prisma Client is generated during installation. Database credentials belong only in the backend environment file, which Git ignores.

3. Apply the committed migrations:

   ```sh
   npm run db:migrate
   ```

4. Start the backend in one terminal:

   ```sh
   npm run backend
   ```

5. In another terminal, from the same repository root, start the mobile frontend:

   ```sh
   npm run frontend
   ```

   Use an Expo SDK 58 development client. For a matching Expo Go client, start with `npm exec --workspace @laundrytrack/frontend -- expo start --go` instead. In the Expo terminal, `a` opens Android and `i` opens an iOS Simulator when the corresponding tooling is installed.

The backend starts with an empty customer/order database and the service catalog. Create a customer account in the app. There are no preconfigured application accounts.

On a physical phone, connect it to the same Wi-Fi as the computer. If automatic address detection cannot reach the API, use **API connection settings** on the sign-in screen:

| Device           | API address                         |
| ---------------- | ----------------------------------- |
| Android emulator | `http://10.0.2.2:4000`              |
| iOS Simulator    | `http://localhost:4000`             |
| Physical phone   | `http://YOUR_COMPUTER_WIFI_IP:4000` |

You can also set `EXPO_PUBLIC_API_URL` in `frontend/.env`. Use only the server origin, without `/api`, and restart Metro after changing it. A saved connection-setting override takes precedence over this environment value.

## Create the owner and staff accounts

Copy `backend/.env.staff.example` to `backend/.env.staff` and replace every value with the intended account details:

```dotenv
STAFF_ROLE=owner
STAFF_NAME=Your Name
STAFF_EMAIL=owner@your-outlet.example
STAFF_PHONE=9876543210
STAFF_PASSWORD=replace-with-a-unique-password
```

Run from the repository root:

```sh
npm run staff:create
```

Use `STAFF_ROLE=staff` for team members. Passwords need at least ten characters. The command uses `DATABASE_URL` from `backend/.env`; it never grants elevated access through public registration and does not print credentials. Keep `.env.staff` private.

Use `npm run db:studio` to inspect the database or administer the service catalog locally. Default services/prices are defined in `backend/src/catalog.js` and inserted only when missing. Existing catalog records are changed in the database.

## API overview

All routes are under `/api`. Protected requests use `Authorization: Bearer <token>`.

| Endpoint                                                 | Purpose                                                   |
| -------------------------------------------------------- | --------------------------------------------------------- |
| `GET /health`                                            | API and database health                                   |
| `GET /services`                                          | Active services, integer-paise prices and care durations  |
| `POST /auth/register`, `POST /auth/login`                | Customer registration and sign-in                         |
| `GET /auth/me`, `POST /auth/logout`                      | Current account and session revocation                    |
| `GET /orders`, `POST /orders`, `GET /orders/:id`         | Role-scoped orders and booking receipts                   |
| `POST /orders/:id/collect`, `/garments`, `/advance`      | Counted pickup, garment registration and workflow updates |
| `GET /orders/:id/labels`, `POST /orders/:id/scan`        | QR labels and packing verification                        |
| `POST /orders/:id/delivery-code`, `/deliver`             | Customer code and full/partial handoff                    |
| `POST /orders/:id/issues`, `/issues/:issueId/resolve`    | Customer complaints and outlet resolutions                |
| `GET /outlet/summary`, `/outlet/staff`, `/outlet/export` | Staff/owner tools; export is owner-only                   |

Order mutations after booking require `eventId` and the current `version`. Retry an uncertain request with its original body/ID. A changed order returns `409` and must be refreshed before reviewing the next action.

## Checks

Integration tests use a **separate disposable PostgreSQL database** whose name ends in `_test`.

1. Create `laundrytrack_test` and copy `backend/.env.test.example` to `backend/.env.test`.
2. Set `TEST_DATABASE_URL` in that file to the test database's connection string.
3. Apply the schema to that test database, substituting its actual URL:

   ```sh
   DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/laundrytrack_test" npm run db:migrate
   ```

4. Run:

   ```sh
   npm run check
   npm run frontend:doctor
   npm audit --omit=dev
   ```

`check` runs lint, JavaScript syntax/module checking, tests against PostgreSQL, and Android/iOS bundle exports. It does not create an APK. The JavaScript check uses `checkJs: false` and is not full static type checking. Test fixtures reset only the explicitly configured test database. GitHub Actions provisions its own test database.

## Host the backend on Render

1. Push the repository to GitHub. In Render, create **New → Postgres**. Choose the same account and region you will use for the backend and copy the database's **Internal Database URL**. Render recommends internal connections between services in the same region. [PostgreSQL setup and connections](https://render.com/docs/postgresql-creating-connecting).

   Free Render Postgres databases expire after 30 days. Choose a paid database for data that must remain available beyond that period. Free web services also sleep after 15 minutes without traffic, so the first mobile request can take longer or need a retry. [Render free-instance limits](https://render.com/docs/free).

2. Create **New → Web Service**, connect the GitHub repository, and use:

   | Setting           | Value                                                    |
   | ----------------- | -------------------------------------------------------- |
   | Runtime           | Node                                                     |
   | Root directory    | Leave blank: use the repository root                     |
   | Build command     | `npm ci --omit=dev --workspace @laundrytrack/backend`    |
   | Start command     | `npm run start:render --workspace @laundrytrack/backend` |
   | Health check path | `/api/health`                                            |

   Keep the repository root because the project uses a root lockfile and local shared package. The build installs backend dependencies and generates Prisma Client. The start command applies committed migrations before starting Express. [Render Node setup](https://render.com/docs/deploy-node-express-app), [monorepo roots](https://render.com/docs/monorepo-support).

3. Add these environment variables to the web service:

   ```dotenv
   NODE_VERSION=22.18.0
   NODE_ENV=production
   DATABASE_URL=PASTE_THE_RENDER_INTERNAL_DATABASE_URL
   TRUST_PROXY_HOPS=1
   ```

   Render supplies `PORT`; the API listens on it and binds to `0.0.0.0`. Pinning `NODE_VERSION` keeps Render aligned with the tested runtime. The proxy setting follows Render's Express guidance. [Node version configuration](https://render.com/docs/node-version), [Express proxy configuration](https://render.com/articles/how-to-implement-authentication-and-authorization).

4. Deploy and open `https://YOUR_SERVICE.onrender.com/api/health`. Expect:

   ```json
   { "status": "ok", "version": "1.0.0" }
   ```

   Check `/api/services`, register a customer and confirm that booking records appear in PostgreSQL. The API needs no persistent filesystem disk because records are stored in managed PostgreSQL.

5. Provision the owner using the administrative command above. When running it from your computer, use Render's **External Database URL** as the backend connection string; deployed Render services use the internal URL.

6. Put `EXPO_PUBLIC_API_URL=https://YOUR_SERVICE.onrender.com` in `frontend/.env`, restart Metro, and update any previously saved API connection override in the app. Keep PostgreSQL credentials out of the frontend.

Use database backups appropriate to the Render plan and one API instance initially; authentication throttling currently lives in process memory. Hosting and database creation are manual steps for your account.

## APK after hosting

First verify registration, one-item pricing, pickup/intake, scanning, partial/full delivery, issues and offline recovery against the hosted backend on a real phone. Camera decoding, label printing/attachment and OS file sharing need device checks.

Production builds require an HTTPS `EXPO_PUBLIC_API_URL`. The later APK build will use that hosted address; APK generation and store submission are separate from the checks above.
