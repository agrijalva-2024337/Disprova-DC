-- Soft delete. La sección 8 de la planificación dice: "Nada se borra.
-- Clientes, productos y pedidos se desactivan o anulan, nunca se eliminan.
-- Un pedido anulado conserva su historia y su motivo."
--
-- `price_list_items` era la única entidad del catálogo sin bandera: un precio
-- cargado por error se borraba de verdad y el cliente perdía el histórico de
-- a cuánto se le vendió cada cosa. Con `activo` el precio queda fuera de
-- `currentPrice` pero sigue ahí, y un pedido viejo sigue mostrando su origen.

-- AlterTable
ALTER TABLE "price_list_items" ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true;

-- El precio vigente de una presentación es el activo más reciente cuyo
-- `vigenteDesde` ya pasó. Sin este índice, cada pedido recorre todos los
-- precios de la lista del cliente.
CREATE INDEX "price_list_items_lookup_idx"
    ON "price_list_items"("price_list_id", "product_unit_id", "activo", "vigente_desde" DESC);

-- Un cliente, producto o categoría inactivo no debe salir en los listados
-- Operativos, pero sí en los históricos. Estos índices sirven a los listados
-- del panel, que siempre filtran por `activo = true`.
CREATE INDEX "clients_activo_zone_id_orden_ruta_idx" ON "clients"("activo", "zone_id", "orden_ruta");
CREATE INDEX "products_activo_idx" ON "products"("activo");
CREATE INDEX "categories_activo_idx" ON "categories"("activo");
