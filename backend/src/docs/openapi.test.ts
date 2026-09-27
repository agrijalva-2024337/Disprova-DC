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

describe('documentación OpenAPI', () => {
  it('el spec es válido y tiene los 13 tags del backend', () => {
    expect(spec.openapi).toBe('3.0.3');
    expect(spec.paths).toBeTypeOf('object');
    expect(TAGS).toHaveLength(13);
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