import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/AppError.js';
import { routeCalendar } from '../sales-territory/routeCalendar.js';
import { BusinessApiWhatsAppProvider, LinkWhatsAppProvider, getWhatsAppProvider } from './providers/whatsapp.provider.js';
import { ALLOWED_VARIABLES, unknownVariables } from './messaging.schema.js';
import type { CreateTemplateInput, UpdateTemplateInput } from './messaging.schema.js';

export const SEND_NOT_CONFIGURED_MESSAGE =
  'el envío automático no está configurado, usa el link. Configura WHATSAPP_PROVIDER=business_api y las credenciales para habilitarlo';

/** Placeholder hasta que exista el catálogo público con token (DISP-017). */
function catalogoUrl(clientId: number): string {
  return `/catalogo/${clientId}`;
}

function money(value: Prisma.Decimal | string | number) {
  return new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function writeAudit(
  tx: Prisma.TransactionClient,
  data: {
    userId: number;
    entidad: string;
    entidadId: string;
    accion: string;
    datosAntes?: unknown;
    datosDespues?: unknown;
  },
) {
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

function rethrowPrisma(err: unknown): never {
  if (err instanceof AppError) {
    throw err;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      throw new AppError('Ya existe un registro con esos datos', 409, 'CONFLICT');
    }
    if (err.code === 'P2003' || err.code === 'P2014') {
      throw new AppError('No se puede completar la operación por referencias existentes', 409, 'CONFLICT');
    }
    if (err.code === 'P2025') {
      throw new AppError('No encontrado', 404, 'NOT_FOUND');
    }
  }
  throw err;
}

/**
 * Las variables se validan al crear/editar, no al enviar: si una plantilla
 * inválida llegara al envío, el mensaje saldría con el texto sin resolver.
 */
function assertVariablesPermitidas(cuerpo: string) {
  const desconocidas = unknownVariables(cuerpo);
  if (desconocidas.length === 0) {
    return;
  }

  throw new AppError(
    `La plantilla usa variables no permitidas: ${desconocidas.map((v) => `{${v}}`).join(', ')}. Solo se permiten ${ALLOWED_VARIABLES.map((v) => `{${v}}`).join(', ')}`,
    422,
    'INVALID_TEMPLATE_VARIABLE',
  );
}

// --- Plantillas ---

export async function listTemplates() {
  return prisma.messageTemplate.findMany({ orderBy: { id: 'asc' } });
}

async function requireTemplate(templateId: number) {
  const template = await prisma.messageTemplate.findUnique({ where: { id: templateId } });
  if (!template) {
    throw new AppError('Plantilla no encontrada', 404, 'NOT_FOUND');
  }
  return template;
}

export async function createTemplate(input: CreateTemplateInput, userId: number) {
  assertVariablesPermitidas(input.cuerpo);

  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.messageTemplate.create({ data: input });
      await writeAudit(tx, {
        userId,
        entidad: 'MessageTemplate',
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

export async function updateTemplate(id: number, input: UpdateTemplateInput, userId: number) {
  if (input.cuerpo !== undefined) {
    assertVariablesPermitidas(input.cuerpo);
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.messageTemplate.findUnique({ where: { id } });
      if (!existing) {
        throw new AppError('Plantilla no encontrada', 404, 'NOT_FOUND');
      }
      const updated = await tx.messageTemplate.update({ where: { id }, data: input });
      await writeAudit(tx, {
        userId,
        entidad: 'MessageTemplate',
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

export async function deactivateTemplate(id: number, userId: number) {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.messageTemplate.findUnique({ where: { id } });
      if (!existing) {
        throw new AppError('Plantilla no encontrada', 404, 'NOT_FOUND');
      }
      const updated = await tx.messageTemplate.update({ where: { id }, data: { activo: false } });
      await writeAudit(tx, {
        userId,
        entidad: 'MessageTemplate',
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

// --- Resolución de la plantilla ---

type ClientConContactos = Prisma.ClientGetPayload<{ include: { contacts: true } }>;

/** Prefiere el contacto principal de WhatsApp, luego cualquier WhatsApp. */
function elegirTelefono(client: ClientConContactos): string {
  const contacto =
    client.contacts.find((c) => c.esPrincipal && c.esWhatsapp) ??
    client.contacts.find((c) => c.esWhatsapp) ??
    client.contacts.find((c) => c.esPrincipal) ??
    client.contacts[0];

  if (!contacto) {
    throw new AppError('El cliente no tiene ningún contacto con teléfono registrado', 422, 'CLIENT_HAS_NO_CONTACT');
  }

  return contacto.telefono;
}

/** Saldo vigente: el `saldoResultante` del último movimiento, o 0 si no hay. */
export async function saldoActual(clientId: number): Promise<Prisma.Decimal> {
  const last = await prisma.accountMovement.findFirst({
    where: { clientId },
    orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
  });

  return money(last?.saldoResultante ?? 0);
}

/**
 * Reemplaza {nombre}, {saldo} y {ultimoPedidoUrl} con los datos reales del
 * cliente y devuelve el texto ya listo para enviar.
 */
export async function resolveTemplate(
  template: { cuerpo: string },
  client: ClientConContactos,
): Promise<string> {
  const saldo = await saldoActual(client.id);

  return template.cuerpo
    .replace(/\{nombre\}/g, client.nombreComercial)
    .replace(/\{saldo\}/g, `Q${saldo.toFixed(2)}`)
    .replace(/\{ultimoPedidoUrl\}/g, catalogoUrl(client.id));
}

async function requireClientConContactos(clientId: number) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { contacts: true },
  });
  if (!client) {
    throw new AppError('Cliente no encontrado', 404, 'NOT_FOUND');
  }
  return client;
}

// --- Link ---

/**
 * El link siempre está disponible, sin importar qué diga WHATSAPP_PROVIDER:
 * no requiere credenciales y es lo que usa el admin para enviar a mano.
 */
export async function buildLinkForClient(clientId: number, templateId: number, userId: number) {
  const [template, client] = await Promise.all([
    requireTemplate(templateId),
    requireClientConContactos(clientId),
  ]);

  const contenido = await resolveTemplate(template, client);
  const telefono = elegirTelefono(client);
  const url = new LinkWhatsAppProvider().buildLink(telefono, contenido);

  await prisma.$transaction(async (tx) => {
    const log = await tx.messageLog.create({
      data: {
        clientId: client.id,
        templateId: template.id,
        telefono,
        contenido,
        canal: 'wa_link',
        estado: 'generado',
        userId,
      },
    });
    await writeAudit(tx, {
      userId,
      entidad: 'MessageLog',
      entidadId: String(log.id),
      accion: 'link',
      datosDespues: { clientId: client.id, templateId: template.id },
    });
  });

  return { url, contenido };
}

// --- Envío ---

export async function sendToClient(clientId: number, templateId: number, userId: number) {
  const provider = getWhatsAppProvider();

  if (provider.mode === 'wa_link') {
    throw new AppError(SEND_NOT_CONFIGURED_MESSAGE, 422, 'WHATSAPP_SEND_NOT_CONFIGURED');
  }

  const [template, client] = await Promise.all([
    requireTemplate(templateId),
    requireClientConContactos(clientId),
  ]);

  const contenido = await resolveTemplate(template, client);
  const telefono = elegirTelefono(client);
  const businessProvider = provider as BusinessApiWhatsAppProvider;
  const resultado = await businessProvider.send(telefono, contenido);

  const log = await prisma.$transaction(async (tx) => {
    const created = await tx.messageLog.create({
      data: {
        clientId: client.id,
        templateId: template.id,
        telefono,
        contenido,
        canal: 'whatsapp_api',
        estado: resultado.ok ? 'enviado' : 'fallido',
        error: resultado.ok ? null : resultado.error,
        userId,
      },
    });
    await writeAudit(tx, {
      userId,
      entidad: 'MessageLog',
      entidadId: String(created.id),
      accion: 'send',
      datosDespues: {
        clientId: client.id,
        templateId: template.id,
        estado: resultado.ok ? 'enviado' : 'fallido',
        error: resultado.ok ? null : resultado.error,
      },
    });
    return created;
  });

  if (!resultado.ok) {
    throw new AppError(resultado.error, 502, 'WHATSAPP_SEND_FAILED');
  }

  return log;
}

// --- Historial ---

export async function listClientHistory(clientId: number) {
  await requireClientConContactos(clientId);

  return prisma.messageLog.findMany({
    where: { clientId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
}

// --- Broadcast de hoy ---

/**
 * Misma zona activa que usa route-visits/today, pero solo con los clientes que
 * tienen algún contacto que acepta mensajes. Devuelve links para que el admin
 * los vaya tocando uno por uno: no envía nada.
 */
export async function broadcastToday(templateId: number, userId: number) {
  const template = await requireTemplate(templateId);
  const calendar = routeCalendar();

  const zones = await prisma.zone.findMany({
    where: {
      activo: true,
      semanaMes: calendar.semanaMes,
      diasSemana: { has: calendar.diaSemana },
    },
    orderBy: { id: 'asc' },
  });

  if (zones.length === 0) {
    return [];
  }

  const clients = await prisma.client.findMany({
    where: {
      zoneId: { in: zones.map((zone) => zone.id) },
      contacts: { some: { aceptaMensajes: true } },
    },
    orderBy: [{ zoneId: 'asc' }, { ordenRuta: 'asc' }],
    include: { contacts: true },
  });

  const linkProvider = new LinkWhatsAppProvider();
  const filas: Array<{ clientId: number; nombre: string; url: string }> = [];

  for (const client of clients) {
    const contactoAcepta = client.contacts.find((c) => c.aceptaMensajes);
    if (!contactoAcepta) {
      continue;
    }
    const contenido = await resolveTemplate(template, client);
    filas.push({
      clientId: client.id,
      nombre: client.nombreComercial,
      url: linkProvider.buildLink(contactoAcepta.telefono, contenido),
    });
  }

  await writeAudit(prisma, {
    userId,
    entidad: 'MessageTemplate',
    entidadId: String(template.id),
    accion: 'broadcast_today',
    datosDespues: { clientes: filas.length },
  });

  return filas;
}

