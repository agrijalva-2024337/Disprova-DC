import { randomBytes } from 'node:crypto';

/** 128 bits de entropía. */
export const TOKEN_BYTES = 16;

/** Vigencia por defecto de un enlace de catálogo: 30 días. */
export const DEFAULT_TOKEN_TTL_DAYS = 30;

/**
 * Token opaco para el catálogo web de un cliente puntual.
 *
 * Son 128 bits de `randomBytes` en base64url: 22 caracteres, alfabeto
 * `A-Za-z0-9-_` sin `+`, `/` ni `=`. Nunca un id secuencial ni nada
 * derivable de otro dato, porque el enlace se comparte por WhatsApp y
 * adivinarlo expondría el catálogo y los precios de ese cliente.
 */
export function generateClientAccessToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export function tokenExpiry(from = new Date()): Date {
  const expiresAt = new Date(from);
  expiresAt.setDate(expiresAt.getDate() + DEFAULT_TOKEN_TTL_DAYS);
  return expiresAt;
}

export function isTokenExpired(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}