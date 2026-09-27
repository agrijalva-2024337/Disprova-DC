import { env } from '../../../config/env.js';
import { AppError } from '../../../shared/errors/AppError.js';

const WA_LINK_BASE = 'https://wa.me/';
const WHATSAPP_API_URL = 'https://graph.facebook.com/v20.0';

/**
 * wa_link no puede enviar desde el servidor: arma un link y el usuario
 * (o el vendedor desde el celular) hace el envio tocando el link.
 */
export const WA_LINK_SEND_ERROR =
  'wa_link no envía desde el servidor, usa buildLink y que el usuario haga clic';

export type WhatsAppSendResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; error: string };

export interface WhatsAppProvider {
  mode: 'wa_link' | 'business_api';
  buildLink(telefono: string, mensaje: string): string;
  send(telefono: string, mensaje: string): Promise<WhatsAppSendResult>;
}

/** wa.me espera solo digitos, sin '+', guiones ni espacios. */
function soloDigitos(telefono: string): string {
  return telefono.replace(/\D/g, '');
}

function buildWaLink(telefono: string, mensaje: string): string {
  return `${WA_LINK_BASE}${soloDigitos(telefono)}?text=${encodeURIComponent(mensaje)}`;
}

/**
 * Proveedor por defecto. No requiere ninguna clave paga ni configuracion:
 * genera el link de wa.me con el mensaje ya resuelto.
 */
export class LinkWhatsAppProvider implements WhatsAppProvider {
  readonly mode = 'wa_link' as const;

  buildLink(telefono: string, mensaje: string): string {
    return buildWaLink(telefono, mensaje);
  }

  async send(_telefono: string, _mensaje: string): Promise<WhatsAppSendResult> {
    return { ok: false, error: WA_LINK_SEND_ERROR };
  }
}

/**
 * Proveedor contra la WhatsApp Cloud API de Meta. Es el que se activa cuando
 * se contrate el plan de WhatsApp Business: solo cambia WHATSAPP_PROVIDER.
 */
export class BusinessApiWhatsAppProvider implements WhatsAppProvider {
  readonly mode = 'business_api' as const;

  private readonly token: string;

  private readonly phoneNumberId: string;

  constructor(
    token: string | undefined = env.whatsapp.token,
    phoneNumberId: string | undefined = env.whatsapp.phoneNumberId,
  ) {
    if (!token || !phoneNumberId) {
      throw new AppError(
        'WhatsApp Business API requiere WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID',
        500,
        'WHATSAPP_NOT_CONFIGURED',
      );
    }

    this.token = token;
    this.phoneNumberId = phoneNumberId;
  }

  buildLink(telefono: string, mensaje: string): string {
    return buildWaLink(telefono, mensaje);
  }

  async send(telefono: string, mensaje: string): Promise<WhatsAppSendResult> {
    try {
      const response = await fetch(`${WHATSAPP_API_URL}/${this.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: telefono,
          type: 'text',
          text: { body: mensaje },
        }),
      });

      if (!response.ok) {
        const detalle = await response.text().catch(() => '');
        return { ok: false, error: `WhatsApp Business API respondió ${response.status}: ${detalle}` };
      }

      const payload = (await response.json()) as { messages?: Array<{ id?: string }> };
      const providerMessageId = payload.messages?.[0]?.id;

      if (!providerMessageId) {
        return { ok: false, error: 'La respuesta de WhatsApp Business API no trae messages[0].id' };
      }

      return { ok: true, providerMessageId };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Error desconocido al enviar por WhatsApp',
      };
    }
  }
}

/**
 * Unico lugar del codigo que decide que proveedor usar.
 * 'wa_link' (default) funciona hoy sin claves; 'business_api' exige credenciales.
 */
export function getWhatsAppProvider(): WhatsAppProvider {
  if (process.env.WHATSAPP_PROVIDER === 'business_api') {
    return new BusinessApiWhatsAppProvider();
  }

  return new LinkWhatsAppProvider();
}