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

describe('refresh de un solo uso', () => {
  async function login() {
    const response = await request(app).post('/api/auth/login').send({
      email: 'admin@disprova.local',
      password: 'Admin123!',
    });
    expect(response.status).toBe(200);
    return response.body.refreshToken as string;
  }

  it('después de logout el mismo refresh token ya no renueva', async () => {
    const inicial = await login();
    const renovado = await request(app).post('/api/auth/refresh').send({ refreshToken: inicial });
    expect(renovado.status).toBe(200);

    const logout = await request(app).post('/api/auth/logout').send({
      refreshToken: renovado.body.refreshToken,
    });
    expect(logout.status).toBe(204);

    const reintento = await request(app).post('/api/auth/refresh').send({
      refreshToken: renovado.body.refreshToken,
    });
    expect(reintento.status).toBe(401);
    expect(reintento.body.error.code).toBe('UNAUTHORIZED');
  });

  it('reusar un refresh ya consumido revoca también la sesión nueva', async () => {
    const inicial = await login();
    const renovado = await request(app).post('/api/auth/refresh').send({ refreshToken: inicial });
    expect(renovado.status).toBe(200);

    const reuso = await request(app).post('/api/auth/refresh').send({ refreshToken: inicial });
    expect(reuso.status).toBe(401);
    expect(reuso.body.error.code).toBe('UNAUTHORIZED');

    const conElNuevo = await request(app).post('/api/auth/refresh').send({
      refreshToken: renovado.body.refreshToken,
    });
    expect(conElNuevo.status).toBe(401);
    expect(conElNuevo.body.error.code).toBe('UNAUTHORIZED');
  });
});
