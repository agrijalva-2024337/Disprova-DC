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
  '--store-muted': theme.textMuted,
  '--store-accent': theme.accent,
  '--store-accent-soft': theme.accentSoft,
} as CSSProperties

export function OrderConfirmationPage() {
  const { token } = useParams()
  const location = useLocation()
  const numero = (location.state as { numero?: string } | null)?.numero

  return (
    <main className={`${catalogStyles.page} font-body`} style={storeVars}>
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="text-sm" style={{ color: theme.textMuted }}>
          Número de pedido
        </p>
        {numero ? <p className={`${styles.numero} font-display`}>{numero}</p> : null}
        <p className={styles.confirmText}>
          Tu pedido quedó registrado. Un vendedor lo va a confirmar.
        </p>
        {token ? (
          <Link className={`${catalogStyles.addbtn} mt-8`} to={`/catalogo/${token}`}>
            Volver al catálogo
          </Link>
        ) : null}
      </div>
    </main>
  )
}
