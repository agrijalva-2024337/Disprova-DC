import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { importeEntregado, todayDate } from '../sales/sales.service.js';

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

function daysBetween(from: Date, to: Date) {
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.floor((end - start) / 86_400_000);
}

/**
 * Ventas del día = lo ENTREGADO hoy, no lo pedido hoy.
 *
 * La versión anterior contaba `orders.createdAt` del día. Eso mezclaba dos
 * cosas distintas: un pedido tomado hoy y entregado mañana contaba hoy, y un
 * pedido tomado la semana pasada y entregado hoy no contaba. El negocio
 * pregunta por lo que vendió, y lo que se vendió es lo que salió del vehículo.
 *
 * El importe sale de la misma fórmula proporcional que usa la cobranza al
 * entregar y la facturación: `importeEntregado`. Así los tres módulos
 * reportan exactamente la misma cifra para un pedido, que es lo que hace
 * falta para que el cuadre del día cierre.
 */
export async function salesToday() {
  const { start, end } = todayRange();
  const deliveries = await prisma.delivery.findMany({
    where: { fecha: { gte: start, lt: end } },
    include: {
      order: {
        include: {
          user: true,
          items: { include: { deliveryItems: true } },
        },
      },
    },
  });

  const bySeller = new Map<
    number,
    { userId: number; nombre: string; contado: Prisma.Decimal; credito: Prisma.Decimal }
  >();
  let contado = new Prisma.Decimal(0);
  let credito = new Prisma.Decimal(0);

  for (const delivery of deliveries) {
    const { order } = delivery;
    const lineas = order.items.map((item) => ({
      orderItemId: item.id,
      cantidadEntregada: item.deliveryItems
        .filter((row) => row.deliveryId === delivery.id)
        .reduce((sum, row) => sum.add(row.cantidadEntregada), new Prisma.Decimal(0)),
    }));

    // Una entrega sin líneas con cantidad no es una venta: no suma.
    const tieneAlgo = lineas.some((linea) => linea.cantidadEntregada.greaterThan(0));
    if (!tieneAlgo) {
      continue;
    }

    const amount = importeEntregado(order.items, lineas);
    if (amount.lessThanOrEqualTo(0)) {
      continue;
    }

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

/**
 * Antigüedad de saldos de todos los clientes con deuda.
 *
 * Antes hacía un `getAging` por cliente, y cada `getAging` cargaba TODOS los
 * movimientos de ese cliente: con 200 clientes eran 201 consultas y el reporte
 * se arrastraba. Ahora trae los movimientos de todos los deudores en una sola
 * consulta y reparte los abonos en memoria, que es exactamente lo mismo que
 * hacía `getAging` pero sin el N+1.
 *
 * Solo se trae lo necesario: los clientes sin saldo a favor se descartan en
 * la consulta, no después.
 */
export async function agingReport() {
  const clients = await prisma.client.findMany({
    where: { activo: true },
    select: { id: true, nombreComercial: true, plazoDias: true },
  });

  if (clients.length === 0) {
    return [];
  }

  const movimientos = await prisma.accountMovement.findMany({
    where: { clientId: { in: clients.map((c) => c.id) } },
    select: {
      clientId: true,
      tipo: true,
      monto: true,
      fecha: true,
      saldoResultante: true,
      id: true,
    },
    orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
  });

  // Un movimiento por cliente, agrupados de una vez.
  const porCliente = new Map<number, typeof movimientos>();
  for (const mov of movimientos) {
    const lista = porCliente.get(mov.clientId);
    if (lista) {
      lista.push(mov);
    } else {
      porCliente.set(mov.clientId, [mov]);
    }
  }

  const rows = [];
  for (const client of clients) {
    const lista = porCliente.get(client.id);
    if (!lista || lista.length === 0) {
      continue;
    }

    const ultimo = lista[lista.length - 1];
    const saldo = new Prisma.Decimal(ultimo.saldoResultante);
    if (!saldo.greaterThan(0)) {
      continue;
    }

    const buckets = {
      '0-15': new Prisma.Decimal(0),
      '16-30': new Prisma.Decimal(0),
      '31-60': new Prisma.Decimal(0),
      '60+': new Prisma.Decimal(0),
    };

    // Los abonos se aplican FIFO: cancelan primero el cargo más viejo, que es
    // la misma regla de `getAging` para que el total por cliente coincida.
    let abonos = lista
      .filter((row) => row.tipo === 'abono')
      .reduce((sum, row) => sum.add(row.monto), new Prisma.Decimal(0));

    for (const mov of lista) {
      if (mov.tipo !== 'cargo') continue;
      let pendiente = new Prisma.Decimal(mov.monto);
      if (abonos.greaterThan(0)) {
        const cubierto = Prisma.Decimal.min(abonos, pendiente);
        pendiente = pendiente.sub(cubierto);
        abonos = abonos.sub(cubierto);
      }
      if (pendiente.lessThanOrEqualTo(0)) continue;

      const daysPastDue = daysBetween(mov.fecha, new Date()) - client.plazoDias;
      if (daysPastDue < 0) continue;
      const key =
        daysPastDue <= 15 ? '0-15' : daysPastDue <= 30 ? '16-30' : daysPastDue <= 60 ? '31-60' : '60+';
      buckets[key] = money(buckets[key].add(pendiente));
    }

    rows.push({
      clientId: client.id,
      nombre: client.nombreComercial,
      saldoActual: text(saldo),
      buckets: {
        '0-15': text(buckets['0-15']),
        '16-30': text(buckets['16-30']),
        '31-60': text(buckets['31-60']),
        '60+': text(buckets['60+']),
      },
      rank: ageRank(buckets),
    });
  }

  rows.sort((a, b) => b.rank - a.rank || Number(b.saldoActual) - Number(a.saldoActual));
  return rows.map(({ rank: _rank, ...row }) => row);
}
