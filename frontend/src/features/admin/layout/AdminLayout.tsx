import { useState } from 'react'
import { Link, NavLink, Navigate, Outlet } from 'react-router-dom'
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
  { to: '/admin/perfil', label: 'Mi perfil' },
]

export function AdminLayout() {
  const { isAuthenticated, user, logout } = useAuth()
  const [menuAbierto, setMenuAbierto] = useState(false)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  const visibles = links.filter((link) => !link.soloAdmin || user?.rol === 'admin')

  return (
    <div className="min-h-screen bg-slate-50 font-body text-slate-900">
      <div className="flex min-h-screen">
        {menuAbierto ? (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            aria-label="Cerrar menú"
            onClick={() => setMenuAbierto(false)}
          />
        ) : null}
        <aside
          className={`${menuAbierto ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-40 w-64 overflow-y-auto border-r border-slate-200 bg-white px-3 py-5 transition-transform md:static md:z-auto md:w-56 md:translate-x-0 md:shrink-0`}
        >
          <p className="px-2 font-display text-xl font-semibold text-slate-900">Disprova GyG</p>
          <div className="mx-2 mt-2 h-0.5 bg-[var(--store-accent)]" />
          <p className="mb-4 mt-3 px-2 text-xs text-slate-500">Panel</p>
          <nav className="space-y-1">
            {visibles.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/admin'}
                onClick={() => setMenuAbierto(false)}
                className={({ isActive }) =>
                  `block rounded px-2 py-2.5 text-sm ${
                    isActive
                      ? 'font-medium text-slate-900 shadow-[inset_0_-2px_0_var(--store-accent)]'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 md:px-6">
            <button
              type="button"
              className="min-h-11 rounded border border-slate-300 px-3 text-sm font-medium md:hidden"
              onClick={() => setMenuAbierto(true)}
            >
              Menú
            </button>
            <Link to="/admin/perfil" className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-700">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 font-display text-sm">
                  {(user?.nombre ?? user?.email ?? '?').slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="truncate">{user?.nombre ?? user?.email ?? 'Sesión activa'}</span>
            </Link>
            <button
              type="button"
              onClick={logout}
              className="min-h-11 shrink-0 rounded border border-slate-300 px-3 text-sm hover:bg-slate-50"
            >
              Salir
            </button>
          </header>
          <main className="min-w-0 flex-1 p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
