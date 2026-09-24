import { Link, useParams } from 'react-router-dom'

export function OrderPlaceholderPage() {
  const { clientId } = useParams()

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-slate-100 px-4 py-6">
      <Link to="/ruta" className="text-base text-slate-600">
        ← Ruta
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Pedido</h1>
      <p className="mt-3 text-base text-slate-600">
        TODO: toma de pedido del cliente {clientId}. Esta pantalla llega en el siguiente paso.
      </p>
    </div>
  )
}
