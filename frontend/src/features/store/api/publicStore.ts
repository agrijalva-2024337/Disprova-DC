export type PublicStoreErrorCode =
  | 'PUBLIC_TOKEN_MISSING'
  | 'PUBLIC_TOKEN_INVALID'
  | 'PUBLIC_TOKEN_EXPIRED'
  | 'NO_PRICE_LIST'

const PUBLIC_STORE_ERROR_CODES: readonly PublicStoreErrorCode[] = [
  'PUBLIC_TOKEN_MISSING',
  'PUBLIC_TOKEN_INVALID',
  'PUBLIC_TOKEN_EXPIRED',
  'NO_PRICE_LIST',
]

export function isPublicStoreErrorCode(code: string): code is PublicStoreErrorCode {
  return (PUBLIC_STORE_ERROR_CODES as readonly string[]).includes(code)
}

export type PublicStoreErrorDetails = {
  productUnitId?: number
}

/** Error del catálogo público. `code` es el del backend, no solo el texto. */
export class PublicStoreError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: PublicStoreErrorDetails

  constructor(message: string, status: number, code: string, details?: PublicStoreErrorDetails) {
    super(message)
    this.name = 'PublicStoreError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export function isPublicStoreError(error: unknown): error is PublicStoreError {
  return error instanceof PublicStoreError
}

export type PublicCategory = {
  id: number
  nombre: string
  parentId: number | null
  orden: number
  activo: boolean
}

export type PublicUnit = {
  id: number
  nombre: string
  factor: string
  codigoBarras: string | null
  precio: string | null
}

export type PublicProduct = {
  id: number
  sku: string
  nombre: string
  descripcion: string | null
  marca: string | null
  categoryId: number
  imagenUrl: string | null
  unidades: PublicUnit[]
}

export type PublicCatalog = {
  cliente: { id: number; nombreComercial: string }
  categorias: PublicCategory[]
  productos: PublicProduct[]
}

export type PublicOrderBody = {
  condicionPago: 'contado' | 'credito'
  idempotencyKey?: string
  items: Array<{ productUnitId: number; cantidad: string | number }>
}

export type PublicOrderItem = {
  id: number
  productUnitId: number
  cantidad: string
  precioUnitario: string
  descuento: string
  impuesto: string
  totalLinea: string
}

export type PublicOrder = {
  id: number
  numero: string
  clientId: number
  userId: number
  canal: string
  estado: string
  condicionPago: 'contado' | 'credito'
  subtotal: string
  descuento: string
  impuesto: string
  total: string
  items: PublicOrderItem[]
}

async function readError(
  response: Response,
): Promise<{ message: string; code: string; details?: PublicStoreErrorDetails }> {
  try {
    const data = (await response.json()) as {
      error?: { message?: string; code?: string; details?: { productUnitId?: unknown } }
    }
    const productUnitId = data.error?.details?.productUnitId
    return {
      message: data.error?.message ?? `Error ${response.status}`,
      code: data.error?.code ?? '',
      details: typeof productUnitId === 'number' ? { productUnitId } : undefined,
    }
  } catch {
    return { message: `Error ${response.status}`, code: '' }
  }
}

/**
 * Mismo fetch que el panel, sin JWT. El enlace del cliente se manda en
 * `X-Client-Token` y no habilita ningún endpoint interno.
 */
async function publicRequest<T>(path: string, token: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    'X-Client-Token': token,
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await readError(response)
    throw new PublicStoreError(error.message, response.status, error.code, error.details)
  }

  return (await response.json()) as T
}

export function getCatalog(token: string) {
  return publicRequest<PublicCatalog>('/api/public/catalog', token)
}

export function createOrder(token: string, body: PublicOrderBody) {
  return publicRequest<PublicOrder>('/api/public/orders', token, body)
}
