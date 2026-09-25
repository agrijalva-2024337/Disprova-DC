-- CreateEnum
CREATE TYPE "tipo_negocio" AS ENUM ('tienda', 'farmacia', 'mercado', 'otro');

-- CreateEnum
CREATE TYPE "resultado_visita" AS ENUM ('pedido', 'no_compro', 'cerrado');

-- CreateTable
CREATE TABLE "zones" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "semana_mes" INTEGER NOT NULL,
    "dias_semana" INTEGER[] NOT NULL,
    "vendedor_user_id" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "zones_semana_mes_range" CHECK ("semana_mes" >= 1 AND "semana_mes" <= 4)
);

-- CreateTable
CREATE TABLE "clients" (
    "id" SERIAL NOT NULL,
    "nombre_comercial" TEXT NOT NULL,
    "nit" TEXT,
    "tipo_negocio" "tipo_negocio" NOT NULL,
    "zone_id" INTEGER NOT NULL,
    "orden_ruta" INTEGER NOT NULL,
    "direccion" TEXT NOT NULL,
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "price_list_id" INTEGER NOT NULL,
    "limite_credito" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "plazo_dias" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_contacts" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "es_whatsapp" BOOLEAN NOT NULL,
    "acepta_mensajes" BOOLEAN NOT NULL DEFAULT false,
    "es_principal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "client_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_visits" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "resultado" "resultado_visita" NOT NULL,
    "motivo" TEXT,
    "observaciones" TEXT,
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_visits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_zone_id_orden_ruta_key" ON "clients"("zone_id", "orden_ruta");

-- AddForeignKey
ALTER TABLE "zones" ADD CONSTRAINT "zones_vendedor_user_id_fkey" FOREIGN KEY ("vendedor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "price_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_visits" ADD CONSTRAINT "route_visits_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_visits" ADD CONSTRAINT "route_visits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
