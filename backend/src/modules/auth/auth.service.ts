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

function toPublicUser(user: {
  id: number;
  nombre: string;
  email: string;
  usuario: string | null;
  avatarUrl: string | null;
  roleId: number;
  activo: boolean;
  role: { nombre: string };
}) {
  return {
    id: user.id,
    nombre: user.nombre,
    email: user.email,
    usuario: user.usuario,
    avatarUrl: user.avatarUrl,
    roleId: user.roleId,
    rol: user.role.nombre,
    activo: user.activo,
  };
}

export async function login(identificador: { email?: string; usuario?: string }, password: string) {
  const email = identificador.email?.trim();
  const usuario = identificador.usuario?.trim();
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        ...(email ? [{ email }] : []),
        ...(usuario ? [{ usuario: { equals: usuario, mode: 'insensitive' as const } }] : []),
      ],
    },
    include: { role: true },
  });

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
    user: toPublicUser(user),
  };
}

export async function getMe(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
  if (!user || !user.activo) {
    throw new AppError('No autenticado', 401, 'UNAUTHORIZED');
  }
  return toPublicUser(user);
}

export async function updateMe(
  userId: number,
  input: { nombre?: string; usuario?: string; avatarUrl?: string | null },
) {
  if (input.usuario) {
    const taken = await prisma.user.findFirst({
      where: {
        usuario: { equals: input.usuario, mode: 'insensitive' },
        NOT: { id: userId },
      },
    });
    if (taken) {
      throw new AppError('Ese usuario ya existe', 409, 'USERNAME_TAKEN');
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.nombre !== undefined ? { nombre: input.nombre } : {}),
      ...(input.usuario !== undefined ? { usuario: input.usuario.toLowerCase() } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
    },
    include: { role: true },
  });

  return toPublicUser(user);
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
