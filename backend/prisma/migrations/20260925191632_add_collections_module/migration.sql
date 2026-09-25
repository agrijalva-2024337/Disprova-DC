-- CreateEnum
CREATE TYPE "metodo_pago" AS ENUM ('efectivo', 'transferencia', 'cheque');

-- CreateEnum
CREATE TYPE "estado_caja" AS ENUM ('abierta', 'cerrada');

-- CreateEnum
CREATE TYPE "resultado_cobranza" AS ENUM ('pago_completo', 'pago_parcial', 'compromiso', 'sin_contacto');

-- CreateEnum
CREATE TYPE "tipo_movimiento_cuenta" AS ENUM ('cargo', 'abono');

-- AlterTable
ALTER TABLE "orders" ALTER COLUMN "numero" SET DEFAULT ('PED-' || lpad(nextval('order_numero_seq')::text, 6, '0'));

-- CreateTable
CREATE TABLE "account_movements" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "tipo" "tipo_movimiento_cuenta" NOT NULL,
    "referencia_tipo" TEXT NOT NULL,
    "referencia_id" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "saldo_resultante" DECIMAL(12,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_sessions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "fondo_inicial" DECIMAL(12,2) NOT NULL,
    "total_cobrado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_gastos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "conteo_final" DECIMAL(12,2),
    "diferencia" DECIMAL(12,2),
    "estado" "estado_caja" NOT NULL DEFAULT 'abierta',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerrada_at" TIMESTAMP(3),

    CONSTRAINT "cash_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "metodo" "metodo_pago" NOT NULL,
    "referencia" TEXT,
    "cash_session_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_applications" (
    "id" SERIAL NOT NULL,
    "payment_id" INTEGER NOT NULL,
    "order_id" INTEGER NOT NULL,
    "monto_aplicado" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "payment_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_visits" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "resultado" "resultado_cobranza" NOT NULL,
    "monto_comprometido" DECIMAL(12,2),
    "fecha_compromiso" DATE,
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_visits_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "account_movements" ADD CONSTRAINT "account_movements_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_cash_session_id_fkey" FOREIGN KEY ("cash_session_id") REFERENCES "cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_applications" ADD CONSTRAINT "payment_applications_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_applications" ADD CONSTRAINT "payment_applications_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_visits" ADD CONSTRAINT "collection_visits_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_visits" ADD CONSTRAINT "collection_visits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
