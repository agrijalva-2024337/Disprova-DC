import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/AppError.js';
import { writeAudit } from '../../shared/audit/writeAudit.js';
import type { CreateUserInput, UpdateUserInput } from './users.schema.js';

const BCRYPT_ROUNDS = 10;

/** Nunca sale `passwordHash` hacia la API. */
function toDto(user: {
  id: number;
  nombre: string;
  email: string;
  usuario: string | null;
  avatarUrl: string | null;
  roleId: number;
  activo: boolean;
  createdAt: Date;
  role: { id: number; nombre: string };
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
    createdAt: user.createdAt,
  };
}

const userConRol = { role: true } as const;

function rethrowPrisma(err: unknown): never {
  if (err instanceof AppError) {
    throw err;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      throw new AppError('Ya existe un registro con ese email', 409, 'CONFLICT');
    }
    if (err.code === 'P2003' || err.code === 'P2014') {
      throw new AppError('El rol no existe', 422, 'ROLE_NOT_FOUND');
    }
    if (err.code === 'P2025') {
      throw new AppError('Usuario no encontrado', 404, 'NOT_FOUND');
    }
  }
  throw err;
}

export async function listRoles() {
  return prisma.role.findMany({ orderBy: { id: 'asc' } });
}

export async function listUsers(filtros: { activo?: boolean } = {}) {
  const users = await prisma.user.findMany({
    where: { activo: filtros.activo },
    include: userConRol,
    orderBy: { id: 'asc' },
  });
  return users.map(toDto);
}

export async function getUser(id: number) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: userConRol,
  });
  if (!user) {
    throw new AppError('Usuario no encontrado', 404, 'NOT_FOUND');
  }
  return toDto(user);
}

async function requireRoleById(roleId: number) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) {
    throw new AppError('Rol no encontrado', 422, 'ROLE_NOT_FOUND');
  }
  return role;
}

export async function createUser(input: CreateUserInput, userId: number) {
  await requireRoleById(input.roleId);

  const existente = await prisma.user.findUnique({ where: { email: input.email } });
  if (existente) {
    throw new AppError('Ya existe un usuario con ese email', 409, 'CONFLICT');
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          nombre: input.nombre,
          email: input.email,
          passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
          roleId: input.roleId,
          activo: input.activo ?? true,
        },
        include: userConRol,
      });
      await writeAudit(tx, {
        userId,
        entidad: 'User',
        entidadId: String(created.id),
        accion: 'create',
        // El hash nunca va al log: no sirve para nada y filtra información.
        datosDespues: { nombre: created.nombre, email: created.email, roleId: created.roleId, activo: created.activo },
      });
      return toDto(created);
    });
  } catch (err) {
    rethrowPrisma(err);
  }
}

export async function updateUser(id: number, input: UpdateUserInput, userId: number) {
  if (input.roleId !== undefined) {
    await requireRoleById(input.roleId);
  }

  if (input.email !== undefined) {
    const conEseEmail = await prisma.user.findFirst({ where: { email: input.email, id: { not: id } } });
    if (conEseEmail) {
      throw new AppError('Ya existe otro usuario con ese email', 409, 'CONFLICT');
    }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { id }, include: userConRol });
      if (!existing) {
        throw new AppError('Usuario no encontrado', 404, 'NOT_FOUND');
      }

      const updated = await tx.user.update({
        where: { id },
        data: input,
        include: userConRol,
      });

      await writeAudit(tx, {
        userId,
        entidad: 'User',
        entidadId: String(id),
        accion: 'update',
        datosAntes: { nombre: existing.nombre, email: existing.email, roleId: existing.roleId, activo: existing.activo },
        datosDespues: { nombre: updated.nombre, email: updated.email, roleId: updated.roleId, activo: updated.activo },
      });

      return toDto(updated);
    });
  } catch (err) {
    rethrowPrisma(err);
  }
}