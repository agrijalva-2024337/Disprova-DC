import { Outlet } from 'react-router-dom'
import { CartProvider } from './cart/CartContext.tsx'

/** El carrito vive mientras el cliente recorre el catálogo, el pedido y la confirmación. */
export function StoreLayout() {
  return (
    <CartProvider>
      <Outlet />
    </CartProvider>
  )
}
