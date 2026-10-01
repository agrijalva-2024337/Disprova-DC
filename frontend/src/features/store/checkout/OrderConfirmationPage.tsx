import type { CSSProperties } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import catalogStyles from '../catalog/catalog.module.css'
import { theme } from '../theme.ts'
import styles from './checkout.module.css'

const storeVars = {
  '--store-bg': theme.bg,
  '--store-surface': theme.surface,
  '--store-border': theme.border,
  '--store-text': theme.text,
  '--store-ink': theme.text,
  '--store-muted': theme.textMuted,
  '--store-accent': theme.accent,
} as CSSProperties

export function OrderConfirmationPage() {
  const { token } = useParams()
  const location = useLocation()
  const numero = (location.state as { numero?: string } | null)?.numero

  return (
    <main className={`${catalogStyles.page} font-body`} style={storeVars}>
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-6 text-center">
        <p className="text-sm" style={{ color: theme.textMuted }}>
          Número de pedido
        </p>
        {numero ? <p className={`${styles.numero} font-display`}>{numero}</p> : null}
        <p className={`${styles.confirmText} font-display`}>
          Pedido recibido. Tu vendedor lo va a confirmar y coordinar la entrega.
        </p>
        {token ? (
          <Link className={`${styles.confirm} font-body mt-8`} to={`/catalogo/${token}`}>
            Volver al catálogo
          </Link>
        ) : null}
      </div>
    </main>
  )
}
