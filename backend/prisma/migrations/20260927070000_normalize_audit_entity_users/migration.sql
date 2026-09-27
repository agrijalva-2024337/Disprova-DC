-- Normaliza la entidad de auditoría de usuarios.
--
-- `audit_log.entidad` guarda el nombre del modelo Prisma en PascalCase
-- ('Order', 'Payment', 'CashSession', ...). El módulo de usuarios escribía
-- 'users' en minúscula, único caso fuera del estándar. Con el endpoint de
-- lectura expuesto, un GROUP BY por entidad devolvía 'Order' y 'users' como
-- dos categorías distintas.
--
-- Es una migración de datos: no cambia el esquema.
UPDATE "audit_log" SET "entidad" = 'User' WHERE "entidad" = 'users';
