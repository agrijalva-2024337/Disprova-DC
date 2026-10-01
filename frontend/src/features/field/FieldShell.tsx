import type { ReactNode } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../admin/auth/AuthContext.tsx'

/**
 * Marco de las pantallas de campo.
 *
 * El vendedor trabaja con una sola mano y con los dedos sucios: en el teléfono
 * la navegación va abajo, al alcance del pulgar, y los botones son grandes. En
 * computadora y laptop el mismo marco se despliega: la barra de abajo pasa a
 * ser un menú lateral fijo y el contenido usa todo el ancho, para no obligar a
 * trabajar en una franja angosta en el medio de la pantalla.
 *
 * También deja fija la marca y, sobre todo, la salida: desde el campo se vuelve
 * al panel de administración con un botón, que antes no existía.
 */
export function FieldShell({
  titulo,
  subtitulo,
  acciones,
  aside,
  children,
}: {
  titulo: string
  subtitulo?: ReactNode
  /** Botones a la derecha del título (volver, repetir pedido…). */
  acciones?: ReactNode
  /** Columna fija de escritorio. En el teléfono la hoja la arma la pantalla. */
  aside?: ReactNode
  children: ReactNode
}) {
  const { logout } = useAuth()
  const navigate = useNavigate()

  function salir() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-50 font-body text-slate-900 lg:flex">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="border-b border-slate-200 px-4 py-4">
          <Link to="/ruta" className="block">
            <p className="font-display text-xl font-semibold text-slate-900">Disprova GyG</p>
            <div className="mt-2 h-0.5 w-12 bg-[var(--store-accent)]" />
            <p className="mt-2 text-xs text-slate-500">Ruta de campo</p>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          <Tab to="/ruta" label="Mi ruta" icono="ruta" exact />
          <Tab to="/ruta/entregas" label="Entregas" icono="entregas" />
          <Tab to="/ruta/caja" label="Caja" icono="caja" />
        </nav>
        <div className="space-y-2 border-t border-slate-200 p-3">
          <Link
            to="/admin"
            className="flex h-10 items-center gap-2.5 rounded px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            <IconoPanel />
            Volver al panel
          </Link>
          <button
            type="button"
            onClick={salir}
            className="flex h-10 w-full items-center gap-2.5 rounded px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            <IconoSalir />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 pb-3.5 pt-3 sm:px-6">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-2.5">
            <span className="font-display text-sm font-semibold text-slate-900">Disprova GyG</span>

            <div className="ml-auto flex items-center gap-1.5">
              {/* En el teléfono no hay menú lateral, así que la salida al panel
                  vive también acá y no solo en el aside de escritorio. */}
              <Link
                to="/admin"
                className="flex h-9 items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 sm:text-sm"
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
                  <path d="M3 10.5 12 3l9 7.5" />
                  <path d="M5 9.5V21h14V9.5" />
                </svg>
                Panel
              </Link>
              <button
                type="button"
                onClick={salir}
                title="Cerrar sesión"
                className="flex h-9 w-9 items-center justify-center rounded border border-slate-300 bg-white text-slate-700"
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

          <div className="mx-auto mt-2.5 flex w-full max-w-6xl flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-semibold text-slate-900">{titulo}</h1>
              {subtitulo ? <div className="mt-0.5 text-sm text-slate-600">{subtitulo}</div> : null}
            </div>
            {acciones ? <div className="flex flex-wrap items-center gap-2">{acciones}</div> : null}
          </div>
        </header>

        {/* pb-28 deja espacio para la barra del pedido y la de navegación del
            teléfono. La barra lateral del pedido aparece hasta `xl`, así que el
            hueco se mantiene hasta ahí. */}
        <main className="flex-1 px-4 pb-28 pt-4 sm:px-6 lg:px-8 xl:pb-10">
          <div
            className={
              aside
                ? 'mx-auto grid w-full max-w-6xl grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]'
                : 'mx-auto w-full max-w-6xl'
            }
          >
            <div className="min-w-0">{children}</div>
            {aside ? <div className="hidden xl:sticky xl:top-32 xl:block">{aside}</div> : null}
          </div>
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-20 lg:hidden">
          <div className="flex w-full border-t border-slate-200 bg-white">
            <Tab to="/ruta" label="Ruta" icono="ruta" exact />
            <Tab to="/ruta/entregas" label="Entregas" icono="entregas" />
            <Tab to="/ruta/caja" label="Caja" icono="caja" />
          </div>
        </nav>
      </div>
    </div>
  )
}

function IconoPanel() {
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
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  )
}

function IconoSalir() {
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
      <path d="M15 5H6v14h9" />
      <path d="M12 12h9m0 0-3-3m3 3-3 3" />
    </svg>
  )
}

function Tab({
  to,
  label,
  icono,
  exact = false,
}: {
  to: string
  label: string
  icono: 'ruta' | 'entregas' | 'caja'
  exact?: boolean
}) {
  const trazos = {
    ruta: ['M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z', 'M12 7.4a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2Z'],
    entregas: ['M6 3h12l1.5 18H4.5L6 3Z', 'M9 8h6'],
    caja: ['M3 7h18v13H3z', 'M8 7V4.5h8V7'],
  }[icono]

  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) =>
        // En el menú lateral el item es una fila con icono a la izquierda; en la
        // barra de abajo es una columna angosta bajo el ícono. El mismo
        // componente cubre los dos porque es el mismo destino.
        isActive
          ? 'flex flex-1 flex-col items-center gap-1 py-2.5 text-[0.6875rem] font-semibold text-slate-900 shadow-[inset_0_-2px_0_var(--store-accent)] lg:w-full lg:flex-row lg:justify-start lg:gap-2.5 lg:rounded lg:px-3 lg:py-2.5 lg:text-sm lg:shadow-[inset_0_-2px_0_var(--store-accent)]'
          : 'flex flex-1 flex-col items-center gap-1 py-2.5 text-[0.6875rem] font-medium text-slate-600 hover:bg-slate-100 lg:w-full lg:flex-row lg:justify-start lg:gap-2.5 lg:rounded lg:px-3 lg:py-2.5 lg:text-sm'
      }
    >
      {({ isActive }) => (
        <>
          <svg
            viewBox="0 0 24 24"
            className={`h-[1.35rem] w-[1.35rem] shrink-0 lg:h-[1.15rem] lg:w-[1.15rem] ${
              isActive ? 'text-[var(--store-accent)]' : ''
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {trazos.map((d) => (
              <path key={d} d={d} />
            ))}
          </svg>
          {label}
        </>
      )}
    </NavLink>
  )
}
