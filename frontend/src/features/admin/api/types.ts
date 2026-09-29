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