import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/AppError.js';
import { postMovement } from './account.service.js';
import type { ApplyPaymentInput, CreateCollectionVisitInput, CreatePaymentInput } from './collections.schema.js';

function money(value: Prisma.Decimal | string | number) {
  return new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function daysBetween(from: Date, to: Date) {
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.floor((end - start) / 86_400_000);
}

export async function createPayment(input: CreatePaymentInput, userId: number) {
  const client = await prisma.client.findUnique({ where: { id: input.clientId } });
  if (!client) {
    throw new AppError('Cliente no encontrado', 404, 'NOT_FOUND');
  }

  return prisma.$transaction(async (tx) => {
    let cashSessionId: number | null = null;
    if (input.metodo === 'efectivo') {
      const session = await tx.cashSession.findFirst({
        where: { userId, estado: 'abierta' },
        orderBy: { id: 'desc' },
      });
      if (!session) {
        throw new AppError(
          'No hay una caja abierta para registrar un pago en efectivo',
          409,
          'CASH_SESSION_REQUIRED',
        );
      }
      cashSessionId = session.id;
      await tx.cashSession.update({
        where: { id: session.id },
        data: { totalCobrado: { increment: money(input.monto) } },
      });
    }

    const payment = await tx.payment.create({
      data: {
        clientId: input.clientId,
        userId,
        fecha: new Date(),
        monto: money(input.monto),
        metodo: input.metodo,
        referencia: input.referencia ?? null,
        cashSessionId,
      },
    });

    await postMovement(tx, {
      clientId: input.clientId,
      tipo: 'abono',
      referenciaTipo: 'payment',
      referenciaId: String(payment.id),
      monto: payment.monto,
      fecha: payment.fecha,
      userId,
    });

    return payment;
  });
}

export async function applyPayment(paymentId: number, input: ApplyPaymentInput) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { applications: true },
    });
    if (!payment) {
      throw new AppError('Pago no encontrado', 404, 'NOT_FOUND');
    }

    const yaAplicado = payment.applications.reduce(
      (sum, row) => sum.add(row.montoAplicado),
      new Prisma.Decimal(0),
    );
    const solicitado = input.applications.reduce(
      (sum, row) => sum.add(money(row.monto)),
      new Prisma.Decimal(0),
    );
    const pendiente = money(new Prisma.Decimal(payment.monto).sub(yaAplicado));
    if (money(solicitado).greaterThan(pendiente)) {
      throw new AppError(
        `El pago no alcanza: pendiente ${pendiente.toFixed(2)}, se intentó aplicar ${money(solicitado).toFixed(2)}`,
        409,
        'APPLICATION_EXCEEDS_PAYMENT',
      );
    }

    for (const row of input.applications) {
      const order = await tx.order.findUnique({ where: { id: row.orderId } });
      if (!order || order.clientId !== payment.clientId) {
        throw new AppError('El pedido no pertenece al cliente del pago', 422, 'INVALID_ORDER');
      }
    }

    await tx.paymentApplication.createMany({
      data: input.applications.map((row) => ({
        paymentId: payment.id,
        orderId: row.orderId,
        montoAplicado: money(row.monto),
      })),
    });

    return tx.payment.findUniqueOrThrow({
      where: { id: payment.id },
      include: { applications: true },
    });
  });
}

export async function getAccount(clientId: number) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) {
    throw new AppError('Cliente no encontrado', 404, 'NOT_FOUND');
  }
  const movements = await prisma.accountMovement.findMany({
    where: { clientId },
    orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
  });
  const last = movements[movements.length - 1];
  return {
    saldoActual: last ? last.saldoResultante : new Prisma.Decimal(0),
    movements,
  };
}

export async function getAging(clientId: number) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) {
    throw new AppError('Cliente no encontrado', 404, 'NOT_FOUND');
  }

  const movements = await prisma.accountMovement.findMany({
    where: { clientId },
    orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
  });
  const cargos = movements.filter((row) => row.tipo === 'cargo');
  let abonos = movements
    .filter((row) => row.tipo === 'abono')
    .reduce((sum, row) => sum.add(row.monto), new Prisma.Decimal(0));

  const buckets = {
    '0-15': new Prisma.Decimal(0),
    '16-30': new Prisma.Decimal(0),
    '31-60': new Prisma.Decimal(0),
    '60+': new Prisma.Decimal(0),
  };
  const today = new Date();

  for (const cargo of cargos) {
    let pendiente = new Prisma.Decimal(cargo.monto);
    if (abonos.greaterThan(0)) {
      const cubierto = Prisma.Decimal.min(abonos, pendiente);
      pendiente = pendiente.sub(cubierto);
      abonos = abonos.sub(cubierto);
    }
    if (pendiente.lessThanOrEqualTo(0)) {
      continue;
    }
    const daysPastDue = daysBetween(cargo.fecha, today) - client.plazoDias;
    if (daysPastDue < 0) {
      continue;
    }
    const key = daysPastDue <= 15 ? '0-15' : daysPastDue <= 30 ? '16-30' : daysPastDue <= 60 ? '31-60' : '60+';
    buckets[key] = money(buckets[key].add(pendiente));
  }

  const last = movements[movements.length - 1];
  return {
    saldoActual: last ? last.saldoResultante : new Prisma.Decimal(0),
    buckets,
  };
}

export async function createCollectionVisit(input: CreateCollectionVisitInput, userId: number) {
  const client = await prisma.client.findUnique({ where: { id: input.clientId } });
  if (!client) {
    throw new AppError('Cliente no encontrado', 404, 'NOT_FOUND');
  }
  return prisma.collectionVisit.create({
    data: {
      clientId: input.clientId,
      userId,
      fecha: new Date(),
      resultado: input.resultado,
      montoComprometido: input.montoComprometido == null ? null : money(input.montoComprometido),
      fechaCompromiso: input.fechaCompromiso ?? null,
      observaciones: input.observaciones ?? null,
    },
  });
}
