export type AuthUser = {
  id: number
  nombre: string
  email: string
  roleId: number
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
