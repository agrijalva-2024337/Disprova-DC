import { describe, expect, it } from 'vitest';
import {
  FEL_PROVIDER_NOT_CONFIGURED_ERROR,
  StubFelProvider,
  getFelProvider,
} from './fel.provider.js';

const FACTURA = {
  serie: 'A',
  numero: 1,
  total: '150.50',
  cliente: { nit: '12345678', nombre: 'Cliente Demo' },
  lineas: [
    {
      sku: 'MED-001',
      descripcion: 'Paracetamol 500 mg',
      cantidad: '2',
      precioUnitario: '75.25',
      total: '150.50',
    },
  ],
};

describe('StubFelProvider', () => {
  it('no está configurado', () => {
    expect(new StubFelProvider().configured).toBe(false);
  });

  it('certify() falla con el mensaje de "no configurado" y no hace red', async () => {
    const resultado = await new StubFelProvider().certify(FACTURA);

    expect(resultado).toEqual({ ok: false, error: FEL_PROVIDER_NOT_CONFIGURED_ERROR });
    expect(resultado.ok).toBe(false);
  });

  it('falla igual aunque la factura tenga todos los datos', async () => {
    const resultado = await new StubFelProvider().certify({
      ...FACTURA,
      cliente: { nit: null, nombre: 'Consumidor Final' },
    });

    expect(resultado.ok).toBe(false);
  });
});

describe('getFelProvider', () => {
  it('devuelve el stub mientras no haya certificador elegido', () => {
    const provider = getFelProvider();

    expect(provider).toBeInstanceOf(StubFelProvider);
    expect(provider.configured).toBe(false);
  });
});