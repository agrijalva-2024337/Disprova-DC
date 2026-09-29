import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.tsx'

const links = [
  { to: '/admin/pedidos', label: 'Pedidos' },
  { to: '/admin', label: 'Inicio' },
  { to: '/admin/categorias', label: 'Categorías' },
  { to: '/admin/productos', label: 'Productos' },
  { to: '/admin/listas-precio', label: 'Listas de precio' },
  { to: '/admin/inventario', label: 'Inventario' },
  { to: '/admin/zonas', label: 'Zonas' },
  { to: '/admin/clientes', label: 'Clientes' },
  { to: '/admin/usuarios', label: 'Usuarios', soloAdmin: true },
  { to: '/admin/facturacion', label: 'Facturación' },
  { to: '/admin/mensajeria/plantillas', label: 'Mensajería' },
  { to: '/admin/devoluciones', label: 'Devoluciones' },
  { to: '/admin/cajas', label: 'Cajas' },
  { to: '/admin/cobranza', label: 'Cobranza' },
  { to: '/ruta', label: 'Mi ruta' },
]

export function AdminLayout() {
  const { isAuthenticated, user, logout } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Usuarios y roles es cosa de admin: el link no se muestra a los demás.
  const visibles = links.filter((link) => !link.soloAdmin || user?.rol === 'admin')

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="w-56 shrink-0 border-r border-slate-200 bg-white px-3 py-5">
          <p className="px-2 text-sm font-semibold">Disprova GyG</p>
          <p className="mb-4 px-2 text-xs text-slate-500">Panel admin</p>
          <nav className="space-y-1">
            {visibles.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `block rounded px-2 py-2 text-sm ${
                    isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
            <p className="text-sm text-slate-600">{user?.email ?? 'Sesión activa'}</p>
            <button
              type="button"
              onClick={logout}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              Salir
            </button>
          </header>
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
