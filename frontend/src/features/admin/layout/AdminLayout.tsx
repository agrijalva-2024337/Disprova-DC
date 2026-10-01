import { useState } from 'react'
import { Link, NavLink, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.tsx'
import { BrandLogo, BrandMark } from '../ui/BrandLogo.tsx'

/**
 * Módulos del panel, agrupados como se usan en el mostrador: primero lo de la
 * ruta, después el catálogo y el territorio, y al final lo de la oficina.
 */
type Enlace = {
  to: string
  label: string
  icono: keyof typeof TRAZOS
  soloAdmin?: boolean
}

/**
 * Iconos en línea, trazo de 1.5 para que pesen lo mismo que un texto de 13px.
 * Se dibujan aquí en vez de traer una librería de íconos: son catorce y el
 * proyecto no depende de ninguna.
 */
const TRAZOS = {
  inicio: ['M3 10.5 12 3l9 7.5', 'M5 9.5V21h14V9.5'],
  ruta: ['M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z', 'M12 7.4a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2Z'],
  pedidos: ['M6 3h12l1.5 18H4.5L6 3Z', 'M9 8h6'],
  inventario: ['M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z', 'M3 7.5 12 12l9-4.5M12 12v9'],
  cajas: ['M3 7h18v13H3z', 'M8 7V4.5h8V7'],
  productos: ['M7 8 12 5l5 3v8l-5 3-5-3V8Z', 'M7 8l5 3 5-3M12 11v8'],
  categorias: ['M4 5h7v7H4z', 'M13 5h7v7h-7z', 'M4 14h7v5H4z', 'M13 14h7v5h-7z'],
  listas: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3.5 6h.01', 'M3.5 12h.01', 'M3.5 18h.01'],
  clientes: ['M9 4.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z', 'M2.5 20a6.5 6.5 0 0 1 13 0', 'M16 5.2a3.5 3.5 0 0 1 0 5.6', 'M18 20a6.4 6.4 0 0 0-2-4.6'],
  cobranza: ['M2.5 6h19v12h-19z', 'M2.5 10h19', 'M6 15h4'],
  zonas: ['M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z', 'M12 7.4a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2Z'],
  facturacion: ['M6 3h12v18l-3-2-3 2-3-2-3 2V3Z', 'M9.5 8h5', 'M9.5 12h5'],
  devoluciones: ['M3.5 12a8.5 8.5 0 1 1 2.6 6.1', 'M3 19v-5h5'],
  mensajeria: ['M4 5.5h16v11H8l-4 3.5v-14Z', 'M8 10h8'],
  usuarios: ['M12 4.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z', 'M5 20a7 7 0 0 1 14 0'],
} as const

const grupos: { titulo: string; enlaces: Enlace[] }[] = [
  {
    titulo: 'Operación',
    enlaces: [
      { to: '/admin', label: 'Inicio', icono: 'inicio' },
      // El vendedor entra a la ruta desde acá y vuelve con el botón "Panel"
      // del FieldShell: las dos pantallas son la misma sesión.
      { to: '/ruta', label: 'Ruta de campo', icono: 'ruta' },
      { to: '/admin/pedidos', label: 'Pedidos', icono: 'pedidos' },
      { to: '/admin/inventario', label: 'Inventario', icono: 'inventario' },
      { to: '/admin/cajas', label: 'Cajas', icono: 'cajas' },
    ],
  },
  {
    titulo: 'Catálogo',
    enlaces: [
      { to: '/admin/productos', label: 'Productos', icono: 'productos' },
      { to: '/admin/categorias', label: 'Categorías', icono: 'categorias' },
      { to: '/admin/listas-precio', label: 'Listas de precio', icono: 'listas' },
    ],
  },
  {
    titulo: 'Clientes',
    enlaces: [
      { to: '/admin/clientes', label: 'Clientes', icono: 'clientes' },
      { to: '/admin/cobranza', label: 'Cobranza', icono: 'cobranza' },
      { to: '/admin/zonas', label: 'Zonas', icono: 'zonas' },
    ],
  },
  {
    titulo: 'Oficina',
    enlaces: [
      { to: '/admin/facturacion', label: 'Facturación', icono: 'facturacion' },
      { to: '/admin/devoluciones', label: 'Devoluciones', icono: 'devoluciones' },
      { to: '/admin/mensajeria/plantillas', label: 'Mensajería', icono: 'mensajeria' },
      { to: '/admin/usuarios', label: 'Usuarios', icono: 'usuarios', soloAdmin: true },
      { to: '/admin/perfil', label: 'Mi perfil', icono: 'usuarios' },
    ],
  },
]

function Icono({ nombre }: { nombre: keyof typeof TRAZOS }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[1.05rem] w-[1.05rem] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {TRAZOS[nombre].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}

/** Iniciales del usuario para el avatar: evita depender de un archivo de foto. */
function iniciales(nombre: string) {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}


export function AdminLayout() {
  const { isAuthenticated, user, logout } = useAuth()
  const [menuAbierto, setMenuAbierto] = useState(false)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Usuarios y roles es cosa de admin: el link no se muestra a los demás.
  const visibles = grupos
    .map((grupo) => ({
      ...grupo,
      enlaces: grupo.enlaces.filter((e) => !e.soloAdmin || user?.rol === 'admin'),
    }))
    .filter((grupo) => grupo.enlaces.length > 0)

  const nombreUsuario = user?.nombre ?? 'Sesión activa'

  return (
    <div className="min-h-screen bg-parchment text-ink">
      <div className="flex min-h-screen">
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col border-r border-line bg-surface transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
            menuAbierto ? 'translate-x-0 shadow-lift' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center gap-3 border-b border-line px-5 py-5">
            <BrandMark size={38} />
            <div className="min-w-0">
              <BrandLogo size="sm" />
              <p className="mt-1 text-[0.625rem] uppercase tracking-[0.14em] text-muted">
                Panel admin
              </p>
            </div>
          </div>

          <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
            {visibles.map((grupo) => (
              <div key={grupo.titulo}>
                <p className="px-3 pb-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted">
                  {grupo.titulo}
                </p>
                <div className="space-y-0.5">
                  {grupo.enlaces.map((link) => (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      end={link.to === '/admin'}
                      onClick={() => setMenuAbierto(false)}
                      className={({ isActive }) =>
                        `group relative flex items-center gap-2.5 rounded-[0.625rem] px-3 py-2 text-[0.8125rem] font-medium transition-colors duration-150 ${
                          isActive
                            ? 'bg-brand-soft text-brand-deep'
                            : 'text-ink-soft hover:bg-parchment hover:text-ink'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand transition-opacity duration-150 ${
                              isActive ? 'opacity-100' : 'opacity-0'
                            }`}
                            aria-hidden="true"
                          />
                          <span
                            className={isActive ? 'text-brand' : 'text-muted group-hover:text-brand'}
                          >
                            <Icono nombre={link.icono} />

                          </span>
                          {link.label}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}

            <div className="pt-1">
              <NavLink
                to="/ruta"
                onClick={() => setMenuAbierto(false)}
                className="flex items-center gap-2.5 rounded-[0.625rem] border border-dashed border-gold/50 bg-gold-soft px-3 py-2.5 text-[0.8125rem] font-semibold text-ink transition-colors hover:border-gold"
              >
                <span className="text-gold">
                  <Icono nombre="zonas" />
                </span>
                Ir a mi ruta
              </NavLink>
            </div>
          </nav>

          {/* Perfil: quién está operando y cómo sale. */}
          <div className="border-t border-line p-3">
            <div className="flex items-center gap-3 rounded-[0.75rem] bg-parchment p-2.5">
            <Link to="/admin/perfil" className="flex min-w-0 flex-1 items-center gap-3">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
              ) : (
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-sm font-semibold text-white"
                  style={{ background: 'linear-gradient(140deg, #A3221C 0%, #7A1712 100%)' }}
                  aria-hidden="true"
                >
                  {iniciales(nombreUsuario)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.8125rem] font-semibold text-ink">{nombreUsuario}</p>
                <p className="truncate text-[0.6875rem] capitalize text-muted">{user?.rol ?? 'sin rol'}</p>
              </div>
            </Link>
              <button
                type="button"
                onClick={logout}
                title="Cerrar sesión"
                className="rounded-[0.5rem] p-1.5 text-muted transition-colors hover:bg-brand-soft hover:text-brand"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M15 5H6v14h9" />
                  <path d="M12 12h9m0 0-3-3m3 3-3 3" />
                </svg>
                <span className="sr-only">Cerrar sesión</span>
              </button>
            </div>
          </div>
        </aside>

        {menuAbierto ? (
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setMenuAbierto(false)}
            className="fixed inset-0 z-30 bg-ink/30 backdrop-blur-[2px] lg:hidden"
          />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-parchment/85 px-4 py-3 backdrop-blur-md sm:px-6">
            <button
              type="button"
              onClick={() => setMenuAbierto((v) => !v)}
              className="rounded-[0.5rem] p-1.5 text-ink-soft transition-colors hover:bg-surface lg:hidden"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
              <span className="sr-only">Abrir menú</span>
            </button>

            <div className="lg:hidden">
              <BrandLogo size="sm" />
            </div>

            <Link to="/admin/perfil" className="ml-auto flex min-w-0 items-center gap-2 text-sm text-ink">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft font-display text-sm font-semibold text-brand-deep">
                  {iniciales(user?.nombre ?? '?')}
                </span>
              )}
              <span className="hidden truncate sm:inline">{user?.nombre ?? user?.email ?? 'Sesión activa'}</span>
            </Link>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-[1400px] animate-fade-up">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

