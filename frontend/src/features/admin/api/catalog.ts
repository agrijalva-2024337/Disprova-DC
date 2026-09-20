import { apiRequest } from './http.ts'
import type { Category, CategoryInput, LoginResponse, PriceList, PriceListInput, Product, ProductInput } from './types.ts'

export function login(email: string, password: string) {
  return apiRequest<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: { email, password },
    skipAuth: true,
  })
}

export function listCategories() {
  return apiRequest<Category[]>('/api/catalog/categories')
}

export function createCategory(input: CategoryInput) {
  return apiRequest<Category>('/api/catalog/categories', {
    method: 'POST',
    body: input,
  })
}

export function updateCategory(id: number, input: CategoryInput) {
  return apiRequest<Category>(`/api/catalog/categories/${id}`, {
    method: 'PUT',
    body: input,
  })
}

export function listProducts() {
  return apiRequest<Product[]>('/api/catalog/products')
}

export function getProduct(id: number) {
  return apiRequest<Product>(`/api/catalog/products/${id}`)
}

export function createProduct(input: ProductInput) {
  return apiRequest<Product>('/api/catalog/products', {
    method: 'POST',
    body: input,
  })
}

export function updateProduct(id: number, input: Partial<ProductInput>) {
  return apiRequest<Product>(`/api/catalog/products/${id}`, {
    method: 'PUT',
    body: input,
  })
}

export function listPriceLists() {
  return apiRequest<PriceList[]>('/api/catalog/price-lists')
}

export function createPriceList(input: PriceListInput) {
  return apiRequest<PriceList>('/api/catalog/price-lists', {
    method: 'POST',
    body: input,
  })
}

export function updatePriceList(id: number, input: PriceListInput) {
  return apiRequest<PriceList>(`/api/catalog/price-lists/${id}`, {
    method: 'PUT',
    body: input,
  })
}
