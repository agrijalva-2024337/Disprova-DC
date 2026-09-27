// =============================================================================
// FEL: facturación electrónica en Guatemala.
//
// La certificación ante la SAT no tiene un estándar único: la hace un
// CERTIFICADOR AUTORIZADO (Digifact, Infile, Megaprint, ...) y cada uno
// tiene su propio contrato de API, sus credenciales y sus formatos. Por eso
// acá no hay ninguna llamada de red: todavía no se eligió con quién trabajar.
//
// Cuando se elija un certificador real, implementar una clase nueva que
// cumpla FelProvider y cambiar el factory getFelProvider() para devolverla
// según una variable de entorno FEL_PROVIDER, siguiendo el mismo patrón que
// WhatsAppProvider en messaging/.
// =============================================================================

export const FEL_PROVIDER_NOT_CONFIGURED_ERROR =
  'FEL_PROVIDER_NOT_CONFIGURED: define FEL_PROVIDER_API_KEY y elegí un certificador para habilitar esto';

export type CertificarInput = {
  serie: string;
  numero: number;
  total: string;
  cliente: {
    nit: string | null;
    nombre: string;
  };
  lineas: Array<{
    sku: string;
    descripcion: string;
    cantidad: string;
    precioUnitario: string;
    total: string;
  }>;
};

export type CertificarResult =
  | { ok: true; uuid: string; xmlUrl: string; pdfUrl: string }
  | { ok: false; error: string };

export interface FelProvider {
  configured: boolean;
  certify(invoice: CertificarInput): Promise<CertificarResult>;
}

/**
 * Placeholder. No hace ninguna llamada de red: devuelve siempre el error de
 * "no configurado" para que el flujo de facturación falle de forma explícita
 * en vez de fingir que certificó algo.
 */
export class StubFelProvider implements FelProvider {
  readonly configured = false;

  async certify(_invoice: CertificarInput): Promise<CertificarResult> {
    return { ok: false, error: FEL_PROVIDER_NOT_CONFIGURED_ERROR };
  }
}

/**
 * Único lugar del código que decide qué certificador se usa, igual que
 * getWhatsAppProvider() en messaging/. Hoy siempre devuelve el stub.
 */
export function getFelProvider(): FelProvider {
  return new StubFelProvider();
}