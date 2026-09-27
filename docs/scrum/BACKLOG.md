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

## Definition of Done

1. Los tests del módulo pasan (pnpm test).
2. Errores de negocio devuelven un AppError con código claro, nunca
   un throw genérico.
3. Toda escritura queda en AuditLog cuando corresponde.
4. El PR de la tarea está mergeado en main antes de arrancar la
   siguiente.
