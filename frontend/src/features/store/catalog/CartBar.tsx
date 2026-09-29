import { Link } from 'react-router-dom'
import { useCart } from '../cart/CartContext.tsx'
import type { PublicCatalog } from '../api/publicStore.ts'
import styles from './catalog.module.css'

export function CartBar({ token, catalog }: { token: string; catalog: PublicCatalog }) {
  const { totalItems, subtotal } = useCart()
  if (totalItems <= 0) {
    return null
  }

  const total = subtotal(catalog).toLocaleString('es-GT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const etiqueta = totalItems === 1 ? '1 producto' : `${totalItems} productos`

  return (
    <div className={styles.bar}>
      <div>
        <p className={styles.barCount}>{etiqueta}</p>
        <p className={styles.barTotal}>Q {total}</p>
      </div>
      <Link className={styles.addbtn} to={`/catalogo/${token}/pedido`}>
        Ver pedido
      </Link>
    </div>
  )
}
