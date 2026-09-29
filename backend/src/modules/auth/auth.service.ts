import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/AppError.js';

const ACCESS_EXPIRES = '15m';
const REFRESH_EXPIRES = '7d';
const REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

type TokenPayload = {
  sub?: string;
  roleId: number;
  type: 'access' | 'refresh';
  jti?: string;
};

function unauthorized(): never {
  throw new AppError('Token inválido', 401, 'UNAUTHORIZED');
}

function signAccess(userId: number, roleId: number) {
  return jwt.sign({ roleId, type: 'access' } satisfies Omit<TokenPayload, 'sub'>, env.jwt.accessSecret, {
    subject: String(userId),
    expiresIn: ACCESS_EXPIRES,
  });
}

function signRefresh(userId: number, roleId: number, jti: string) {
  return jwt.sign({ roleId, type: 'refresh', jti }, env.jwt.refreshSecret, {
    subject: String(userId),
    expiresIn: REFRESH_EXPIRES,
  });
}

function refreshExpiresAt() {
  return new Date(Date.now() + REFRESH_MS);
}

async function issueTokens(userId: number, roleId: number) {
  const jti = crypto.randomUUID();
  await prisma.refreshSession.create({
    data: { userId, jti, expiresAt: refreshExpiresAt() },
  });
  return {
    accessToken: signAccess(userId, roleId),
    refreshToken: signRefresh(userId, roleId, jti),
  };
}

function readRefresh(refreshToken: string): { userId: number; roleId: number; jti: string } {
  let payload: TokenPayload;
  try {
    payload = jwt.verify(refreshToken, env.jwt.refreshSecret) as TokenPayload;
  } catch {
    unauthorized();
  }

  const userId = Number(payload.sub);
  if (payload.type !== 'refresh' || !payload.jti || !Number.isInteger(userId) || userId <= 0) {
    unauthorized();
  }

  return { userId, roleId: payload.roleId, jti: payload.jti };
}

async function revokeActiveSessions(userId: number) {
  await prisma.refreshSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

function invalidCredentials(): never {
  throw new AppError('Credenciales inválidas', 401, 'INVALID_CREDENTIALS');
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email }, include: { role: true } });

  if (!user || !user.activo) {
    invalidCredentials();
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) {
    invalidCredentials();
  }

  const tokens = await issueTokens(user.id, user.roleId);

  return {
    ...tokens,
    user: {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      roleId: user.roleId,
      rol: user.role.nombre,
      activo: user.activo,
    },
  };
}

export async function refresh(refreshToken: string) {
  const { userId, roleId, jti } = readRefresh(refreshToken);
  const session = await prisma.refreshSession.findUnique({ where: { jti } });

  if (!session || session.userId !== userId) {
    unauthorized();
  }

  if (session.revokedAt) {
    await revokeActiveSessions(session.userId);
    unauthorized();
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    unauthorized();
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.activo) {
    unauthorized();
  }

  const jtiNuevo = crypto.randomUUID();
  const rotated = await prisma.$transaction(async (tx) => {
    const consumed = await tx.refreshSession.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (consumed.count !== 1) {
      return false;
    }
    await tx.refreshSession.create({
      data: { userId, jti: jtiNuevo, expiresAt: refreshExpiresAt() },
    });
    return true;
  });

  if (!rotated) {
    await revokeActiveSessions(userId);
    unauthorized();
  }

  return {
    accessToken: signAccess(userId, roleId),
    refreshToken: signRefresh(userId, roleId, jtiNuevo),
  };
}

export async function logout(refreshToken: string) {
  let payload: TokenPayload;
  try {
    payload = jwt.verify(refreshToken, env.jwt.refreshSecret) as TokenPayload;
  } catch {
    return;
  }

  if (payload.type !== 'refresh' || !payload.jti) {
    return;
  }

  await prisma.refreshSession.updateMany({
    where: { jti: payload.jti, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
