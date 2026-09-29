import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react'
import type { PublicCatalog } from '../api/publicStore.ts'

/** Cantidad pedida de cada presentación. Solo vive en memoria. */
type CartState = Record<number, number>

type CartAction =
  | { type: 'add'; id: number }
  | { type: 'remove'; id: number }
  | { type: 'setQty'; id: number; n: number }
  | { type: 'clear' }

type CartContextValue = {
  cantidades: CartState
  add: (id: number) => void
  remove: (id: number) => void
  setQty: (id: number, n: number) => void
  clear: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

function without(state: CartState, id: number): CartState {
  const next = { ...state }
  delete next[id]
  return next
}

function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add':
      return { ...state, [action.id]: (state[action.id] ?? 0) + 1 }
    case 'remove':
      return without(state, action.id)
    case 'setQty':
      if (!Number.isFinite(action.n) || action.n <= 0) {
        return without(state, action.id)
      }
      return { ...state, [action.id]: action.n }
    case 'clear':
      return {}
  }
}

function money(value: number) {
  return Math.round(value * 100) / 100
}

/** Suma precio de lista por cantidad. Una presentación sin precio no entra. */
function catalogSubtotal(catalog: PublicCatalog, cantidades: CartState) {
  const precios = new Map<number, string>()
  for (const producto of catalog.productos) {
    for (const unidad of producto.unidades) {
      if (unidad.precio !== null) {
        precios.set(unidad.id, unidad.precio)
      }
    }
  }

  let total = 0
  for (const [id, cantidad] of Object.entries(cantidades)) {
    const precio = precios.get(Number(id))
    if (precio === undefined) {
      continue
    }
    total = money(total + money(Number(precio) * cantidad))
  }
  return total
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cantidades, dispatch] = useReducer(reducer, {})

  const value = useMemo<CartContextValue>(
    () => ({
      cantidades,
      add(id) {
        dispatch({ type: 'add', id })
      },
      remove(id) {
        dispatch({ type: 'remove', id })
      },
      setQty(id, n) {
        dispatch({ type: 'setQty', id, n })
      },
      clear() {
        dispatch({ type: 'clear' })
      },
    }),
    [cantidades],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const cart = useContext(CartContext)
  if (!cart) {
    throw new Error('useCart debe usarse dentro de CartProvider')
  }

  const totalItems = Object.values(cart.cantidades).reduce((sum, cantidad) => sum + cantidad, 0)

  return {
    ...cart,
    totalItems,
    subtotal(catalog: PublicCatalog) {
      return catalogSubtotal(catalog, cart.cantidades)
    },
  }
}
