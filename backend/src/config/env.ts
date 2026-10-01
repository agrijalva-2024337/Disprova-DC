import dotenv from 'dotenv';

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? '3000'),
  postgres: {
    host: required('POSTGRES_HOST'),
    port: Number(process.env.POSTGRES_PORT ?? '5432'),
    user: required('POSTGRES_USER'),
    password: required('POSTGRES_PASSWORD'),
    database: required('POSTGRES_DB'),
  },
  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
  },
  /// Límites de peticiones. Vienen por variable de entorno porque el número
  /// que sirve en desarrollo no es el que sirve en producción: probando la
  /// aplicación, 100 peticiones en 15 minutos se agotan recargando el panel, y
  /// te deja afuera con un 429 que no dice nada. En producción los defaults
  /// siguen siendo altos pero no infinitos, y se pueden bajar por entorno.
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000),
    /// Peticiones a /api en general. Sube lo bastante para no estorbar al uso normal.
    apiMax: Number(process.env.RATE_LIMIT_API_MAX ?? 600),
    /// Intentos de ingreso. Alto a propósito: este límite frena a quien
    /// adivina contraseñas, no a quien se equivoca una vez y necesita
    /// volver a intentarlo.
    loginMax: Number(process.env.RATE_LIMIT_LOGIN_MAX ?? 10),
  },
  whatsapp: {
    provider: process.env.WHATSAPP_PROVIDER ?? 'wa_link',
    token: process.env.WHATSAPP_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  },
  /// Opcional: el certificador FEL todavía no está elegido. La clave sola
  /// no habilita nada; hace falta además implementar el proveedor real.
  fel: {
    provider: process.env.FEL_PROVIDER,
    apiKey: process.env.FEL_PROVIDER_API_KEY,
    serie: process.env.FEL_SERIE ?? 'A',
  },
} as const;
