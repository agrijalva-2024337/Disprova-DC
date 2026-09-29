import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/AppError.js';
import { writeAudit } from '../../shared/audit/writeAudit.js';
import { getAccount } from '../collections/collections.service.js';
import { routeCalendar } from './routeCalendar.js';
import type {
  CreateClientInput,
  CreateContactInput,
  CreateRouteVisitInput,
  CreateZoneInput,
  UpdateClientInput,
  UpdateContactInput,
  UpdateZoneInput,
} from './sales-territory.schema.js';


function rethrowPrisma(err: unknown): never {
  if (err instanceof AppError) {
    throw err;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      throw new AppError('Ya existe un registro con esos datos', 409, 'CONFLICT');
    }
    if (err.code === 'P2003' || err.code === 'P2014') {
      throw new AppError(
        'No se puede completar la operación por referencias existentes',
        409,
        'CONFLICT',
      );
    }
    if (err.code === 'P2025') {
      throw new AppError('No encontrado', 404, 'NOT_FOUND');
    }
  }
  throw err;
}

function decimalOrNull(value: string | number | null | undefined) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return String(value);
}

export async function listZones() {
  return prisma.zone.findMany({ where: { activo: true }, orderBy: { id: 'asc' } });
}

export async function getZone(id: number) {
  const zone = await prisma.zone.findUnique({
    where: { id },
    include: { clients: { orderBy: { ordenRuta: 'asc' } } },
  });
  if (!zone) {
    throw new AppError('Zona no encontrada', 404, 'NOT_FOUND');
  }
  return zone;
}

export async function createZone(input: CreateZoneInput, userId: number) {
  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.zone.create({ data: input });
      await writeAudit(tx, {
        userId,
        entidad: 'Zone',
        entidadId: String(created.id),
        accion: 'create',
        datosDespues: created,
      });
      return created;
    });
  } catch (err) {
    rethrowPrisma(err);
  }
}

export async function updateZone(id: number, input: UpdateZoneInput, userId: number) {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.zone.findUnique({ where: { id } });
      if (!existing) {
        throw new AppError('Zona no encontrada', 404, 'NOT_FOUND');
      }
      const updated = await tx.zone.update({ where: { id }, data: input });
      await writeAudit(tx, {
        userId,
        entidad: 'Zone',
        entidadId: String(id),
        accion: 'update',
        datosAntes: existing,
        datosDespues: updated,
      });
      return updated;
    });
  } catch (err) {
    rethrowPrisma(err);
  }
}

/**
 * Desactiva la zona. No la borra.
 *
 * La sección 8 de la planificación: "Nada se borra. Clientes, productos y
 * pedidos se desactivan o anulan, nunca se eliminan." Una zona con historial
 * de visitas borrada deja al vendedor sin poder reconstruir su ruta.
 */
export async function deleteZone(id: number, userId: number) {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.zone.findUnique({ where: { id } });
      if (!existing) {
        throw new AppError('Zona no encontrada', 404, 'NOT_FOUND');
      }
      if (!existing.activo) {
        throw new AppError('La zona ya está desactivada', 409, 'ALREADY_INACTIVE');
      }
      const updated = await tx.zone.update({ where: { id }, data: { activo: false } });
      await writeAudit(tx, {
        userId,
        entidad: 'Zone',
        entidadId: String(id),
        accion: 'deactivate',
        datosAntes: existing,
        datosDespues: updated,
      });
      return updated;
    });
  } catch (err) {
    rethrowPrisma(err);
  }
}

export async function listClients() {
  return prisma.client.findMany({
    where: { activo: true },
    orderBy: [{ zoneId: 'asc' }, { ordenRuta: 'asc' }],
    include: { contacts: true },
  });
}

export async function getClient(id: number) {
  const client = await prisma.client.findUnique({
    where: { id },
    include: { contacts: true, zone: true, priceList: true },
  });
  if (!client) {
    throw new AppError('Cliente no encontrado', 404, 'NOT_FOUND');
  }
  return client;
}

export async function createClient(input: CreateClientInput, userId: number) {
  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.client.create({
        data: {
          ...input,
          lat: decimalOrNull(input.lat),
          lng: decimalOrNull(input.lng),
          limiteCredito: input.limiteCredito === undefined ? undefined : String(input.limiteCredito),
        },
        include: { contacts: true },
      });
      await writeAudit(tx, {
        userId,
        entidad: 'Client',
        entidadId: String(created.id),
        accion: 'create',
        datosDespues: created,
      });
      return created;
    });
  } catch (err) {
    rethrowPrisma(err);
  }
}

export async function updateClient(id: number, input: UpdateClientInput, userId: number) {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.client.findUnique({ where: { id } });
      if (!existing) {
        throw new AppError('Cliente no encontrado', 404, 'NOT_FOUND');
      }
      const updated = await tx.client.update({
        where: { id },
        data: {
          ...input,
          lat: decimalOrNull(input.lat),
          lng: decimalOrNull(input.lng),
          limiteCredito: input.limiteCredito === undefined ? undefined : String(input.limiteCredito),
        },
        include: { contacts: true },
      });
      await writeAudit(tx, {
        userId,
        entidad: 'Client',
        entidadId: String(id),
        accion: 'update',
        datosAntes: existing,
        datosDespues: updated,
      });
      return updated;
    });
  } catch (err) {
    rethrowPrisma(err);
  }
}

/**
 * Desactiva el cliente. No lo borra, y sobre todo NO borra sus visitas.
 *
 * Antes esta función hacía `routeVisit.deleteMany` y `clientContact.deleteMany`
 * en cascada antes de borrar al cliente: cada visita de ruta quedaba sin
 * registro y con ella se perdía la medida de la ruta, que es justo lo que el
 * negocio necesita para saber a quién no se le ha visitado. El historial de
 * visitas es el activo más valioso del sistema.
 */
export async function deleteClient(id: number, userId: number) {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.client.findUnique({
        where: { id },
        include: { contacts: true },
      });
      if (!existing) {
        throw new AppError('Cliente no encontrado', 404, 'NOT_FOUND');
      }
      if (!existing.activo) {
        throw new AppError('El cliente ya está desactivado', 409, 'ALREADY_INACTIVE');
      }
      // Los tokens del catálogo público se revocan: un cliente desactivado no
      // debe seguir teniendo una URL viva que muestre su lista de precios.
      await tx.clientAccessToken.updateMany({
        where: { clientId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const updated = await tx.client.update({ where: { id }, data: { activo: false } });
      await writeAudit(tx, {
        userId,
        entidad: 'Client',
        entidadId: String(id),
        accion: 'deactivate',
        datosAntes: existing,
        datosDespues: updated,
      });
      return updated;
    });
  } catch (err) {
    rethrowPrisma(err);
  }
}

async function requireClient(tx: Prisma.TransactionClient, clientId: number) {
  const client = await tx.client.findUnique({ where: { id: clientId } });
  if (!client) {
    throw new AppError('Cliente no encontrado', 404, 'NOT_FOUND');
  }
  return client;
}

export async function listClientContacts(clientId: number) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) {
    throw new AppError('Cliente no encontrado', 404, 'NOT_FOUND');
  }
  return prisma.clientContact.findMany({
    where: { clientId },
    orderBy: { id: 'asc' },
  });
}

export async function getClientContact(clientId: number, contactId: number) {
  const contact = await prisma.clientContact.findFirst({
    where: { id: contactId, clientId },
  });
  if (!contact) {
    throw new AppError('Contacto no encontrado', 404, 'NOT_FOUND');
  }
  return contact;
}

export async function createClientContact(clientId: number, input: CreateContactInput, userId: number) {
  try {
    return await prisma.$transaction(async (tx) => {
      await requireClient(tx, clientId);
      if (input.esPrincipal) {
        await tx.clientContact.updateMany({
          where: { clientId, esPrincipal: true },
          data: { esPrincipal: false },
        });
      }
      const created = await tx.clientContact.create({
        data: {
          clientId,
          nombre: input.nombre,
          telefono: input.telefono,
          esWhatsapp: input.esWhatsapp,
          aceptaMensajes: input.aceptaMensajes ?? false,
          esPrincipal: input.esPrincipal ?? false,
        },
      });
      await writeAudit(tx, {
        userId,
        entidad: 'ClientContact',
        entidadId: String(created.id),
        accion: 'create',
        datosDespues: created,
      });
      return created;
    });
  } catch (err) {
    rethrowPrisma(err);
  }
}

export async function updateClientContact(
  clientId: number,
  contactId: number,
  input: UpdateContactInput,
  userId: number,
) {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.clientContact.findFirst({
        where: { id: contactId, clientId },
      });
      if (!existing) {
        throw new AppError('Contacto no encontrado', 404, 'NOT_FOUND');
      }
      if (input.esPrincipal) {
        await tx.clientContact.updateMany({
          where: { clientId, esPrincipal: true, id: { not: contactId } },
          data: { esPrincipal: false },
        });
      }
      const updated = await tx.clientContact.update({
        where: { id: contactId },
        data: input,
      });
      await writeAudit(tx, {
        userId,
        entidad: 'ClientContact',
        entidadId: String(contactId),
        accion: 'update',
        datosAntes: existing,
        datosDespues: updated,
      });
      return updated;
    });
  } catch (err) {
    rethrowPrisma(err);
  }
}

export async function deleteClientContact(clientId: number, contactId: number, userId: number) {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.clientContact.findFirst({
        where: { id: contactId, clientId },
      });
      if (!existing) {
        throw new AppError('Contacto no encontrado', 404, 'NOT_FOUND');
      }
      await tx.clientContact.delete({ where: { id: contactId } });
      await writeAudit(tx, {
        userId,
        entidad: 'ClientContact',
        entidadId: String(contactId),
        accion: 'delete',
        datosAntes: existing,
      });
      return existing;
    });
  } catch (err) {
    rethrowPrisma(err);
  }
}

export async function getTodayRoute(now = new Date()) {
  const calendar = routeCalendar(now);
  const zones = await prisma.zone.findMany({
    where: {
      activo: true,
      semanaMes: calendar.semanaMes,
      diasSemana: { has: calendar.diaSemana },
    },
    orderBy: { id: 'asc' },
  });

  const clientsEnZona =
    zones.length === 0
      ? []
      : await prisma.client.findMany({
          // Un cliente desactivado no aparece en la ruta: el vendedor no debe
          // visitar un local que ya no se atiende. Su historial de visitas y
          // pedidos queda intacto.
          where: { zoneId: { in: zones.map((zone) => zone.id) }, activo: true },
          orderBy: [{ zoneId: 'asc' }, { ordenRuta: 'asc' }],
          include: {
            contacts: true,
            visits: { where: { fecha: calendar.fecha } },
          },
        });

  // El saldo es el de cobranza, no un 0 de relleno: un cargo pendiente se tiene
  // que ver en la ruta. Cada cliente se resuelve por separado y todos en
  // paralelo, porque ninguno depende del resultado de otro.
  const clients = await Promise.all(
    clientsEnZona.map(async (client) => {
      const { visits, ...rest } = client;
      const { saldoActual } = await getAccount(client.id);
      return {
        ...rest,
        saldoActual: Number(saldoActual),
        visitadoHoy: visits.length > 0,
        visitaHoy: visits[0] ?? null,
      };
    }),
  );

  return {
    fecha: calendar.fecha.toISOString().slice(0, 10),
    semanaMes: calendar.semanaMes,
    diaSemana: calendar.diaSemana,
    zones,
    clients,
  };
}

export async function createRouteVisit(input: CreateRouteVisitInput, userId: number) {
  const fecha = input.fecha
    ? new Date(Date.UTC(input.fecha.getUTCFullYear(), input.fecha.getUTCMonth(), input.fecha.getUTCDate()))
    : routeCalendar().fecha;

  try {
    return await prisma.$transaction(async (tx) => {
      await requireClient(tx, input.clientId);
      const created = await tx.routeVisit.create({
        data: {
          clientId: input.clientId,
          userId,
          fecha,
          resultado: input.resultado,
          motivo: input.motivo,
          observaciones: input.observaciones,
          lat: decimalOrNull(input.lat),
          lng: decimalOrNull(input.lng),
        },
      });
      await writeAudit(tx, {
        userId,
        entidad: 'RouteVisit',
        entidadId: String(created.id),
        accion: 'create',
        datosDespues: created,
      });
      return created;
    });
  } catch (err) {
    rethrowPrisma(err);
  }
}
