import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { TAGS, openApiSpec } from './openapi.js';

type Operation = {
  tags?: string[];
  summary?: string;
  responses?: Record<string, unknown>;
  security?: unknown[];
};

type PathItem = Record<string, Operation>;

const spec = openApiSpec as unknown as { paths: Record<string, PathItem> };

/**
 * Rutas que Express tiene montadas y que no son endpoints de negocio: son
 * infraestructura y no van en el spec. `/health` va en /api, `/docs` no.
 */
const SIN_DOCUMENTAR_POR_EXCEPCION = new Set(['/health', '/docs.json']);

const RAIZ_SRC = resolve(process.cwd(), 'src');

function archivosTS(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) {
      return archivosTS(ruta);
    }
    return ruta.endsWith('.routes.ts') ? [ruta] : [];
  });
}

/**
 * El spec declara `servers: [{ url: '/api' }]`, así que las rutas se guardan
 * sin ese prefijo; y usa `{id}` donde Express usa `:id`. Se normaliza para que
 * las dos fuentes sean comparables.
 */
function alFormatoSpec(ruta: string) {
  return ruta
    .replace(/^\/api/, '')
    .replace(/:(\w+)/g, '{$1}')
    .replace(/\/+$/, '');
}

/** Montajes de app.ts: nombreDelRouter -> prefijo. */
function prefijosDeRouters() {
  const appSrc = readFileSync(join(RAIZ_SRC, 'app.ts'), 'utf8');
  const mapa = new Map<string, string>();
  for (const m of appSrc.matchAll(/app\.use\(\s*'([^']+)'\s*,\s*(\w+)\s*\)/g)) {
    mapa.set(m[2], m[1]);
  }
  return mapa;
}

/**
 * Cada `METODO ruta` que Express sirve de verdad, en el formato del spec.
 * Se arma leyendo los `.routes.ts` y sus montajes: la alternativa (recorrer
 * `app.router.stack`) no es estable entre versiones de Express.
 */
function rutasReales() {
  const prefijos = prefijosDeRouters();
  const reales = new Set<string>();
  for (const archivo of archivosTS(RAIZ_SRC)) {
    const src = readFileSync(archivo, 'utf8');
    for (const m of src.matchAll(/(\w+)\.(get|post|put|patch|delete)\(\s*'([^']+)'/g)) {
      const prefijo = prefijos.get(m[1]) ?? '';
      const ruta = alFormatoSpec(`${prefijo}/${m[3]}`.replace(/\/+/g, '/'));
      if (!SIN_DOCUMENTAR_POR_EXCEPCION.has(ruta)) {
        reales.add(`${m[2].toUpperCase()} ${ruta}`);
      }
    }
  }
  return reales;
}

function rutasDocumentadas() {
  const documentadas = new Set<string>();
  for (const [ruta, item] of Object.entries(spec.paths)) {
    for (const metodo of Object.keys(item)) {
      documentadas.add(`${metodo.toUpperCase()} ${ruta}`);
    }
  }
  return documentadas;
}

describe('documentación OpenAPI', () => {
  it('el spec es válido y tiene los 14 tags del backend', () => {
    expect(spec.openapi).toBe('3.0.3');
    expect(spec.paths).toBeTypeOf('object');
    expect(TAGS).toHaveLength(14);
    expect(openApiSpec.tags?.map((t) => t.name)).toEqual([...TAGS]);
  });

  it('documenta endpoints y ninguno queda sin tag', () => {
    const declarados = new Set((openApiSpec.tags ?? []).map((t) => t.name));
    const operations = Object.entries(spec.paths).flatMap(([path, item]) =>
      Object.entries(item).map(([method, op]) => ({ path, method, op: op as Operation })),
    );

    expect(operations.length).toBeGreaterThan(40);
    for (const { path, method, op } of operations) {
      expect(op.tags?.[0], `${method.toUpperCase()} ${path} sin tag`).toBeTruthy();
      expect(declarados.has(op.tags![0])).toBe(true);
      expect(op.summary, `${method.toUpperCase()} ${path} sin summary`).toBeTruthy();
      expect(op.responses, `${method.toUpperCase()} ${path} sin respuestas`).toBeTruthy();
    }
  });

  /**
   * El test de arriba solo va en un sentido: revisa que lo DOCUMENTADO esté
   * completo. Este va al revés y es el que atrapó los 11 endpoints que
   * faltaban: si se agrega una ruta y no se documenta, el build se cae.
   */
  it('toda ruta real de Express tiene su bloque @openapi', () => {
    const reales = rutasReales();
    const documentadas = rutasDocumentadas();
    const sinDocumentar = [...reales].filter((ruta) => !documentadas.has(ruta)).sort();

    expect(
      sinDocumentar,
      `Endpoints sin documentar en Swagger:\n  - ${sinDocumentar.join('\n  - ')}`,
    ).toEqual([]);

    // Y al revés: nada documentado que no exista, para no documentar fantasmas.
    const sinRuta = [...documentadas].filter((ruta) => !reales.has(ruta)).sort();
    expect(
      sinRuta,
      `Endpoints documentados que no existen en Express:\n  - ${sinRuta.join('\n  - ')}`,
    ).toEqual([]);
  });

  it('marca las rutas públicas con security: [] y las de token con el esquema correcto', () => {
    const publico = spec.paths['/auth/login']?.post;
    expect(publico?.security).toEqual([]);
    expect(spec.paths['/public/catalog']?.get?.security).toEqual([{ clientToken: [] }]);
    expect(spec.paths['/orders']?.post?.security).toEqual([{ bearerAuth: [] }]);
  });

  it('documenta los endpoints nuevos de mensajería, catálogo público y facturación', () => {
    const paths = Object.keys(spec.paths);
    for (const path of [
      '/messaging/templates',
      '/messaging/clients/{clientId}/link',
      '/messaging/clients/{clientId}/send',
      '/messaging/broadcast/today',
      '/tokens/clients/{clientId}',
      '/public/catalog',
      '/public/orders',
      '/orders/{id}/invoice',
      '/invoices',
    ]) {
      expect(paths, `falta documentar ${path}`).toContain(path);
    }
  });
});

describe('GET /api/docs', () => {
  it('sirve la UI sin pedir sesión', async () => {
    const response = await request(app).get('/api/docs/');

    expect(response.status).toBe(200);
    expect(response.text).toContain('swagger');
  });

  it('expone el spec en JSON sin pedir sesión', async () => {
    const response = await request(app).get('/api/docs.json');

    expect(response.status).toBe(200);
    expect(response.body.openapi).toBe('3.0.3');
    expect(Object.keys(response.body.paths).length).toBeGreaterThan(40);
  });
});