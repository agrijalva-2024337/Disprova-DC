import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/AppError.js';

const ACCESS_EXPIRES = '15m';
const REFRESH_EXPIRES = '7d';

type TokenPayload = {
  sub: string;
  roleId: number;
  type: 'access' | 'refresh';
};

function signTokens(userId: number, roleId: number) {
  const accessToken = jwt.sign(
    { roleId, type: 'access' } satisfies Omit<TokenPayload, 'sub'>,
    env.jwt.accessSecret,
    { subject: String(userId), expiresIn: ACCESS_EXPIRES },
  );

  const refreshToken = jwt.sign(
    { roleId, type: 'refresh' } satisfies Omit<TokenPayload, 'sub'>,
    env.jwt.refreshSecret,
    { subject: String(userId), expiresIn: REFRESH_EXPIRES },
  );

  return { accessToken, refreshToken };
}

function invalidCredentials(): never {
  throw new AppError('Credenciales inválidas', 401, 'INVALID_CREDENTIALS');
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.activo) {
    invalidCredentials();
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) {
    invalidCredentials();
  }

  const tokens = signTokens(user.id, user.roleId);

  return {
    ...tokens,
    user: {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      roleId: user.roleId,
      activo: user.activo,
    },
  };
}

export async function refresh(refreshToken: string) {
  let payload: TokenPayload;
  try {
    payload = jwt.verify(refreshToken, env.jwt.refreshSecret) as TokenPayload;
  } catch {
    throw new AppError('Token inválido', 401, 'UNAUTHORIZED');
  }

  if (payload.type !== 'refresh' || !payload.sub) {
    throw new AppError('Token inválido', 401, 'UNAUTHORIZED');
  }

  const userId = Number(payload.sub);
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user || !user.activo) {
    throw new AppError('Token inválido', 401, 'UNAUTHORIZED');
  }

  return signTokens(user.id, user.roleId);
}
