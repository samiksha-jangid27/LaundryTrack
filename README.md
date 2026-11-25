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

## Run the mobile app

Use **Node 22.18 or later within Node 22** and npm. `.nvmrc` specifies the tested Node version.

The app uses the deployed backend at **https://laundrytrack-1.onrender.com** by default. You do not need to run a backend on your computer to use it.

From the repository root:

```sh
npm ci
npm run frontend
```

Use an Expo SDK 58 development client. For a matching Expo Go client, use `npm exec --workspace @laundrytrack/frontend -- expo start --go`. In the Expo terminal, `a` opens Android and `i` opens an iOS Simulator when the corresponding tooling is installed.

`frontend/.env.example` contains the deployed address. `EXPO_PUBLIC_API_URL` in `frontend/.env` can override it for another environment; use only the server origin, without `/api`. Restart Expo and fully reload the app after changing it. There is no saved in-app API override, so an old local address cannot replace the configured backend. Cloud builds also use the hosted default when no environment override is supplied.

Check the deployed API at [the health endpoint](https://laundrytrack-1.onrender.com/api/health). Create a customer account in the app; there are no preconfigured application accounts. Database credentials belong only in the backend environment.

## Develop the backend locally (optional)

1. Copy `backend/.env.example` to `backend/.env` if it does not already exist.
2. In Prisma Console, select the database, choose **Connect to your database**, generate a connection string and copy the **Direct TCP** URL into `DATABASE_URL`:

   ```dotenv
   DATABASE_URL="postgres://USER:PASSWORD@db.prisma.io:5432/postgres?sslmode=require"
   PORT=4000
   TRUST_PROXY_HOPS=0
   ```

   Copy the complete generated URL with its actual credentials. The current backend uses this direct connection for Prisma CLI commands and its single runtime connection pool (maximum five connections). [Prisma connection strings](https://www.prisma.io/docs/postgres/database/connecting-to-your-database#get-your-connection-strings).

3. From the repository root, run:

   ```sh
   npm run db:migrate
   npm run backend
   ```

Prisma Client is generated during installation. The migration command applies committed migrations. Starting the backend inserts missing service catalog records; customers and orders are created through the app. Keep `.env` private.

To deliberately test that local backend from a physical phone, set `EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_WIFI_IP:4000` in `frontend/.env` and keep the phone and computer on the same Wi-Fi. Restore the hosted address afterwards. Production builds accept only HTTPS API addresses.

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

## Host the backend on Render with Prisma Postgres

The current backend is **https://laundrytrack-1.onrender.com**. PostgreSQL is hosted in **Prisma Console**; Render runs the Express API. The API address and database connection string are separate values.

1. In Prisma Console, open the database and generate a **Direct TCP** connection string. Use the complete generated PostgreSQL URL, including `sslmode=require`, as the backend's private `DATABASE_URL`. The same hosted database URL works from your computer and Render. [Prisma database connections](https://www.prisma.io/docs/postgres/database/connecting-to-your-database).
2. Commit and push the current repository to GitHub. In Render, connect it as a Node **Web Service** with these settings:

   | Setting           | Value                                                    |
   | ----------------- | -------------------------------------------------------- |
   | Runtime           | Node                                                     |
   | Branch            | `main`                                                   |
   | Root directory    | Leave blank: use the repository root                     |
   | Build command     | `npm ci --omit=dev --workspace @laundrytrack/backend`    |
   | Start command     | `npm run start:render --workspace @laundrytrack/backend` |
   | Health check path | `/api/health`                                            |

   Keep the repository root because the project uses a root lockfile and local shared package. The build installs backend dependencies and generates Prisma Client. The start command applies committed migrations before starting Express. [Render Node setup](https://render.com/docs/deploy-node-express-app), [monorepo roots](https://render.com/docs/monorepo-support).

3. Set these variables under **Render → Environment**. Paste the actual database URL without surrounding quotes in the Render value field:

   ```dotenv
   NODE_VERSION=22.18.0
   NODE_ENV=production
   DATABASE_URL=YOUR_PRISMA_DIRECT_TCP_CONNECTION_URL
   TRUST_PROXY_HOPS=1
   ```

   Render supplies `PORT`; the API listens on it and binds to `0.0.0.0`. [Node version configuration](https://render.com/docs/node-version), [Express proxy configuration](https://render.com/articles/how-to-implement-authentication-and-authorization).

4. Deploy the latest commit, then open `https://laundrytrack-1.onrender.com/api/health`. Expect:

   ```json
   { "status": "ok", "version": "1.0.0" }
   ```

   Check `/api/services`, register a customer and confirm booking records in Prisma Studio. The API needs no persistent filesystem disk because records are stored in Prisma Postgres.

5. Provision the owner with `npm run staff:create` as described above, using the same Prisma database URL in `backend/.env`.
6. The mobile app already defaults to this hosted backend. To use a different deployment, set its HTTPS origin as `EXPO_PUBLIC_API_URL` in the frontend environment, then restart Expo and fully reload the app.

Use database backups appropriate to your Prisma plan and one API instance initially; authentication throttling lives in process memory. Free Render web services sleep after 15 minutes without traffic, so the first request can take longer or need a retry. [Render free-service limits](https://render.com/docs/free#spinning-down-on-idle).

## APK after hosting

First verify registration, one-item pricing, pickup/intake, scanning, partial/full delivery, issues and offline recovery against the hosted backend on a real phone. Camera decoding, label printing/attachment and OS file sharing need device checks.

Production builds use the hosted HTTPS address by default and require HTTPS for any `EXPO_PUBLIC_API_URL` override. The later APK build will use the configured hosted address; APK generation and store submission are separate from the checks above.
