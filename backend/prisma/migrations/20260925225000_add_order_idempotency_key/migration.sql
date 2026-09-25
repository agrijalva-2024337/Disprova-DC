-- AlterTable
ALTER TABLE "orders" ADD COLUMN "idempotency_key" TEXT;

-- CreateIndex
-- Varios NULL conviven: PostgreSQL no los considera duplicados en un índice único.
CREATE UNIQUE INDEX "orders_client_user_idempotency_key" ON "orders"("client_id", "user_id", "idempotency_key");
