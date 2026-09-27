import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../app.js';
import { prisma } from '../../config/prisma.js';
import { postMovement } from '../collections/account.service.js';

async function loginAsAdmin() {
  const response = await request(app).post('/api/auth/login').send({
    email: 'admin@disprova.local',
    password: 'Admin123!',
  });
  expect(response.status).toBe(200);
  return { token: response.body.accessToken as string, userId: response.body.user.id as number };
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

let contador = 0;
function nombreUnico(prefijo: string) {
  // Math.random() y no Date.now(): en los tests con fake timers la fecha
  // queda congelada y el nombre se repetiría entre corridas, chocar con el
  // índice único de message_templates y devolver 409.
  contador += 1;
  return `${prefijo}-${Math.floor(Math.random() * 1e9)}-${contador}`;
}

/**
 * Estos tests corren contra la base compartida, asi que hay que borrar lo que
 * crean: si quedan clientes de prueba en una zona, los tests de
 * sales-territory y reports que cuentan clientes dejan de pasar.
 */
const creados = { clients: [] as number[], templates: [] as number[] };

async function limpiar() {
  const { clients, templates } = creados;
  creados.clients = [];
  creados.templates = [];

  if (clients.length > 0) {
    await prisma.messageLog.deleteMany({ where: { clientId: { in: clients } } });
    await prisma.accountMovement.deleteMany({ where: { clientId: { in: clients } } });
    await prisma.clientContact.deleteMany({ where: { clientId: { in: clients } } });
    await prisma.client.deleteMany({ where: { id: { in: clients } } });
  }
  if (templates.length > 0) {
    await prisma.messageTemplate.deleteMany({ where: { id: { in: templates } } });
  }
}

async function crearTemplate(token: string, cuerpo: string) {
  const response = await request(app)
    .post('/api/messaging/templates')
    .set(auth(token))
    .send({ nombre: nombreUnico('plantilla'), canal: 'wa_link', cuerpo });
  expect(response.status).toBe(201);
  const template = response.body as { id: number };
  creados.templates.push(template.id);
  return template;
}

async function crearCliente(zoneId: number, aceptaMensajes: boolean) {
  const priceList = await prisma.priceList.findFirstOrThrow();
  const client = await prisma.client.create({
    data: {
      nombreComercial: nombreUnico('Cliente Mensajería'),
      tipoNegocio: 'tienda',
      zoneId,
      ordenRuta: 6000 + Math.floor(Math.random() * 3000),
      direccion: 'Calle de prueba',
      priceListId: priceList.id,
      limiteCredito: '5000.00',
      plazoDias: 15,
    },
  });

  await prisma.clientContact.create({
    data: {
      clientId: client.id,
      nombre: 'Contacto principal',
      telefono: `502${String(10000000 + Math.floor(Math.random() * 89999999))}`,
      esWhatsapp: true,
      aceptaMensajes,
      esPrincipal: true,
    },
  });

  creados.clients.push(client.id);
  return client;
}

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  await limpiar();
});

describe('plantillas de mensaje', () => {
  it('rechaza una variable que no está permitida al crear', async () => {
    const { token } = await loginAsAdmin();

    const response = await request(app)
      .post('/api/messaging/templates')
      .set(auth(token))
      .send({
        nombre: nombreUnico('plantilla'),
        canal: 'wa_link',
        cuerpo: 'Hola {nombre}, tu saldo es {saldoInicial}',
      });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('INVALID_TEMPLATE_VARIABLE');
    expect(response.body.error.message).toContain('{saldoInicial}');
    expect(response.body.error.message).toContain('{nombre}');
  });

  it('acepta las tres variables permitidas y registra la escritura en audit', async () => {
    const { token, userId } = await loginAsAdmin();
    const nombre = nombreUnico('plantilla');
    const response = await request(app)
      .post('/api/messaging/templates')
      .set(auth(token))
      .send({
        nombre,
        canal: 'wa_link',
        cuerpo: 'Hola {nombre}, saldo {saldo}, catálogo {ultimoPedidoUrl}',
      });

    expect(response.status).toBe(201);
    expect(response.body.nombre).toBe(nombre);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entidad: 'MessageTemplate', entidadId: String(response.body.id), accion: 'create' },
    });
    expect(audit.userId).toBe(userId);
  });

  it('desactiva la plantilla con PATCH', async () => {
    const { token } = await loginAsAdmin();
    const template = await crearTemplate(token, 'Hola {nombre}');

    const response = await request(app)
      .patch(`/api/messaging/templates/${template.id}/deactivate`)
      .set(auth(token));

    expect(response.status).toBe(200);
    expect(response.body.activo).toBe(false);
  });

  it('no deja escribir a un usuario que no es admin', async () => {
    const response = await request(app)
      .post('/api/messaging/templates')
      .set(auth('token-invalido'))
      .send({ nombre: nombreUnico('plantilla'), canal: 'wa_link', cuerpo: 'Hola' });

    expect(response.status).toBe(401);
  });
});

describe('resolución de la plantilla', () => {
  it('reemplaza nombre y saldo pendiente con el valor real del cliente', async () => {
    const { token, userId } = await loginAsAdmin();
    const sample = await prisma.client.findFirstOrThrow();
    const client = await crearCliente(sample.zoneId, true);
    const template = await crearTemplate(token, 'Hola {nombre}, tu saldo es {saldo}');

    await prisma.$transaction((tx) =>
      postMovement(tx, {
        clientId: client.id,
        tipo: 'cargo',
        referenciaTipo: 'test',
        referenciaId: `mensaje-${client.id}`,
        monto: '125.50',
        fecha: new Date(),
        userId,
      }),
    );

    const response = await request(app)
      .get(`/api/messaging/clients/${client.id}/link?templateId=${template.id}`)
      .set(auth(token));

    expect(response.status).toBe(200);
    expect(response.body.contenido).toBe(`Hola ${client.nombreComercial}, tu saldo es Q125.50`);
    expect(response.body.url).toContain('https://wa.me/');
  });

  it('deja el saldo en Q0.00 cuando el cliente no tiene movimientos', async () => {
    const { token } = await loginAsAdmin();
    const sample = await prisma.client.findFirstOrThrow();
    const client = await crearCliente(sample.zoneId, true);
    const template = await crearTemplate(token, 'Saldo: {saldo}');

    const response = await request(app)
      .get(`/api/messaging/clients/${client.id}/link?templateId=${template.id}`)
      .set(auth(token));

    expect(response.status).toBe(200);
    expect(response.body.contenido).toBe('Saldo: Q0.00');
  });

  it('guarda el MessageLog con estado generado y lo devuelve en el historial', async () => {
    const { token } = await loginAsAdmin();
    const sample = await prisma.client.findFirstOrThrow();
    const client = await crearCliente(sample.zoneId, true);
    const template = await crearTemplate(token, 'Hola {nombre}');

    await request(app)
      .get(`/api/messaging/clients/${client.id}/link?templateId=${template.id}`)
      .set(auth(token));

    const log = await prisma.messageLog.findFirstOrThrow({ where: { clientId: client.id } });
    expect(log.estado).toBe('generado');
    expect(log.canal).toBe('wa_link');
    expect(log.contenido).toBe(`Hola ${client.nombreComercial}`);

    const history = await request(app)
      .get(`/api/messaging/clients/${client.id}/history`)
      .set(auth(token));

    expect(history.status).toBe(200);
    expect(history.body).toHaveLength(1);
    expect(history.body[0].estado).toBe('generado');
  });
});

describe('POST /api/messaging/clients/:clientId/send', () => {
  it('responde 422 con el mensaje de que el envío no está configurado', async () => {
    vi.stubEnv('WHATSAPP_PROVIDER', 'wa_link');
    const { token } = await loginAsAdmin();
    const sample = await prisma.client.findFirstOrThrow();
    const client = await crearCliente(sample.zoneId, true);
    const template = await crearTemplate(token, 'Hola {nombre}');

    const response = await request(app)
      .post(`/api/messaging/clients/${client.id}/send?templateId=${template.id}`)
      .set(auth(token));

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('WHATSAPP_SEND_NOT_CONFIGURED');
    expect(response.body.error.message).toBe(
      'el envío automático no está configurado, usa el link. Configura WHATSAPP_PROVIDER=business_api y las credenciales para habilitarlo',
    );
    // No debe haber escrito ningún MessageLog: no se intentó enviar.
    expect(await prisma.messageLog.count({ where: { clientId: client.id } })).toBe(0);
  });
});

describe('POST /api/messaging/broadcast/today', () => {
  it('devuelve solo los clientes de la zona activa que aceptan mensajes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 7, 9, 0, 0));

    const { token } = await loginAsAdmin();
    const zona = await prisma.zone.findFirstOrThrow({ where: { nombre: 'Zona Mixco' } });
    const template = await crearTemplate(token, 'Hola {nombre}, saldo {saldo}');

    const acepta = await crearCliente(zona.id, true);
    const noAcepta = await crearCliente(zona.id, false);

    const response = await request(app)
      .post('/api/messaging/broadcast/today')
      .set(auth(token))
      .send({ templateId: template.id });

    expect(response.status).toBe(200);
    const ids = response.body.map((row: { clientId: number }) => row.clientId);

    // Entra el cliente cuyo contacto acepta mensajes...
    expect(ids).toContain(acepta.id);
    // ...y no entra el que no los acepta.
    expect(ids).not.toContain(noAcepta.id);

    // Todo lo devuelto está en la zona activa de hoy y trae un link de wa.me.
    const clientes = await prisma.client.findMany({ where: { id: { in: ids } } });
    expect(clientes.every((row) => row.zoneId === zona.id)).toBe(true);
    for (const fila of response.body as Array<{ url: string }>) {
      expect(fila.url).toContain('https://wa.me/');
    }

    const fila = response.body.find((row: { clientId: number }) => row.clientId === acepta.id);
    expect(fila.nombre).toBe(acepta.nombreComercial);
    expect(new URL(fila.url).searchParams.get('text')).toContain(`Hola ${acepta.nombreComercial}`);
  });
});