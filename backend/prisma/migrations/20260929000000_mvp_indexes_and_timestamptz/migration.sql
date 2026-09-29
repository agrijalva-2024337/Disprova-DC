-- Índices que la sección 8 de la planificación exige "desde el inicio".
-- La mayoría no existían: account_movements es la que lee getAccount, getAging
-- y la validación de límite de crédito en CADA confirmación de pedido. Sin
-- estos índices eso era un seq scan por consulta.

-- CreateIndex
CREATE INDEX "orders_client_id_created_at_idx" ON "orders"("client_id", "created_at");

-- El vendedor lista "mis pendientes del día" por usuario y fecha.
CREATE INDEX "orders_user_id_created_at_idx" ON "orders"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_movements_product_id_created_at_idx" ON "inventory_movements"("product_id", "created_at");

-- CreateIndex
CREATE INDEX "account_movements_client_id_fecha_idx" ON "account_movements"("client_id", "fecha");

-- El kardex se relee por referencia (pedido, traslado, devolución) para
-- reconstruir qué pasó con una operación concreta.
CREATE INDEX "inventory_movements_referencia_idx" ON "inventory_movements"("referencia_tipo", "referencia_id");

-- CreateIndex
CREATE INDEX "payments_fecha_idx" ON "payments"("fecha");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "payment_applications_payment_id_idx" ON "payment_applications"("payment_id");

-- Un lote no se registra dos veces para el mismo producto. Sin esto, dos
-- usuarios pueden dar de alta "LOTE-001" del mismo medicamento y el FEFO
-- termina despachando el equivocado.
CREATE UNIQUE INDEX "product_batches_product_id_lote_key" ON "product_batches"("product_id", "lote");

-- Zona horaria. La planificación dice: "Guardar en UTC con TIMESTAMPTZ y
-- presentar en hora de Guatemala. Los cortes de día dependen de esto."
-- TIMESTAMP(3) sin zona perdía el instante: el mismo valor leído desde dos
-- máquinas con distinta hora local daba dos saldos distintos.
--
-- USING ... AT TIME ZONE 'UTC' preserva el instante: el valor guardado ya era
-- UTC (la app escribe new Date(), que es absoluto), lo que faltaba era la
-- marca de zona para que PostgreSQL deje de interpretarlo como local.

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "audit_log" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "clients" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "route_visits" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "product_batches" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "inventory_movements" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "orders" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "account_movements" ALTER COLUMN "fecha" SET DATA TYPE TIMESTAMPTZ(3) USING "fecha" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "account_movements" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "cash_sessions" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "cash_sessions" ALTER COLUMN "cerrada_at" SET DATA TYPE TIMESTAMPTZ(3) USING "cerrada_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "fecha" SET DATA TYPE TIMESTAMPTZ(3) USING "fecha" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "collection_visits" ALTER COLUMN "fecha" SET DATA TYPE TIMESTAMPTZ(3) USING "fecha" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "collection_visits" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "returns" ALTER COLUMN "fecha" SET DATA TYPE TIMESTAMPTZ(3) USING "fecha" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "returns" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "message_logs" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "client_access_tokens" ALTER COLUMN "expires_at" SET DATA TYPE TIMESTAMPTZ(3) USING "expires_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "client_access_tokens" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "client_access_tokens" ALTER COLUMN "revoked_at" SET DATA TYPE TIMESTAMPTZ(3) USING "revoked_at" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "invoices" ALTER COLUMN "fecha_certificacion" SET DATA TYPE TIMESTAMPTZ(3) USING "fecha_certificacion" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "invoices" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
