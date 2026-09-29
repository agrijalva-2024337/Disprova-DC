-- Rastro de qué lote quedó reservado en cada línea del pedido.
--
-- El FEFO de `confirmOrder` calculaba el lote correcto y lo reservaba, pero
-- DESCARTABA el batchId. Luego la entrega tomaba el lote del cuerpo de la
-- petición del vendedor, con tres consecuencias: se rompía la trazabilidad de
-- medicamentos, la `liberacion_reserva` podía consumir la reserva de OTRO
-- pedido sobre ese lote, y nada impedía despachar producto vencido.
--
-- Con esta tabla el lote deja de ser una decisión de última milla del cliente
-- HTTP: la entrega consume lo que el pedido reservó, y `vigente` permite
-- marcar una reserva como consumida sin borrar la historia.

-- CreateTable
CREATE TABLE "order_item_batches" (
    "id" SERIAL NOT NULL,
    "order_item_id" INTEGER NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "cantidad" DECIMAL(12,4) NOT NULL,
    "vigente" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_item_batches_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "order_item_batches_cantidad_positiva" CHECK ("cantidad" > 0)
);

-- CreateIndex
CREATE INDEX "order_item_batches_order_item_id_idx" ON "order_item_batches"("order_item_id");

-- Un lote no se reserva dos veces en la misma línea: el FEFO reparte entre
-- lotes, cada uno en su fila.
CREATE UNIQUE INDEX "order_item_batches_order_item_id_batch_id_key" ON "order_item_batches"("order_item_id", "batch_id");

-- AddForeignKey
ALTER TABLE "order_item_batches" ADD CONSTRAINT "order_item_batches_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_batches" ADD CONSTRAINT "order_item_batches_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "product_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- El saldo de apertura de la cartera no es una columna nueva: es un cargo más
-- del libro mayor, con referencia_tipo = 'apertura'. Esto mantiene la regla de
-- "el saldo es un cálculo del mayor" y hace que el saldo inicial se explique
-- movimiento por movimiento como cualquier otro.
CREATE INDEX "account_movements_referencia_idx" ON "account_movements"("referencia_tipo", "referencia_id");

-- Un mismo corte de apertura no se carga dos veces.
CREATE UNIQUE INDEX "account_movements_apertura_unica" ON "account_movements"("referencia_id") WHERE "referencia_tipo" = 'apertura';
