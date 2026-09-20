import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../app.js';

describe('POST /api/auth/login', () => {
  it('inicia sesión con el admin de prueba', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: 'admin@disprova.local',
      password: 'Admin123!',
    });

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).toEqual(expect.any(String));
    expect(response.body.user.email).toBe('admin@disprova.local');
  });

  it('rechaza una contraseña incorrecta con el mismo error genérico', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: 'admin@disprova.local',
      password: 'no-es-la-clave',
    });

    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe('Credenciales inválidas');
  });
});
