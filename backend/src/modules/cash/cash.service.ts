import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/AppError.js';
import { writeAudit } from '../../shared/audit/writeAudit.js';
import type { CloseCashSessionInput, CreateExpenseInput, OpenCashSessionInput } from './cash.schema.js';

type Tx = Prisma.TransactionClient;

function money(value: Prisma.Decimal | string | number) {
  return new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function todayDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

async function isAdmin(tx: Tx, roleId: number) {
  const role = await tx.role.findUnique({ where: { id: roleId } });
  return role?.nombre === 'admin';
}

/** Bloquea la caja para que dos cierres simultáneos no se pisen. */
async function lockSession(tx: Tx, sessionId: number) {
  await tx.$queryRaw`SELECT id FROM cash_sessions WHERE id = ${sessionId} FOR UPDATE`;
}

export async function openSession(input: OpenCashSessionInput, userId: number) {
  return prisma.$transaction(async (tx) => {
    const open = await tx.cashSession.findFirst({
      where: { userId, estado: 'abierta' },
    });
    if (open) {
      throw new AppError('Ya hay una caja abierta para este usuario', 409, 'CASH_SESSION_OPEN');
    }

    const created = await tx.cashSession.create({
      data: {
        userId,
        fecha: todayDate(),
        fondoInicial: money(input.fondoInicial),
        totalCobrado: money(0),
        totalGastos: money(0),
        estado: 'abierta',
      },
    });

    await writeAudit(tx, {
      userId,
      entidad: 'CashSession',
      entidadId: String(created.id),
      accion: 'open',
      datosDespues: {
        fecha: created.fecha.toISOString(),
        estado: created.estado,
        fondoInicial: money(created.fondoInicial).toFixed(2),
      },
    });

    return created;
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
  return prisma.$transaction(async (tx) => {
    await lockSession(tx, sessionId);
    const session = await tx.cashSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new AppError('Sesión de caja no encontrada', 404, 'NOT_FOUND');
    }
    if (session.estado === 'cerrada') {
      throw new AppError('La caja ya está cerrada', 409, 'CASH_SESSION_CLOSED');
    }

    const admin = await isAdmin(tx, roleId);
    if (session.userId !== userId && !admin) {
      throw new AppError('No autorizado para cerrar esta caja', 403, 'FORBIDDEN');
    }

    const conteoFinal = money(input.conteoFinal);
    const esperado = money(session.fondoInicial.plus(session.totalCobrado).minus(session.totalGastos));
    const diferencia = money(conteoFinal.minus(esperado));

    const updated = await tx.cashSession.update({
      where: { id: session.id },
      data: {
        conteoFinal,
        diferencia,
        estado: 'cerrada',
        cerradaAt: new Date(),
      },
    });

    // El esperado y la diferencia se dejan en el log: es el número con el que
    // se justifica un descuadre de caja delante de una auditoría.
    await writeAudit(tx, {
      userId,
      entidad: 'CashSession',
      entidadId: String(session.id),
      accion: 'close',
      datosAntes: {
        estado: session.estado,
        fondoInicial: money(session.fondoInicial).toFixed(2),
        totalCobrado: money(session.totalCobrado).toFixed(2),
        totalGastos: money(session.totalGastos).toFixed(2),
        esperado: esperado.toFixed(2),
      },
      datosDespues: {
        estado: updated.estado,
        conteoFinal: conteoFinal.toFixed(2),
        diferencia: diferencia.toFixed(2),
        cerradaAt: updated.cerradaAt ? updated.cerradaAt.toISOString() : null,
      },
    });

    return updated;
  });
}

/**
 * Registra un gasto de la jornada y lo suma a `total_gastos` de la sesión.
 *
 * La columna existía y se usaba en el arqueo, pero nada la escribía: sin esta
 * función, cualquier gasto real (combustible, viáticos) descuadraba la caja y
 * el sistema no tenía forma de explicarlo.
 *
 * El gasto se descuenta del efectivo esperado al cerrar, y ambos cambios van
 * en la misma transacción: o queda el gasto registrado y el total actualizado,
 * o no queda nada. Un gasto sobre una caja ya cerrada se rechaza, porque
 * tocaría el arqueo que ya se firmó.
 */
export async function createExpense(input: CreateExpenseInput, userId: number) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.cashSession.findFirst({
      where: { userId, estado: 'abierta' },
      orderBy: { id: 'desc' },
    });
    if (!session) {
      throw new AppError('No hay una caja abierta para registrar el gasto', 409, 'CASH_SESSION_REQUIRED');
    }

    const monto = money(input.monto);
    const expense = await tx.cashExpense.create({
      data: {
        cashSessionId: session.id,
        userId,
        concepto: input.concepto,
        monto,
        reciboUrl: input.reciboUrl ?? null,
      },
    });

    await tx.cashSession.update({
      where: { id: session.id },
      data: { totalGastos: { increment: monto } },
    });

    await writeAudit(tx, {
      userId,
      entidad: 'CashExpense',
      entidadId: String(expense.id),
      accion: 'create',
      datosDespues: {
        cashSessionId: session.id,
        concepto: expense.concepto,
        monto: money(expense.monto).toFixed(2),
        reciboUrl: expense.reciboUrl,
      },
    });

    return expense;
  });
}

export async function listExpenses(sessionId: number) {
  return prisma.cashExpense.findMany({
    where: { cashSessionId: sessionId },
    orderBy: { id: 'asc' },
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
