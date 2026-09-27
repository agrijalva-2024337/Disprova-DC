-- CreateEnum
CREATE TYPE "estado_factura" AS ENUM ('pendiente_certificacion', 'certificada', 'error');

-- AlterTable
ALTER TABLE "orders" ALTER COLUMN "numero" SET DEFAULT ('PED-' || lpad(nextval('order_numero_seq')::text, 6, '0'));

-- CreateSequence
-- Prisma no administra secuencias: se crea a mano, igual que order_numero_seq.
-- El correlativo de invoices.numero no depende del id y no se reutiliza.
CREATE SEQUENCE "invoice_numero_seq";

-- CreateTable
CREATE TABLE "invoices" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "serie" TEXT NOT NULL,
    "numero" INTEGER NOT NULL DEFAULT nextval('invoice_numero_seq'),
    "uuid_fel" TEXT,
    "fecha_certificacion" TIMESTAMP(3),
    "estado" "estado_factura" NOT NULL DEFAULT 'pendiente_certificacion',
    "total" DECIMAL(12,2) NOT NULL,
    "xml_url" TEXT,
    "pdf_url" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_order_id_key" ON "invoices"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_numero_key" ON "invoices"("numero");

-- CreateIndex
CREATE INDEX "invoices_estado_idx" ON "invoices"("estado");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
