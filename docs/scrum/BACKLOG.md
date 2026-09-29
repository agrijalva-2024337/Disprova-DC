# Backlog — Disprova GyG (cierre de backend)

| Ticket | Título | Estado |
|--------|--------|--------|
| DISP-013 | Limpieza: pnpm en Docker, borrar residuos de la raíz, README | Listo |
| DISP-014 | Esquema y proveedor de mensajería (WhatsApp) | Listo |
| DISP-015 | Endpoints de mensajería y envío por WhatsApp | Listo |
| DISP-016 | Esquema: catálogo web público por token | Listo |
| DISP-017 | Endpoints: catálogo público y pedido web por token | Listo |
| DISP-018 | Esquema y proveedor de facturación (FEL) | Listo |
| DISP-019 | Endpoints de facturación | Listo |
| DISP-020 | Documentación: Swagger y README final | Listo |
| DISP-021 | CRUD de Usuarios y Roles | Listo |
| DISP-022 | Auditoría en módulos faltantes (Ventas, Inventario, Cobranzas, Devoluciones, Caja) | Listo |
| DISP-023 | Endpoint de lectura de Auditoría (GET /api/audit-log) | Listo |
| DISP-024 | Documentación Swagger: 11 endpoints faltantes | Listo |
| DISP-030 | Frontend: cobranza (estado de cuenta, pagos, antigüedad) | Pendiente |
| DISP-031 | Frontend: caja (apertura y cierre de sesión) | Pendiente |
| DISP-032 | Frontend: devoluciones | Pendiente |
| DISP-030 | Frontend: cobranza (estado de cuenta, pagos, antigüedad) | Listo |
| DISP-031 | Frontend: caja (apertura y cierre de sesión) | Listo |
| DISP-032 | Frontend: devoluciones | Listo |
| DISP-033 | Frontend: reportes (ventas, cobros, antigüedad) | Listo |
| DISP-034 | Frontend: mensajería (plantillas y envío por WhatsApp) | Listo |
| DISP-035 | Frontend: facturación (estado de facturas) | Listo |
| DISP-036 | Frontend: usuarios y roles | Listo |
| DISP-037 | Frontend: enlaces del catálogo público | Listo |
| DISP-038 | Auditoría MVP: índices de la planificación, TIMESTAMPTZ y unicidad de lotes | Listo |
| DISP-039 | FEFO real con reparto entre lotes y rastro de la reserva (`order_item_batches`) | Listo |
| DISP-040 | Idempotencia en la toma de pedido del vendedor | Listo |
| DISP-041 | Gastos de ruta: tabla `cash_expenses` y arqueo con gastos | Listo |
| DISP-042 | Saldo inicial de cartera como cargo de apertura del libro mayor | Listo |
| DISP-043 | Soft-delete en zonas, clientes y catálogo (regla "nada se borra") | Pendiente |
| DISP-044 | Frontend: cobranza en `features/field` (cobro desde el móvil) | Pendiente |
| DISP-045 | Respaldo `pg_dump` programado y prueba de restauración | Pendiente |
| DISP-046 | Confirmar con el negocio si el precio de lista incluye IVA (hoy se suma 12%) | Pendiente |

## Definition of Done

1. Los tests del módulo pasan (pnpm test).
2. Errores de negocio devuelven un AppError con código claro, nunca
   un throw genérico.
3. Toda escritura queda en AuditLog cuando corresponde.
4. El PR de la tarea está mergeado en main antes de arrancar la
   siguiente.
