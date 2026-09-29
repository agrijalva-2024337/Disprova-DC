/**
 * Esquemas del cuerpo de request/response. Cada uno espeja un schema de Zod
 * del módulo correspondiente: el comentario dice cuál, para que no se
 * dupliquen. Se referencian desde las rutas con `$ref`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ESQUEMAS: Record<string, any> = {
  Error: {
    type: 'object',
    required: ['error'],
    properties: {
      error: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string' },
          code: { type: 'string', description: 'Código de negocio, ej. INVALID_ORDER_STATE' },
          details: {
            type: 'object',
            description: 'Datos extra. En `NO_PRICE` trae `productUnitId` de la presentación sin precio vigente.',
            properties: {
              productUnitId: { type: 'integer' },
            },
          },
        },
      },
    },
  },
  LoginBody: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', format: 'password' },
    },
  },
  RefreshBody: {
    type: 'object',
    required: ['refreshToken'],
    properties: { refreshToken: { type: 'string' } },
  },
  CreateOrderBody: {
    type: 'object',
    required: ['clientId', 'canal', 'condicionPago', 'items'],
    description: 'Espejo de `createOrderSchema` en sales/sales.schema.ts',
    properties: {
      clientId: { type: 'integer', example: 1 },
      canal: { type: 'string', enum: ['campo', 'web', 'whatsapp'] },
      condicionPago: { type: 'string', enum: ['contado', 'credito'] },
      idempotencyKey: { type: 'string', description: 'Repetirla en 24 h devuelve el pedido ya creado (200)' },
      items: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['productUnitId', 'cantidad'],
          properties: {
            productUnitId: { type: 'integer' },
            cantidad: { oneOf: [{ type: 'string' }, { type: 'number' }], example: '2' },
          },
        },
      },
    },
  },
  DeliverOrderBody: {
    type: 'object',
    required: ['items'],
    description: 'Espejo de `deliverOrderSchema` en sales/sales.schema.ts',
    properties: {
      recibidoPor: { type: 'string', nullable: true },
      observaciones: { type: 'string', nullable: true },
      items: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['orderItemId', 'cantidadEntregada'],
          properties: {
            orderItemId: { type: 'integer' },
            cantidadEntregada: { oneOf: [{ type: 'string' }, { type: 'number' }] },
            batchId: { type: 'integer', nullable: true, description: 'Obligatorio si el producto es controlado' },
          },
        },
      },
    },
  },
  CreateClientBody: {
    type: 'object',
    required: ['nombreComercial', 'tipoNegocio', 'zoneId', 'ordenRuta', 'direccion', 'priceListId'],
    description: 'Espejo de `createClientSchema` en sales-territory/sales-territory.schema.ts',
    properties: {
      nombreComercial: { type: 'string' },
      nit: { type: 'string', nullable: true },
      tipoNegocio: { type: 'string', enum: ['tienda', 'farmacia', 'mercado', 'otro'] },
      zoneId: { type: 'integer' },
      ordenRuta: { type: 'integer', description: 'Único dentro de la zona' },
      direccion: { type: 'string' },
      priceListId: { type: 'integer' },
      limiteCredito: { oneOf: [{ type: 'string' }, { type: 'number' }] },
      plazoDias: { type: 'integer' },
    },
  },
  CreateMessageTemplateBody: {
    type: 'object',
    required: ['nombre', 'canal', 'cuerpo'],
    description: 'Espejo de `createTemplateSchema` en messaging/messaging.schema.ts',
    properties: {
      nombre: { type: 'string', uniqueItems: true },
      canal: { type: 'string', enum: ['wa_link', 'whatsapp_api'] },
      cuerpo: {
        type: 'string',
        description: 'Solo puede usar {nombre}, {saldo} y {ultimoPedidoUrl}. Cualquier otra variable se rechaza al guardar.',
        example: 'Hola {nombre}, tu saldo es {saldo}. Catálogo: {ultimoPedidoUrl}',
      },
      activo: { type: 'boolean' },
    },
  },
  PublicOrderBody: {
    type: 'object',
    required: ['condicionPago', 'items'],
    description:
      'Espejo de `publicOrderSchema` en public-store/public-store.schema.ts. `clientId` y `canal` los fija el servidor: si vienen, se ignoran.',
    properties: {
      condicionPago: { type: 'string', enum: ['contado', 'credito'] },
      idempotencyKey: { type: 'string' },
      items: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['productUnitId', 'cantidad'],
          properties: {
            productUnitId: { type: 'integer' },
            cantidad: { oneOf: [{ type: 'string' }, { type: 'number' }] },
          },
        },
      },
    },
  },
  CreateClientAccessTokenBody: {
    type: 'object',
    properties: {
      expiresInDays: {
        type: 'integer',
        minimum: 1,
        maximum: 365,
        default: 30,
        description: 'Vigencia del enlace. Por defecto 30 días.',
      },
    },
  },
  CreateInvoiceBody: {
    type: 'object',
    properties: {
      serie: { type: 'string', description: 'Por defecto la de `FEL_SERIE` (A si no está definida).' },
    },
  },
  CreateReturnBody: {
    type: 'object',
    required: ['clientId', 'orderId', 'motivo', 'items'],
    description: 'Espejo de `createReturnSchema` en returns/returns.schema.ts',
    properties: {
      clientId: { type: 'integer' },
      orderId: { type: 'integer' },
      motivo: { type: 'string' },
      items: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['orderItemId', 'cantidad'],
          properties: {
            orderItemId: { type: 'integer' },
            cantidad: { oneOf: [{ type: 'string' }, { type: 'number' }] },
            batchId: { type: 'integer', nullable: true },
            destino: { type: 'string', enum: ['reingreso', 'merma'] },
          },
        },
      },
    },
  },
};
