import { z } from 'zod';

/** Variables que una plantilla puede usar. Cualquier otra se rechaza al crear. */
export const ALLOWED_VARIABLES = ['nombre', 'saldo', 'ultimoPedidoUrl'] as const;

const VARIABLE_REGEX = /\{([A-Za-z0-9_]+)\}/g;

export function extractVariables(cuerpo: string): string[] {
  const found: string[] = [];
  for (const match of cuerpo.matchAll(VARIABLE_REGEX)) {
    if (!found.includes(match[1])) {
      found.push(match[1]);
    }
  }
  return found;
}

export function unknownVariables(cuerpo: string): string[] {
  return extractVariables(cuerpo).filter(
    (name) => !(ALLOWED_VARIABLES as readonly string[]).includes(name),
  );
}

/**
 * Mismo criterio que unknownVariables pero como schema de Zod, para que la
 * lista de variables validas quede declarada junto al resto de la validacion.
 */
export const cuerpoConVariablesPermitidasSchema = z.string().min(1).refine(
  (cuerpo) => unknownVariables(cuerpo).length === 0,
  {
    message: `La plantilla solo puede usar ${ALLOWED_VARIABLES.map((v) => `{${v}}`).join(', ')}`,
  },
);

/**
 * El cuerpo solo se valida por forma acá. Las variables se revisan en el
 * service, que devuelve un 422 nombrando la variable culpable en vez del
 * 400 genérico de validateBody.
 */
export const createTemplateSchema = z.object({
  nombre: z.string().min(1),
  canal: z.enum(['wa_link', 'whatsapp_api']),
  cuerpo: z.string().min(1),
  activo: z.boolean().optional(),
});

export const updateTemplateSchema = createTemplateSchema.partial();

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const clientIdParamSchema = z.object({
  clientId: z.coerce.number().int().positive(),
});

export const templateIdQuerySchema = z.object({
  templateId: z.coerce.number().int().positive(),
});

export const broadcastTodaySchema = z.object({
  templateId: z.coerce.number().int().positive(),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;