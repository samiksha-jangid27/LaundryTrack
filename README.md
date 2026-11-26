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
- **Support and outlet tools:** order incidents, threaded customer/staff queries, owner assignments, account management, activity history, outlet workload and owner-only CSV reports.
- **Offline packing support:** the phone saves pending scans and replays them when connected. Conflicting updates remain pending for review.
- **Notifications for every role:** a personal inbox, unread badge, order/query links and optional phone push alerts for customer, staff and owner events.

Customers, staff and owners use the same mobile app. Public registration creates customer accounts with email/password sign-in; the first owner is provisioned through an administrative command. Customers may request staff access, which only an owner can approve. Payments are settled directly with the outlet. Delivery tracking uses status updates.

## Sign up and sign in

Customers register with their name, email, mobile contact number and a password of at least ten characters. Registration signs them in immediately. Later sign-ins use email and password. No email, SMS or Google provider account is required for authentication.

The email format is validated, but inbox ownership is not verified. Passwords are scrypt-hashed; the API issues expiring opaque bearer sessions and the mobile app saves them in SecureStore. Customers cannot choose a staff/owner role at signup. The owner reviews staff-access requests, suspends accounts and revokes sessions. Mobile numbers are contact details, not an OTP login method.

Existing accounts and passwords continue to work. Historical verification database fields remain for compatibility; they do not block email/password login. Google sign-in and authentication OTP routes have been removed.

## Customer, staff and owner workflow

| Capability                                 | Customer                                  | Staff                                                | Owner                                                                                                           |
| ------------------------------------------ | ----------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Book and track personal laundry            | Own orders                                | Own orders through Book pickup / My pickups          | Backend supports personal orders; owner UI focuses on administration                                            |
| See operational orders                     | Own bookings                              | Assigned work only                                   | All orders                                                                                                      |
| Assign or reassign orders                  | No                                        | No                                                   | Yes, active staff/owners only                                                                                   |
| Collect, label, process, pack and deliver  | No                                        | Assigned orders                                      | All orders                                                                                                      |
| Raise a query and follow replies           | Own queries                               | Own private staff queries and assigned customer help | All customer/staff queries                                                                                      |
| Assign support queries                     | No                                        | No                                                   | Yes; staff queries can only be assigned to an owner                                                             |
| Close/reopen a query                       | Own queries                               | Own queries and assigned customer help               | All queries                                                                                                     |
| Manage accounts and review access requests | Edit own name/phone, request staff access | Edit own name/phone                                  | Search/filter accounts, edit details, approve/decline staff access, change customer/staff roles, suspend/enable |
| View account activity and CSV reports      | No                                        | No                                                   | Yes                                                                                                             |

**Booking:** customer or staff member books personal laundry → owner reviews and assigns an active team member → assigned staff counts pickup and registers garments → cleaning/quality/packing → verified return. Customers and staff can report incidents on their own bookings. An order's timeline records every handoff. Staff cannot see or mutate unrelated orders, and private delivery codes remain controlled by the booking customer.

**Customer query:** Support → Raise a query (or Ask the owner from an order) → owner reviews and optionally assigns customer support to staff → replies appear in the conversation → owner/assigned staff marks progress or resolution → the requester may reply and reopen. Queries can also be resolved by their requester. Assignment and status changes are recorded in the conversation and notify the relevant people.

**Staff query:** staff raises a query from Support → visible only to that requester and owners → owner replies/resolves. Other staff cannot read it, even if they know its ID. The requester role is saved on creation, so a later role change cannot expose an originally private staff query. Customer-query assignment never exposes staff-private conversations.

**Staff access:** customer requests access from Account → owner reviews Manage → Staff requests → approve or decline. The decision appears when the person refreshes/reopens Account. Approval changes the primary role and invalidates old sessions; the person signs in again as staff. A staff member still has personal booking features. Public signup and profile updates cannot grant elevated roles.

**Account handling:** the owner can suspend/enable customers or staff and change customer/staff roles. Suspension/demotion ends existing sessions and unassigns active orders and queries for owner reassignment, preserving history. Account updates use versions to reject stale changes. Owner accounts cannot be altered or promoted through these screens. Profile, staff requests and owner decisions appear in the owner-only Activity view. Former staff with saved offline scans can discard them before signing out; those scans cannot bypass current server permissions.

Create the initial owner with the administrative command below, then use the same mobile sign-in screen. There is no default admin password. The owner gets Dashboard, Requests, Manage, Support and Account tabs; staff get assigned work, personal pickup, support and account tools. Staff provisioning by CLI remains available for explicitly trusted accounts.

## Notifications and phone alerts

Open the bell on Home or **Account → Notifications & phone alerts**. All roles get a persisted inbox with All/Unread filters, pagination, read status and links to the relevant screen. The unread badge and inbox refresh while the app is active; pull to refresh is also available. Phone alerts are optional; pausing them keeps the in-app inbox working.

| Event                                                                                                                 | Recipients                                                                                       |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Booking confirmation                                                                                                  | Booking customer and active owners                                                               |
| Assignment, pickup, cleaning, quality, packing, dispatch, partial/full return, cancellation, garment issue/resolution | Booking customer, assigned team member and active owners, excluding the person making the update |
| Order/query assignment removed                                                                                        | Previous assignee receives a generic work-queue update                                           |
| New customer/staff query                                                                                              | Active owners                                                                                    |
| Query assignment, reply, status or resolution                                                                         | Requester, eligible assignee and active owners, excluding the author                             |
| New customer registration or staff access request                                                                     | Active owners                                                                                    |
| Staff approval/decline or account change                                                                              | Affected account; cleared active assignments also alert owners                                   |

Private staff queries notify only that requester and owners, including after a role change. Individual garment intake/scans do not produce phone-alert spam. Push messages use a generic preview and an opaque notification ID: no OTP, delivery code, address or conversation text appears on the lock screen. Opening a push fetches the notification under the current authenticated account; order/query permissions are still checked. A suspended account cannot sign in or receive phone pushes; its account notice stays in the inbox for later access if re-enabled.

**Enable real phone push delivery:**

1. From `frontend`, run `npx eas-cli@latest login` and `npx eas-cli@latest init` to connect your Expo project. Copy its project UUID into `EXPO_PUBLIC_EAS_PROJECT_ID` in `frontend/.env` and your EAS build environment. This app reads that value in `app.config.js`; no project ID is hardcoded.
2. For Android, create a Firebase project and register the app package **`com.samikshajangid.laundrytrack`**. Download its `google-services.json`. Set `GOOGLE_SERVICES_JSON` to the file path locally, and create an EAS **file** environment variable of the same name for cloud builds. The app config uses it as `android.googleServicesFile`.
3. In the Firebase project, obtain a service-account key for **FCM v1**. Run `npx eas-cli@latest credentials`, choose Android and the build profile, then **Google Service Account → Manage your Google Service Account Key for Push Notifications (FCM V1) → Set up → Upload a new service account key**. Keep this private key outside the repository. It is separate from the app's `google-services.json`. [Expo FCM credentials](https://docs.expo.dev/push-notifications/fcm-credentials/).
4. For iOS, configure APNs credentials for the same Expo project using EAS credentials and your Apple developer account. Install a native build after adding the notifications plugin and credentials. **Remote push needs the installed app; this app keeps Expo Go on the in-app inbox path.** [Expo push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/), [SDK 58 notifications](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/).
5. In Expo project settings, enhanced push security is recommended. If enabled, set the matching private Expo token as **`EXPO_ACCESS_TOKEN` in Render**, then redeploy. Never put it in `EXPO_PUBLIC_*` variables. [Expo push delivery and security](https://docs.expo.dev/push-notifications/sending-notifications/).
6. After installing the build, sign in and choose **Enable alerts on this phone** in Notifications. Accept the OS permission. Test with your own customer, staff and owner accounts: book/assign an order, update a stage, raise/reply to a query and review a staff request. Check foreground, background, closed-app taps, paused alerts and switching accounts on a shared phone before release.

Notifications and push-outbox rows commit in the same PostgreSQL transaction as the action. Replaying an action does not create another inbox entry. The API's worker polls the durable outbox every ten seconds, leases a bounded batch, retries transient failures with backoff and checks Expo receipts after fifteen minutes. Invalid devices are disabled; read alerts, inactive accounts and paused preferences are skipped. Retry attempts are bounded and alerts expire after 24 hours. Reopening the app syncs an already-authorized device; sign-out removes that installation's registration when online, and switching accounts removes the previous account's queued deliveries for that installation.

Push delivery is best effort: a network failure after Expo accepted a send can produce a duplicate phone alert, and an accepted receipt does not prove the user saw it. The database inbox remains the record of the update. Render's free API can sleep, delaying the worker; use an always-running service for prompt alerts. Provider credentials and actual phone delivery must be verified before calling push production-ready.

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
  API -->|Inbox and push outbox| DB
  API -->|Push worker| ExpoPush[Expo push service]
  ExpoPush -->|FCM / APNs| App
  App <--> Cache[(Phone SQLite cache)]
  Shared[Shared validation and workflow] -.-> App
  Shared -.-> API
```

The backend is the authority for prices, permissions and custody changes. The frontend uses the same shared rules and sends authenticated HTTP requests; it never connects to PostgreSQL. Session tokens use the phone's SecureStore. Cached resources are partitioned by user and role, and the API checks current account status on every authenticated request. Local SQLite is only the mobile cache and scan queue.

Prisma transactions commit an order change, its history and its retry receipt together. Each update includes an order version and a unique action ID, preventing duplicate work after a lost response and rejecting stale changes. QR labels contain opaque garment IDs rather than customer details. Attach labels securely using material appropriate for washing.

## Run the mobile app

Use **Node 22.18 or later within Node 22** and npm. `.nvmrc` specifies the tested Node version.

The app uses the deployed backend at **https://laundrytrack-1.onrender.com** by default. You do not need to run a backend on your computer to use it.

From the repository root:

```sh
npm ci
npm run frontend
```

`npm run frontend` starts in **Expo Go** mode. Install an Expo Go version compatible with SDK 58 on the phone, keep the phone and computer on the same Wi-Fi, and scan the terminal QR code from Expo Go. In the Expo terminal, `a` opens Android and `i` opens an iOS Simulator when the corresponding tooling is installed.

If Expo Go says it cannot handle an `exp+laundrytrack://` link, the server was started in development-build mode. Stop that terminal with Ctrl+C and run `npm exec --workspace @laundrytrack/frontend -- expo start --go --clear`, then scan the new QR code. The Expo Go link uses `exp://`. For an installed custom development build, explicitly use `npm exec --workspace @laundrytrack/frontend -- expo start --dev-client` instead. [Expo launch targets](https://docs.expo.dev/more/expo-cli/#launch-target).

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

| Endpoint                                                                                              | Purpose                                                       |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `GET /health`                                                                                         | API and database health                                       |
| `GET /services`                                                                                       | Active services, integer-paise prices and care durations      |
| `POST /auth/register`, `POST /auth/login`                                                             | Customer signup and email/password sign-in                    |
| `PATCH /auth/profile`, `POST /auth/staff-request`                                                     | Edit personal details and request owner-approved staff access |
| `GET /support`, `POST /support`, `GET /support/:id`                                                   | Role-scoped customer/staff queries                            |
| `POST /support/:id/messages`, `PATCH /support/:id`                                                    | Idempotent replies, assignments and status history            |
| `GET /management/users`, `PATCH /management/users/:id`, `GET /management/activity`                    | Owner-only account management and activity                    |
| `GET /notifications`, `GET /notifications/summary`, `GET /notifications/:id`                          | Personal inbox, unread count and recipient-scoped detail      |
| `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`                                      | Read an alert or mark the current inbox read                  |
| `PUT /notifications/devices`, `DELETE /notifications/devices/:id`, `PATCH /notifications/preferences` | Register this phone, remove it or pause account push alerts   |
| `GET /auth/me`, `POST /auth/logout`                                                                   | Current account and session revocation                        |
| `GET /orders`, `POST /orders`, `GET /orders/:id`                                                      | Role-scoped orders and booking receipts                       |
| `POST /orders/:id/collect`, `/garments`, `/advance`                                                   | Counted pickup, garment registration and workflow updates     |
| `GET /orders/:id/labels`, `POST /orders/:id/scan`                                                     | QR labels and packing verification                            |
| `POST /orders/:id/delivery-code`, `/deliver`                                                          | Customer code and full/partial handoff                        |
| `POST /orders/:id/issues`, `/issues/:issueId/resolve`                                                 | Customer complaints and outlet resolutions                    |
| `GET /outlet/summary`, `/outlet/staff`, `/outlet/issues`, `/outlet/export`                            | Staff/owner tools; export is owner-only                       |

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

Notification tests cover recipient permissions, private staff queries, duplicate retries, transaction rollback, pagination/read state, account switching, outbox leases, transport retries, push receipts and disabled devices. Push transports are injected in tests, so tests do not send notifications to real phones.

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

## Android APK

The app uses the hosted backend by default. Email/password signup/login, orders, support, owner/staff account management and the notification inbox work without Google, SMS or email-service credentials. Remote phone push is optional and requires the Expo/Firebase configuration described above; it is separate from the in-app inbox.

Native release builds should use `APP_VARIANT=production`, the existing release signing key, and an increased Android version code. The installed APK needs internet access to reach the hosted backend. Build and verify the APK before attaching it to a new GitHub release. Test camera decoding and physical QR label attachment on the phone used by the outlet.

The current Android application ID is `com.samikshajangid.laundrytrack`. EAS can build an installable APK with the `preview` profile after the Expo project and existing signing credentials are configured:

```sh
cd frontend
npx eas-cli@latest build --platform android --profile preview
```

The native splash uses the app mark and teal background; a branded loading screen covers session restoration. Login/signup uses a compact two-step signup form without scrolling, including while the keyboard is open.
