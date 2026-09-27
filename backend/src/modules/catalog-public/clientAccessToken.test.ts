import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
  DEFAULT_TOKEN_TTL_DAYS,
  TOKEN_BYTES,
  generateClientAccessToken,
  isTokenExpired,
  tokenExpiry,
} from './clientAccessToken.js';

describe('generateClientAccessToken', () => {
  it('devuelve 128 bits en base64url (22 chars, sin + / ni =)', () => {
    const token = generateClientAccessToken();

    expect(token).toHaveLength(22);
    expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(Buffer.from(token, 'base64url')).toHaveLength(TOKEN_BYTES);
  });

  it('no repite entre llamadas consecutivas', () => {
    const tokens = Array.from({ length: 200 }, () => generateClientAccessToken());

    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it('no es derivable: dos clientes seguidos no comparten prefijo ni patron', () => {
    const a = generateClientAccessToken();
    const b = generateClientAccessToken();

    expect(a).not.toBe(b);
    // Si fuera un contador o un id, cambiarian de forma predecible.
    expect(Number.isNaN(Number(a))).toBe(true);
    expect(a.slice(0, 4)).not.toBe(b.slice(0, 4));
  });

  it('produce una entropia comparable a la de randomBytes', () => {
    const token = generateClientAccessToken();
    const referencia = randomBytes(TOKEN_BYTES).toString('base64url');

    expect(token).toHaveLength(referencia.length);
  });
});

describe('tokenExpiry', () => {
  it('suma la vigencia por defecto en dias', () => {
    const desde = new Date('2026-09-26T10:00:00.000Z');
    const expira = tokenExpiry(desde);

    expect(expira.getTime() - desde.getTime()).toBe(DEFAULT_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  });
});

describe('isTokenExpired', () => {
  it('es falso mientras la vigencia sigue y verdadero en el instante de vencimiento', () => {
    const ahora = new Date('2026-09-26T10:00:00.000Z');

    // Vence en un mes: sigue vigente.
    expect(isTokenExpired(new Date('2026-10-26T10:00:00.000Z'), ahora)).toBe(false);
    // Venció hace un segundo: ya no sirve.
    expect(isTokenExpired(new Date('2026-09-26T09:59:59.000Z'), ahora)).toBe(true);
    // Justo en el instante de vencimiento: ya no sirve.
    expect(isTokenExpired(new Date('2026-09-26T10:00:00.000Z'), ahora)).toBe(true);
    // Venció hace días.
    expect(isTokenExpired(new Date('2026-09-20T10:00:00.000Z'), ahora)).toBe(true);
  });
});