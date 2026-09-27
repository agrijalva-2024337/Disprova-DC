import { Prisma } from '@prisma/client';

/**
 * ÚNICA puerta de escritura de la tabla `audit_log` en todo el sistema.
 *
 * Ningún módulo debe llamar prisma.auditLog.create() por su cuenta. El rastro
 * se escribe SIEMPRE con la transacción del cambio que se está auditando, no
 * después: si el log va en otra transacción, un rollback del cambio deja un
 * log que dice que algo pasó cuando no pasó, o al revés.
 *
 * `entidad` es el nombre del modelo Prisma ('Order', 'Payment', 'CashSession'),
 * nunca el nombre de la tabla, para que el lector no tenga que saber el mapeo.
 */

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export type AuditEntry = {
  userId: number;
  entidad: string;
  entidadId: string;
  accion: string;
  datosAntes?: unknown;
  datosDespues?: unknown;
};

export async function writeAudit(tx: Prisma.TransactionClient, data: AuditEntry) {
  await tx.auditLog.create({
    data: {
      userId: data.userId,
      entidad: data.entidad,
      entidadId: data.entidadId,
      accion: data.accion,
      datosAntes: toJson(data.datosAntes),
      datosDespues: toJson(data.datosDespues),
    },
  });
}

/**
 * Convierte a JSON lo que se va a guardar en audit_log. Decimals y fechas no
 * son InputJsonValue, así que hay que serializarlos antes. Se exporta para los
 * pocos sitios que escriben el log fuera de una transacción interactiva.
 */
export { toJson };