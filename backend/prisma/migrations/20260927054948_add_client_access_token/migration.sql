-- AlterTable
ALTER TABLE "orders" ALTER COLUMN "numero" SET DEFAULT ('PED-' || lpad(nextval('order_numero_seq')::text, 6, '0'));

-- CreateTable
CREATE TABLE "client_access_tokens" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" INTEGER NOT NULL,

    CONSTRAINT "client_access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_access_tokens_token_key" ON "client_access_tokens"("token");

-- CreateIndex
CREATE INDEX "client_access_tokens_client_id_idx" ON "client_access_tokens"("client_id");

-- CreateIndex
CREATE INDEX "client_access_tokens_expires_at_idx" ON "client_access_tokens"("expires_at");

-- AddForeignKey
ALTER TABLE "client_access_tokens" ADD CONSTRAINT "client_access_tokens_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_access_tokens" ADD CONSTRAINT "client_access_tokens_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
