import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { getAging } from '../collections/collections.service.js';
import { todayDate } from '../sales/sales.service.js';

function money(value: Prisma.Decimal | string | number) {
  return new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function text(value: Prisma.Decimal) {
  return money(value).toFixed(2);
}

function todayRange() {
  const start = todayDate();
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

const UNSOLD = ['borrador', 'cancelado'] as const;

export async function salesToday() {
  const { start, end } = todayRange();
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: start, lt: end },
      estado: { notIn: [...UNSOLD] },
    },
    include: { user: true },
  });

  const bySeller = new Map<number, { userId: number; nombre: string; contado: Prisma.Decimal; credito: Prisma.Decimal }>();
  let contado = new Prisma.Decimal(0);
  let credito = new Prisma.Decimal(0);

  for (const order of orders) {
    const amount = new Prisma.Decimal(order.total);
    const row = bySeller.get(order.userId) ?? {
      userId: order.userId,
      nombre: order.user.nombre,
      contado: new Prisma.Decimal(0),
      credito: new Prisma.Decimal(0),
    };
    if (order.condicionPago === 'credito') {
      row.credito = row.credito.add(amount);
      credito = credito.add(amount);
    } else {
      row.contado = row.contado.add(amount);
      contado = contado.add(amount);
    }
    bySeller.set(order.userId, row);
  }

  return {
    total: text(contado.add(credito)),
    porCondicion: { contado: text(contado), credito: text(credito) },
    porVendedor: [...bySeller.values()]
      .map((row) => ({
        userId: row.userId,
        nombre: row.nombre,
        contado: text(row.contado),
        credito: text(row.credito),
        total: text(row.contado.add(row.credito)),
      }))
      .sort((a, b) => a.userId - b.userId),
  };
}

export async function collectionsToday() {
  const { start, end } = todayRange();
  const payments = await prisma.payment.findMany({
    where: { fecha: { gte: start, lt: end } },
    include: { user: true },
  });

  const bySeller = new Map<number, { userId: number; nombre: string; total: Prisma.Decimal }>();
  let total = new Prisma.Decimal(0);
  for (const payment of payments) {
    const amount = new Prisma.Decimal(payment.monto);
    const row = bySeller.get(payment.userId) ?? {
      userId: payment.userId,
      nombre: payment.user.nombre,
      total: new Prisma.Decimal(0),
    };
    row.total = row.total.add(amount);
    total = total.add(amount);
    bySeller.set(payment.userId, row);
  }

  return {
    total: text(total),
    porVendedor: [...bySeller.values()]
      .map((row) => ({ userId: row.userId, nombre: row.nombre, total: text(row.total) }))
      .sort((a, b) => a.userId - b.userId),
  };
}

function ageRank(buckets: { '60+': Prisma.Decimal; '31-60': Prisma.Decimal; '16-30': Prisma.Decimal; '0-15': Prisma.Decimal }) {
  if (buckets['60+'].greaterThan(0)) return 4;
  if (buckets['31-60'].greaterThan(0)) return 3;
  if (buckets['16-30'].greaterThan(0)) return 2;
  if (buckets['0-15'].greaterThan(0)) return 1;
  return 0;
}

export async function agingReport() {
  const clients = await prisma.client.findMany({
    include: {
      accountMovements: { orderBy: [{ fecha: 'desc' }, { id: 'desc' }], take: 1 },
    },
  });

  const rows = [];
  for (const client of clients) {
    const saldo = new Prisma.Decimal(client.accountMovements[0]?.saldoResultante ?? 0);
    if (!saldo.greaterThan(0)) {
      continue;
    }
    const aging = await getAging(client.id);
    rows.push({
      clientId: client.id,
      nombre: client.nombreComercial,
      saldoActual: text(new Prisma.Decimal(aging.saldoActual.toString())),
      buckets: {
        '0-15': text(new Prisma.Decimal(aging.buckets['0-15'].toString())),
        '16-30': text(new Prisma.Decimal(aging.buckets['16-30'].toString())),
        '31-60': text(new Prisma.Decimal(aging.buckets['31-60'].toString())),
        '60+': text(new Prisma.Decimal(aging.buckets['60+'].toString())),
      },
      rank: ageRank(aging.buckets),
    });
  }

  rows.sort((a, b) => b.rank - a.rank || Number(b.saldoActual) - Number(a.saldoActual));
  return rows.map(({ rank: _rank, ...row }) => row);
}
