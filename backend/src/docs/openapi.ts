import swaggerJsdoc from 'swagger-jsdoc';
import fs from 'node:fs';
import path from 'node:path';
import { ESQUEMAS } from './openapi.schemas.js';

/**
 * Dónde viven los comentarios `#swagger`. El backend siempre corre con el
 * cwd en `backend/` (`pnpm dev`, vitest, tsx y el CMD del Docker), así que
 * se ancla ahí y no en `__dirname`, que bajo tsx apunta al archivo de entrada.
 * Si no se encuentra, se tira la excepción: es preferible que la app no
 * arranque a que se sirva un spec vacío sin avisar.
 */
function modulosDir(): string {
  const candidatas = [
    path.resolve(process.cwd(), 'src', 'modules'),
    path.resolve(__dirname, '..', 'modules'),
  ];
  const encontrada = candidatas.find((dir) => fs.existsSync(dir));
  if (!encontrada) {
    throw new Error(
      `Swagger: no se encontró el directorio de módulos. Probé: ${candidatas.join(', ')} (cwd: ${process.cwd()})`,
    );
  }
  return encontrada;
}

/**
 * Un solo Swagger para todo el backend: es un monolito, no hay servicios
 * separados. Los comentarios `#swagger` viven arriba de cada ruta, en el
 * archivo de rutas de su módulo, y se fusionan acá.
 */
export const TAGS = [
  'Auth',
  'Usuarios',
  'Auditoría',
  'Catálogo',
  'Zonas y Clientes',
  'Inventario',
  'Ventas',
  'Cobranza',
  'Caja',
  'Devoluciones',
  'Reportes',
  'Mensajería',
  'Catálogo Público',
  'Facturación',
] as const;

const TAGS_DESCRIPCION: Record<string, string> = {
  'Usuarios': 'Alta y edición de usuarios, y catálogo de roles.',
  'Auditoría': 'Consulta del rastro de cambios, solo admin.',
  Auth: 'Inicio de sesión y refresco de token.',
  'Catálogo': 'Categorías, productos, presentaciones, imágenes y listas de precios.',
  'Zonas y Clientes': 'Zonas, clientes, contactos y visitas de ruta.',
  Inventario: 'Bodegas, lotes, existencias y movimientos de inventario.',
  Ventas: 'Pedidos: alta, confirmación, entrega y cancelación.',
  Cobranza: 'Visitas de cobranza, pagos y cuenta corriente del cliente.',
  Caja: 'Apertura y cierre de caja.',
  Devoluciones: 'Devoluciones de mercadería ya entregada.',
  Reportes: 'Reportes de ventas, cobranza y antigüedad de saldos.',
  'Mensajería': 'Plantillas de mensaje, enlace wa.me, envío e historial.',
  'Catálogo Público': 'Catálogo y pedidos por token de cliente, sin sesión.',
  Facturación: 'Emisión de facturas y su estado de certificación FEL.',
};

export function buildOpenApiSpec() {
  return swaggerJsdoc({
    definition: {
      openapi: '3.0.3',
      info: {
        title: 'Disprova GyG — API',
        version: '0.1.0',
        description:
          'API de pedidos, inventario, cobranza, mensajería y facturación para distribución.\n\n' +
          '**Autenticación:** la mayoría de los endpoints usan JWT (Bearer) y exigen rol `admin` o `vendedor` para escribir. ' +
          '**Catálogo Público** y **Facturación** tienen reglas propias, descritas en cada ruta.',
      },
      servers: [{ url: '/api', description: 'Servidor local' }],
      tags: TAGS.map((name) => ({ name, description: TAGS_DESCRIPCION[name] })),
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Token de `POST /auth/login`. Las rutas con `security: []` no lo requieren.',
          },
          clientToken: {
            type: 'apiKey',
            in: 'header',
            name: 'X-Client-Token',
            description: 'Token opaco de cliente. También se acepta en el query param `token`.',
          },
        },
        schemas: ESQUEMAS,
      },
    },
    // Los comentarios #swagger están en los archivos de rutas de cada módulo.
    // El glob va con separadores `/`: en Windows, `path.join` produce
    // backslashes y `glob` no los reconoce.
    apis: [`${modulosDir().split(path.sep).join('/')}/**/*.routes.ts`],
  });
}

export const openApiSpec = buildOpenApiSpec();
