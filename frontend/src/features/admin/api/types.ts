export type AuthUser = {
  id: number
  nombre: string
  email: string
  roleId: number
  rol: string
  activo: boolean
}

export type LoginResponse = {
  accessToken: string
  refreshToken: string
  user: AuthUser
}

export type Category = {
  id: number
  nombre: string
  parentId: number | null
  orden: number
  activo: boolean
}

export type ProductUnit = {
  id: number
  productId: number
  nombre: string
  factor: string
  codigoBarras: string | null
  precioBase: string
}

export type ProductImage = {
  id: number
  productId: number
  url: string
  orden: number
  esPrincipal: boolean
}

export type Product = {
  id: number
  sku: string
  nombre: string
  descripcion: string | null
  categoryId: number
  marca: string | null
  unidadBase: string
  controlado: boolean
  activo: boolean
  createdAt: string
  units: ProductUnit[]
  images: ProductImage[]
}

export type PriceList = {
  id: number
  nombre: string
  descripcion: string | null
  activo: boolean
  items?: PriceListItem[]
}

export type PriceListItem = {
  id: number
  priceListId: number
  productUnitId: number
  precio: string
  vigenteDesde: string
}

export type CategoryInput = {
  nombre: string
  parentId?: number | null
  orden?: number
  activo?: boolean
}

export type ProductInput = {
  sku: string
  nombre: string
  descripcion?: string | null
  categoryId: number
  marca?: string | null
  unidadBase: string
  controlado?: boolean
  activo?: boolean
  units?: Array<{
    nombre: string
    factor: string
    codigoBarras?: string | null
    precioBase: string
  }>
}

export type PriceListInput = {
  nombre: string
  descripcion?: string | null
  activo?: boolean
}

export type Zone = {
  id: number
  nombre: string
  semanaMes: number
  diasSemana: number[]
  vendedorUserId: number | null
  activo: boolean
}

export type ZoneInput = {
  nombre: string
  semanaMes: number
  diasSemana: number[]
  vendedorUserId?: number | null
  activo?: boolean
}

export type ClientContact = {
  id: number
  clientId: number
  nombre: string
  telefono: string
  esWhatsapp: boolean
  aceptaMensajes: boolean
  esPrincipal: boolean
}

export type ClientContactInput = {
  nombre: string
  telefono: string
  esWhatsapp: boolean
  aceptaMensajes?: boolean
  esPrincipal?: boolean
}

export type Client = {
  id: number
  nombreComercial: string
  nit: string | null
  tipoNegocio: 'tienda' | 'farmacia' | 'mercado' | 'otro'
  zoneId: number
  ordenRuta: number
  direccion: string
  lat: string | null
  lng: string | null
  priceListId: number
  limiteCredito: string
  plazoDias: number
  activo: boolean
  createdAt: string
  contacts?: ClientContact[]
}

export type ClientInput = {
  nombreComercial: string
  nit?: string | null
  tipoNegocio: Client['tipoNegocio']
  zoneId: number
  ordenRuta: number
  direccion: string
  priceListId: number
  limiteCredito?: string
  plazoDias?: number
  activo?: boolean
}

export type TodayRouteClient = Client & {
  saldoActual: number
  visitadoHoy: boolean
}

export type TodayRoute = {
  fecha: string
  semanaMes: number
  diaSemana: number
  zones: Zone[]
  clients: TodayRouteClient[]
}

export type RouteVisitInput = {
  clientId: number
  resultado: 'pedido' | 'no_compro' | 'cerrado'
  motivo?: string | null
}

/**
 * `POST /api/tokens/clients/:clientId`. Ojo: `pathCatalogo` viene RELATIVO
 * (`/catalogo/<token>`), el frontend le pone el dominio.
 */
export type ClientAccessToken = {
  token: string
  expiresAt: string
  cliente: { id: number; nombreComercial: string }
  pathCatalogo: string
export type Role = {
  id: number
  nombre: string
  permisos: unknown
}

/**
 * Alta de usuario. La contraseña es obligatoria y de al menos 8 caracteres:
 * el backend la hashea con bcrypt y nunca devuelve el hash.
 */
export type CreateUserInput = {
  nombre: string
  email: string
  password: string
  roleId: number
  activo?: boolean
}

/**
 * Edición de usuario. NO lleva `password` a propósito: `updateUserSchema` del
 * backend no la acepta y el service no hashea nada en el PUT. Cambiar una
 * contraseña es otro flujo que todavía no existe.
 */
export type UpdateUserInput = {
  nombre?: string
  email?: string
  roleId?: number
  activo?: boolean
export type InvoiceEstado = 'pendiente_certificacion' | 'certificada' | 'error'

/** `GET /api/invoices` incluye el pedido con su cliente, para no pedir otra cosa. */
export type Invoice = {
  id: number
  orderId: number
  serie: string
  /** Correlativo interno. NO es el número fiscal: ese lo asigna el certificador. */
  numero: number
  /** UUID que devuelve la SAT al certificar. Null hasta entonces. */
  uuidFel: string | null
  fechaCertificacion: string | null
  estado: InvoiceEstado
  total: string
  xmlUrl: string | null
  pdfUrl: string | null
  error: string | null
  createdAt: string
  order?: {
    id: number
    numero: string
    client?: { id: number; nombreComercial: string }
  }
export type MessageCanal = 'wa_link' | 'whatsapp_api'
export type MessageEstado = 'generado' | 'enviado' | 'fallido'

/** Las únicas variables que el backend acepta en el cuerpo de una plantilla. */
export const ALLOWED_TEMPLATE_VARIABLES = ['nombre', 'saldo', 'ultimoPedidoUrl'] as const

export type MessageTemplate = {
  id: number
  nombre: string
  canal: MessageCanal
  cuerpo: string
  activo: boolean
  createdAt: string
}

export type MessageTemplateInput = {
  nombre: string
  canal: MessageCanal
  cuerpo: string
  activo?: boolean
}

export type MessageLog = {
  id: number
  clientId: number
  templateId: number | null
  telefono: string
  contenido: string
  canal: MessageCanal
  estado: MessageEstado
  error: string | null
  userId: number
  createdAt: string
}

/** `GET /clients/:id/link`: el texto ya resuelto y la URL de wa.me. */
export type ClientLink = {
  url: string
  contenido: string
}

/** Fila de `POST /broadcast/today`. */
export type BroadcastLink = {
  clientId: number
  nombre: string
  url: string
export type ReturnEstado = 'pendiente' | 'aceptada' | 'rechazada'
export type ReturnDestino = 'reingreso' | 'merma'

export type ReturnItem = {
  id: number
  returnId: number
  orderItemId: number
  cantidad: string
  batchId: number | null
  destino: ReturnDestino
}

export type MerchandiseReturn = {
  id: number
  clientId: number
  orderId: number
  userId: number
  fecha: string
  motivo: string
  estado: ReturnEstado
  /** Queda en 0 mientras está pendiente: se calcula al aceptarla. */
  total: string
  createdAt: string
  items: ReturnItem[]
}

export type CreateReturnInput = {
  clientId: number
  orderId: number
  motivo: string
  items: Array<{
    orderItemId: number
    cantidad: string
    batchId?: number | null
    destino: ReturnDestino
  }>
}

export type CashSessionEstado = 'abierta' | 'cerrada'

export type CashSession = {
  id: number
  userId: number
  fecha: string
  fondoInicial: string
  totalCobrado: string
  totalGastos: string
  conteoFinal: string | null
  diferencia: string | null
  estado: CashSessionEstado
  createdAt: string
  cerradaAt: string | null
}

export type CashSessionFilters = {
  userId?: number
  desde?: string
  hasta?: string
}

/** Movimientos de la cuenta corriente. El backend los devuelve de más antiguo a más nuevo. */
export type AccountMovement = {
  id: number
  clientId: number
  tipo: 'cargo' | 'abono'
  referenciaTipo: string
  referenciaId: string
  monto: string
  saldoResultante: string
  fecha: string
  createdAt: string
}

export type AccountStatement = {
  saldoActual: string
  movements: AccountMovement[]
}

/** Los mismos cuatro buckets que arma el backend en `getAging`. */
export type AgingBuckets = {
  '0-15': string
  '16-30': string
  '31-60': string
  '60+': string
}

export type ClientAging = {
  saldoActual: string
  buckets: AgingBuckets
}

/** Fila de `GET /api/reports/aging`: un cliente con saldo y sus buckets. */
export type AgingRow = {
  clientId: number
  nombre: string
  saldoActual: string
  buckets: AgingBuckets
}

export type SalesTodayVendedor = {
  userId: number
  nombre: string
  contado: string
  credito: string
  total: string
}

/**
 * `GET /api/reports/sales-today`. Ojo: el backend NO devuelve la cantidad de
 * pedidos por vendedor, solo los montos, asi que el dashboard no la muestra.
 */
export type SalesToday = {
  total: string
  porCondicion: { contado: string; credito: string }
  porVendedor: SalesTodayVendedor[]
}

export type CollectionsTodayVendedor = {
  userId: number
  nombre: string
  total: string
}

/**
 * `GET /api/reports/collections-today`. Ojo: agrupa por VENDEDOR, no por método
 * de pago. Para desglosar por efectivo/transferencia/cheque hace falta un
 * endpoint nuevo (ver el aviso de DISP-033).
 */
export type CollectionsToday = {
  total: string
  porVendedor: CollectionsTodayVendedor[]
}

export type PaymentMethod = 'efectivo' | 'transferencia' | 'cheque'

export type Payment = {
  id: number
  clientId: number
  userId: number
  fecha: string
  monto: string
  metodo: PaymentMethod
  referencia: string | null
  cashSessionId: number | null
  createdAt: string
}

export type PaymentApplication = {
  id: number
  paymentId: number
  orderId: number
  montoAplicado: string
}

export type PaymentWithApplications = Payment & {
  applications: PaymentApplication[]
}

export type PaymentInput = {
  clientId: number
  monto: string
  metodo: PaymentMethod
  referencia?: string | null
}

export type ApplyPaymentInput = {
  applications: Array<{ orderId: number; monto: string }>
}

export type CollectionVisitResultado =
  | 'pago_completo'
  | 'pago_parcial'
  | 'compromiso'
  | 'sin_contacto'

export type CollectionVisit = {
  id: number
  clientId: number
  userId: number
  fecha: string
  resultado: CollectionVisitResultado
  montoComprometido: string | null
  fechaCompromiso: string | null
  observaciones: string | null
  createdAt: string
}

export type CollectionVisitInput = {
  clientId: number
  resultado: CollectionVisitResultado
  montoComprometido?: string | null
  fechaCompromiso?: string | null
  observaciones?: string | null
}
