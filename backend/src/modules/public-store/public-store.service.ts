import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/AppError.js';
import { toJson, writeAudit } from '../../shared/audit/writeAudit.js';
import { DEFAULT_TOKEN_TTL_DAYS, generateClientAccessToken } from '../catalog-public/clientAccessToken.js';
import { createOrder, currentPrice } from '../sales/sales.service.js';
import type { CreateTokenInput, PublicOrderInput } from './public-store.schema.js';

/**
 * Usuario de sistema al que quedan atribuidos los pedidos del catálogo
 * público. Existe en el seed, inactivo y con una contraseña aleatoria: no
 * puede iniciar sesión, solo sirve para que `orders.user_id` sea válido.
 */
export const USUARIO_PEDIDOS_WEB_EMAIL = 'pedidos-web@disprova.local';

function money(value: Prisma.Decimal | string | number) {
  return new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

// --- Alta de token (admin) ---

export async function createClientAccessToken(clientId: number, input: CreateTokenInput, userId: number) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) {
    throw new AppError('Cliente no encontrado', 404, 'NOT_FOUND');
  }

  const dias = input.expiresInDays ?? DEFAULT_TOKEN_TTL_DAYS;
  const token = generateClientAccessToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + dias);

  const created = await prisma.$transaction(async (tx) => {
    const record = await tx.clientAccessToken.create({
      data: { clientId: client.id, token, expiresAt, createdByUserId: userId },
    });
    await writeAudit(tx, {
      userId,
      entidad: 'ClientAccessToken',
      entidadId: String(record.id),
      accion: 'create',
      // El token no va al audit: es un credencial vivo y el log no debe
      // servir para recuperar un enlace.
      datosDespues: { clientId: client.id, expiresAt, dias },
    });
    return record;
  });

  // No se invalidan los tokens previos: el cliente puede tener varios
  // enlaces vigentes al mismo tiempo.
  return {
    token: created.token,
    expiresAt: created.expiresAt,
    cliente: { id: client.id, nombreComercial: client.nombreComercial },
    // Ruta relativa: el frontend la prefija con su dominio.
    pathCatalogo: `/catalogo/${created.token}`,
  };
}

// --- Catálogo público ---

/**
 * Categorías y productos activos con el precio que le corresponde al cliente
 * del token. Reusa `currentPrice` de sales: la resolución de precio (el ítem
 * más reciente con `vigenteDesde` ya vencido) es la misma que usa el pedido.
 */
export async function getPublicCatalog(client: {
  id: number;
  priceListId: number;
  nombreComercial: string;
}) {
  const [categorias, productos] = await Promise.all([
    prisma.category.findMany({
      where: { activo: true },
      orderBy: [{ orden: 'asc' }, { id: 'asc' }],
    }),
    prisma.product.findMany({
      where: { activo: true, category: { activo: true } },
      orderBy: { id: 'asc' },
      include: { units: { where: { activo: true }, orderBy: { id: 'asc' } } },
    }),
  ]);

  const items = [];
  for (const producto of productos) {
    const unidades = [];
    for (const unidad of producto.units) {
      const precio = await currentPrice(client.priceListId, unidad.id);
      unidades.push({
        id: unidad.id,
        nombre: unidad.nombre,
        factor: unidad.factor.toString(),
        codigoBarras: unidad.codigoBarras,
        // Una presentación sin precio vigente no se ofrece: publicarla sin
        // precio haría que el cliente pida algo que no se puede cotizar.
        precio: precio ? money(precio.precio).toFixed(2) : null,
      });
    }
    items.push({
      id: producto.id,
      sku: producto.sku,
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      marca: producto.marca,
      categoryId: producto.categoryId,
      unidades,
    });
  }

  return {
    cliente: { id: client.id, nombreComercial: client.nombreComercial },
    categorias,
    productos: items,
  };
}

// --- Pedido público ---

async function usuarioPedidosWebId() {
  const usuario = await prisma.user.findUnique({
    where: { email: USUARIO_PEDIDOS_WEB_EMAIL },
  });
  if (!usuario) {
    throw new AppError(
      'Falta el usuario de sistema para pedidos web (lo crea el seed)',
      500,
      'WEB_ORDER_USER_MISSING',
    );
  }
  return usuario.id;
}

/**
 * Mismo contrato que `POST /api/orders`, pero el `clientId` sale del token
 * (cualquier `clientId` del body se ignora), el canal se fija en `web` y
 * el pedido queda en `borrador`: la confirmación —que valida crédito y
 * reserva stock— la sigue haciendo un admin o vendedor desde el panel. Así un
 * cliente externo no puede disparar movimientos de inventario por su cuenta.
 */
export async function createPublicOrder(
  publicClient: { id: number; priceListId: number },
  input: PublicOrderInput,
) {
  const userId = await usuarioPedidosWebId();

  const { order, created } = await createOrder(
    {
      clientId: publicClient.id,
      canal: 'web',
      condicionPago: input.condicionPago,
      idempotencyKey: input.idempotencyKey,
      items: input.items,
    },
    userId,
  );

  if (created) {
    await prisma.auditLog.create({
      data: {
        userId,
        entidad: 'Order',
        entidadId: String(order.id),
        accion: 'create_public',
        datosDespues: toJson({
          clientId: publicClient.id,
          canal: 'web',
          estado: 'borrador',
          via: 'catalogo-publico',
        }),
      },
    });
  }

  return { order, created };
}