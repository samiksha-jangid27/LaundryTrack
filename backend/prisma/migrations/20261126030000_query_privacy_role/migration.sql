ALTER TABLE "tickets" ADD COLUMN "requester_role" "Role" NOT NULL DEFAULT 'customer';
UPDATE "tickets" AS ticket SET "requester_role" = account."role"
FROM "users" AS account WHERE ticket."requester_id" = account."id";
