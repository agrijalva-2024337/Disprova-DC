-- CreateEnum
CREATE TYPE "canal_mensaje" AS ENUM ('wa_link', 'whatsapp_api');

-- CreateEnum
CREATE TYPE "estado_mensaje" AS ENUM ('generado', 'enviado', 'fallido');

-- AlterTable
ALTER TABLE "orders" ALTER COLUMN "numero" SET DEFAULT ('PED-' || lpad(nextval('order_numero_seq')::text, 6, '0'));

-- CreateTable
CREATE TABLE "message_templates" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "canal" "canal_mensaje" NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_logs" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "template_id" INTEGER,
    "telefono" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "canal" "canal_mensaje" NOT NULL,
    "estado" "estado_mensaje" NOT NULL DEFAULT 'generado',
    "error" TEXT,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "message_templates_nombre_key" ON "message_templates"("nombre");

-- CreateIndex
CREATE INDEX "message_logs_client_id_idx" ON "message_logs"("client_id");

-- AddForeignKey
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "message_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
