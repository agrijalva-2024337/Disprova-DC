import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/AppError.js';
import type { CloseCashSessionInput, OpenCashSessionInput } from './cash.schema.js';

function money(value: Prisma.Decimal | string | number) {
  return new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function todayDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

async function isAdmin(roleId: number) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  return role?.nombre === 'admin';
}

export async function openSession(input: OpenCashSessionInput, userId: number) {
  const open = await prisma.cashSession.findFirst({
    where: { userId, estado: 'abierta' },
  });
  if (open) {
    throw new AppError('Ya hay una caja abierta para este usuario', 409, 'CASH_SESSION_OPEN');
  }

  return prisma.cashSession.create({
    data: {
      userId,
      fecha: todayDate(),
      fondoInicial: money(input.fondoInicial),
      totalCobrado: money(0),
      totalGastos: money(0),
      estado: 'abierta',
    },
  });
}

export async function getCurrentSession(userId: number) {
  const session = await prisma.cashSession.findFirst({
    where: { userId, estado: 'abierta' },
    orderBy: { id: 'desc' },
  });
  if (!session) {
    throw new AppError('No hay una caja abierta', 404, 'NOT_FOUND');
  }
  return session;
}

export async function closeSession(sessionId: number, input: CloseCashSessionInput, userId: number, roleId: number) {
  const session = await prisma.cashSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    throw new AppError('Sesión de caja no encontrada', 404, 'NOT_FOUND');
  }
  if (session.estado === 'cerrada') {
    throw new AppError('La caja ya está cerrada', 409, 'CASH_SESSION_CLOSED');
  }

  const admin = await isAdmin(roleId);
  if (session.userId !== userId && !admin) {
    throw new AppError('No autorizado para cerrar esta caja', 403, 'FORBIDDEN');
  }

  const conteoFinal = money(input.conteoFinal);
  const esperado = money(session.fondoInicial.plus(session.totalCobrado).minus(session.totalGastos));
  const diferencia = money(conteoFinal.minus(esperado));

  return prisma.cashSession.update({
    where: { id: session.id },
    data: {
      conteoFinal,
      diferencia,
      estado: 'cerrada',
      cerradaAt: new Date(),
    },
  });
}

export async function listSessions(filters: { userId?: number; desde?: Date; hasta?: Date }) {
  return prisma.cashSession.findMany({
    where: {
      userId: filters.userId,
      fecha:
        filters.desde || filters.hasta
          ? {
              gte: filters.desde,
              lte: filters.hasta,
            }
          : undefined,
    },
    orderBy: { id: 'desc' },
  });
}
