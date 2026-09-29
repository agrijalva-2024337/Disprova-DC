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

/** Los mismos cuatro buckets que arma el backend en `getAging`. */
export type AgingBuckets = {
  '0-15': string
  '16-30': string
  '31-60': string
  '60+': string
}

/** Fila de `GET /api/reports/aging`. El backend ya la ordena por deuda más vieja. */
export type AgingReportRow = {
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
