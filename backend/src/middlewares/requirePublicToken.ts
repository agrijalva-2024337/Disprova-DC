import type { RequestHandler } from 'express';
import { prisma } from '../config/prisma.js';
import { AppError } from '../shared/errors/AppError.js';
import { isTokenExpired } from '../modules/catalog-public/clientAccessToken.js';

/**
 * Autoriza el catálogo público con un token de cliente.
 *
 * NO es `requireAuth`: estos endpoints son deliberadamente públicos y no
 * aceptan JWT. El token no lleva rol ni permisos: solo habilita ver el
 * catálogo con la lista de precios de ESE cliente y crear pedidos a su
 * nombre. Por eso no se agrega a `req.user` sino a `req.publicClient`.
 *
 * Acepta el token en el header `X-Client-Token` o en el query param
 * `token`, para que el frontend pueda mandar un <img>/enlace directo.
 */
export const requirePublicToken: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers['x-client-token'];
    const desdeHeader = Array.isArray(header) ? header[0] : header;
    const desdeQuery = typeof req.query.token === 'string' ? req.query.token : undefined;
    const token = (desdeHeader ?? desdeQuery ?? '').trim();

    if (!token) {
      throw new AppError(
        'Falta el token de acceso: mandalo en el header X-Client-Token o en el parametro token',
        401,
        'PUBLIC_TOKEN_MISSING',
      );
    }

    const record = await prisma.clientAccessToken.findUnique({
      where: { token },
      include: { client: true },
    });

    if (!record) {
      throw new AppError('Token de acceso inválido', 401, 'PUBLIC_TOKEN_INVALID');
    }

    if (isTokenExpired(record.expiresAt)) {
      throw new AppError('El token de acceso venció', 401, 'PUBLIC_TOKEN_EXPIRED');
    }

    if (!record.client.activo) {
      throw new AppError('El cliente del token está inactivo', 401, 'PUBLIC_TOKEN_INVALID');
    }

    if (!record.client.priceListId) {
      throw new AppError('El cliente no tiene lista de precios', 422, 'NO_PRICE_LIST');
    }

    req.publicClient = {
      id: record.client.id,
      priceListId: record.client.priceListId,
      nombreComercial: record.client.nombreComercial,
    };
    next();
  } catch (err) {
    next(err);
  }
};