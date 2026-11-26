CREATE TYPE "TicketStatus" AS ENUM ('open', 'in_progress', 'resolved');
CREATE TYPE "StaffRequestStatus" AS ENUM ('pending', 'approved', 'declined');
ALTER TABLE "users" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "staff_requested_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "staff_request_status" "StaffRequestStatus";
CREATE TABLE "tickets" (
  "id" TEXT NOT NULL, "subject" TEXT NOT NULL, "category" TEXT NOT NULL,
  "requester_id" TEXT NOT NULL, "assigned_to" TEXT, "order_id" TEXT,
  "status" "TicketStatus" NOT NULL DEFAULT 'open', "version" INTEGER NOT NULL DEFAULT 0,
  "request_hash" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tickets_requester_id_updated_at_idx" ON "tickets"("requester_id", "updated_at");
CREATE INDEX "tickets_assigned_to_status_idx" ON "tickets"("assigned_to", "status");
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE TABLE "ticket_messages" (
  "id" TEXT NOT NULL, "ticket_id" TEXT NOT NULL, "author_id" TEXT NOT NULL,
  "author_role" "Role" NOT NULL, "kind" TEXT NOT NULL DEFAULT 'reply',
  "body" TEXT NOT NULL, "request_hash" TEXT NOT NULL DEFAULT '', "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ticket_messages_ticket_id_created_at_idx" ON "ticket_messages"("ticket_id", "created_at");
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "account_events" (
  "id" TEXT NOT NULL, "target_id" TEXT NOT NULL, "actor_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL, "detail" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "account_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "account_events_created_at_idx" ON "account_events"("created_at");
ALTER TABLE "account_events" ADD CONSTRAINT "account_events_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "account_events" ADD CONSTRAINT "account_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
