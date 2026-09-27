import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/AppError.js';
import { LIMITE_POR_DEFECTO, type AuditLogQuery } from './audit.schema.js';

/**
 * `entidad` se escribe con el nombre del modelo Prisma ('Order', 'CashSession')
 * pero quien consulta piensa en la tabla ('orders', 'cash_sessions'). Se
 * comparan normalizados a minúsculas, sin separadores y en singular, así que
 * `orders`, `Order` y `ORDERS` caen en la misma fila.
 *
 * No se resuelve con un mapa fijo a propósito: el valor se busca contra lo que
 * hay realmente en la tabla, así el filtro sigue funcionando si mañana se
 * normaliza la convención de nombres en el código que escribe el log.
 */
function normalizarEntidad(value: string) {
  const base = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (base.endsWith('ies')) {
    return `${base.slice(0, -3)}y`;
  }
  if (base.endsWith('s')) {
    return base.slice(0, -1);
  }
  return base;
}

async function resolverEntidades(buscada: string) {
  const distintas = await prisma.auditLog.findMany({
    distinct: ['entidad'],
    select: { entidad: true },
    orderBy: { entidad: 'asc' },
  });
  const objetivo = normalizarEntidad(buscada);
  const encontradas = distintas
    .map((row) => row.entidad)
    .filter((entidad) => normalizarEntidad(entidad) === objetivo);

  if (encontradas.length === 0) {
    const disponibles = distintas.map((row) => row.entidad);
    throw new AppError(
      disponibles.length > 0
        ? `No hay auditoría para la entidad '${buscada}'. Disponibles: ${disponibles.join(', ')}`
        : `No hay auditoría para la entidad '${buscada}': la tabla de auditoría está vacía`,
      400,
      'UNKNOWN_ENTITY',
    );
  }
  return encontradas;
}

export async function listAuditLog(query: AuditLogQuery) {
  const where: Prisma.AuditLogWhereInput = {};

  if (query.entity) {
    where.entidad = { in: await resolverEntidades(query.entity) };
  }
  if (query.entityId) {
    where.entidadId = query.entityId;
  }
  if (query.userId) {
    where.userId = query.userId;
  }
  if (query.startDate || query.endDate) {
    where.createdAt = { gte: query.startDate, lte: query.endDate };
  }

  const limit = query.limit ?? LIMITE_POR_DEFECTO;
  const offset = query.offset ?? 0;

  const [total, registros] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, nombre: true, email: true } } },
      // El id va de desempate: varias acciones caen en la misma transacción y
      // comparten created_at. Sin él la paginación repite o saltea filas.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      skip: offset,
    }),
  ]);

  return {
    data: registros.map((row) => ({
      id: row.id,
      entidad: row.entidad,
      entidadId: row.entidadId,
      accion: row.accion,
      datosAntes: row.datosAntes,
      datosDespues: row.datosDespues,
      createdAt: row.createdAt,
      usuario: {
        id: row.user.id,
        nombre: row.user.nombre,
        email: row.user.email,
      },
    })),
    meta: {
      total,
      limit,
      offset,
      count: registros.length,
      hasMore: offset + registros.length < total,
    },
  };
}