# Operating the pilot

## Local demo

`npm run demo` enables seeded fictional accounts and orders. It is convenient for a classroom demonstration and does not represent a live service. The demo flag controls automatic seeding and the demo UI buttons; disabling it does not delete existing sample users. Keep real and sample databases separate.

For a fresh non-demo database, use a new `DATABASE_PATH`, leave `DEMO_MODE` unset/false and provision an owner locally. Public registration never grants staff access.

The `staff:create` script accepts `STAFF_ROLE` (`staff` or `owner`), `STAFF_NAME`, `STAFF_EMAIL`, `STAFF_PHONE` and `STAFF_PASSWORD` through environment variables. A password must have at least ten characters. You can load those from an ignored local environment file:

```sh
node --env-file=.env.staff server/scripts/create-staff.js
```

Use a private file, do not commit it, and use invented credentials for demos. The command prints the role created, not the password. Point it at the same DATABASE_PATH as the API.

## Production-style local serving

```sh
npm ci
npm run build
npm start
```

The API serves the built web app at port 4000. It also serves API requests there. Database parent directories are created automatically, and additive migrations run at startup. The default is `server/data/laundrytrack.sqlite`; an environment override is resolved by Node from the launch directory when relative.

For an internet deployment, choose a Node host with durable storage and HTTPS. The API must not use an ephemeral filesystem for customer records. Configure WEB_ORIGINS as a comma-separated list of the actual web origins, expose the API only through the chosen TLS endpoint, and build mobile production with APP_VARIANT=production and the public HTTPS API address. No hosting subscription, store account, payment service or external messaging was created by this project.

## Data and recovery

- Back up the SQLite database using a consistent SQLite backup operation, not a casual copy of only the main file while WAL writes are active.
- Protect database files and backups: they contain customer contacts, password/token hashes and private idempotency responses.
- Native tokens are in SecureStore; cached order details and pending scans are in local SQLite. Device-level protection and a retention policy are required before storing real customer data on shared devices.
- Login throttling is in process memory. A multi-instance deployment needs a shared limiter, stronger operational monitoring and tested load behavior.
- A six-digit delivery code is an acknowledgement aid used by authenticated staff. It is not a payment PIN, legal signature or substitute for resolving a disputed physical handoff.

## Deliberate pilot limits

One outlet; item-priced care; no route optimisation/live GPS; no real payment collection; no SMS or push provider; no photo storage; no geofencing; latest 500 orders in the list. Staff/owner provisioning and catalog changes are administrative operations. Count changes before pickup currently require cancellation/rebooking rather than editing a receipt after custody starts.

The software verifies registered identifiers and counts. It cannot verify that a physical label stays attached, survives washing or is attached to the correct garment. Test wash-safe label material, printing, attachment and operator procedure with a laundry before claiming physical loss prevention results.

The repository is a project pilot with reproducible checks, not evidence of a production audit or measured business impact.
