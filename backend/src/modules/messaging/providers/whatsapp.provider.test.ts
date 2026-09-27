import { afterEach, describe, expect, it, vi } from 'vitest';

// AppError se importa dinamicamente junto al proveedor: con vi.resetModules()
// el import estatico seria otra copia de la clase y instanceof fallaria.

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('LinkWhatsAppProvider', () => {
  it('arma la URL con el telefono en solo digitos', async () => {
    const { LinkWhatsAppProvider } = await import('./whatsapp.provider.js');
    const provider = new LinkWhatsAppProvider();

    expect(provider.mode).toBe('wa_link');
    expect(provider.buildLink('+502 5555-1234', 'Hola')).toBe('https://wa.me/50255551234?text=Hola');
  });

  it('codifica espacios, acentos y saldos con Q y decimales', async () => {
    const { LinkWhatsAppProvider } = await import('./whatsapp.provider.js');
    const provider = new LinkWhatsAppProvider();
    const mensaje = 'Hola Ñoño, tu saldo es Q1,250.50. Ver: https://app.disprova.local/pedidos/42';

    const link = provider.buildLink('+502 5555-1234', mensaje);
    const url = new URL(link);

    expect(url.origin + url.pathname).toBe('https://wa.me/50255551234');
    // El mensaje vuelve intacto al decodificar el query param.
    expect(url.searchParams.get('text')).toBe(mensaje);
    // La 'ñ' y los espacios quedaron escapados, no crudos.
    expect(link).toContain('%C3%B1');
    expect(link).toContain('%20');
    expect(link).not.toContain(' ');
  });

  it('send() nunca envia y explica que use el link', async () => {
    const { LinkWhatsAppProvider, WA_LINK_SEND_ERROR } = await import('./whatsapp.provider.js');
    const provider = new LinkWhatsAppProvider();

    await expect(provider.send('50255551234', 'Hola')).resolves.toEqual({
      ok: false,
      error: WA_LINK_SEND_ERROR,
    });
  });
});

describe('BusinessApiWhatsAppProvider', () => {
  it('lanza AppError si faltan las variables de entorno', async () => {
    vi.stubEnv('WHATSAPP_TOKEN', undefined);
    vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', undefined);
    const { BusinessApiWhatsAppProvider } = await import('./whatsapp.provider.js');
    const { AppError } = await import('../../../shared/errors/AppError.js');

    let thrown: unknown;
    try {
      new BusinessApiWhatsAppProvider();
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(AppError);
    expect((thrown as AppError).code).toBe('WHATSAPP_NOT_CONFIGURED');
  });

  it('lanza AppError si solo falta una de las dos', async () => {
    vi.stubEnv('WHATSAPP_TOKEN', 'token-de-prueba');
    vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', undefined);
    const { BusinessApiWhatsAppProvider } = await import('./whatsapp.provider.js');
    const { AppError } = await import('../../../shared/errors/AppError.js');

    expect(() => new BusinessApiWhatsAppProvider()).toThrowError(AppError);
  });

  it('hace el POST a la Cloud API y devuelve el id del mensaje', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: 'wamid.ABC123' }] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { BusinessApiWhatsAppProvider } = await import('./whatsapp.provider.js');
    const provider = new BusinessApiWhatsAppProvider('token-de-prueba', '987654');

    const resultado = await provider.send('50255551234', 'Hola Ñoño');

    expect(resultado).toEqual({ ok: true, providerMessageId: 'wamid.ABC123' });
    const [url, opciones] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://graph.facebook.com/v20.0/987654/messages');
    expect(opciones.method).toBe('POST');
    expect((opciones.headers as Record<string, string>).Authorization).toBe('Bearer token-de-prueba');
    expect(JSON.parse(opciones.body as string)).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '50255551234',
      type: 'text',
      text: { body: 'Hola Ñoño' },
    });
  });

  it('devuelve el error de la API sin lanzar excepcion', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('token invalido', { status: 401 })),
    );
    const { BusinessApiWhatsAppProvider } = await import('./whatsapp.provider.js');
    const provider = new BusinessApiWhatsAppProvider('token-de-prueba', '987654');

    const resultado = await provider.send('50255551234', 'Hola');

    expect(resultado.ok).toBe(false);
    expect((resultado as { error: string }).error).toContain('401');
  });
});

describe('getWhatsAppProvider', () => {
  it('devuelve el proveedor de link si WHATSAPP_PROVIDER no esta seteada', async () => {
    vi.stubEnv('WHATSAPP_PROVIDER', undefined);
    const { getWhatsAppProvider, LinkWhatsAppProvider } = await import('./whatsapp.provider.js');

    expect(getWhatsAppProvider()).toBeInstanceOf(LinkWhatsAppProvider);
  });

  it('devuelve el proveedor de link con WHATSAPP_PROVIDER=wa_link', async () => {
    vi.stubEnv('WHATSAPP_PROVIDER', 'wa_link');
    const { getWhatsAppProvider, LinkWhatsAppProvider } = await import('./whatsapp.provider.js');

    expect(getWhatsAppProvider()).toBeInstanceOf(LinkWhatsAppProvider);
  });

  it('devuelve el de la API cuando WHATSAPP_PROVIDER=business_api', async () => {
    vi.stubEnv('WHATSAPP_PROVIDER', 'business_api');
    vi.stubEnv('WHATSAPP_TOKEN', 'token-de-prueba');
    vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '987654');
    const { getWhatsAppProvider, BusinessApiWhatsAppProvider } = await import('./whatsapp.provider.js');

    expect(getWhatsAppProvider()).toBeInstanceOf(BusinessApiWhatsAppProvider);
  });

  it('falla claro si pide business_api sin credenciales', async () => {
    vi.stubEnv('WHATSAPP_PROVIDER', 'business_api');
    vi.stubEnv('WHATSAPP_TOKEN', undefined);
    vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', undefined);
    const { getWhatsAppProvider } = await import('./whatsapp.provider.js');
    const { AppError } = await import('../../../shared/errors/AppError.js');

    expect(() => getWhatsAppProvider()).toThrowError(AppError);
  });
});