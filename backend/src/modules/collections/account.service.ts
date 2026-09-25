import { Prisma, type TipoMovimientoCuenta } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError.js';

/**
 * ÚNICA puerta de escritura de la tabla `account_movements` en todo el sistema.
 *
 * Ningún otro código debe llamar prisma.accountMovement.create(), update() ni
 * upsert(). El saldoResultante se calcula aquí, al insertar el movimiento, y
 * no se vuelve a recalcular después. Un cargo suma al saldo anterior; un abono
 * lo resta.
 */

type Tx = Prisma.TransactionClient;

export type PostMovementInput = {
  clientId: number;
  tipo: TipoMovimientoCuenta;
  referenciaTipo: string;
  referenciaId: string;
  monto: Prisma.Decimal | string | number;
  fecha: Date;
  userId: number;
};

function money(value: Prisma.Decimal | string | number) {
  return new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export async function postMovement(tx: Tx, input: PostMovementInput) {
  const monto = money(input.monto);
  if (monto.lessThanOrEqualTo(0)) {
    throw new AppError('El monto del movimiento debe ser mayor a cero', 422, 'INVALID_AMOUNT');
  }

  await tx.$queryRaw`SELECT id FROM clients WHERE id = ${input.clientId} FOR UPDATE`;
  const previous = await tx.accountMovement.findFirst({
    where: { clientId: input.clientId },
    orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
  });
  const saldoAnterior = previous ? new Prisma.Decimal(previous.saldoResultante) : new Prisma.Decimal(0);
  const saldoResultante = money(input.tipo === 'cargo' ? saldoAnterior.add(monto) : saldoAnterior.sub(monto));

  return tx.accountMovement.create({
    data: {
      clientId: input.clientId,
      tipo: input.tipo,
      referenciaTipo: input.referenciaTipo,
      referenciaId: input.referenciaId,
      monto,
      saldoResultante,
      fecha: input.fecha,
    },
  });
}
