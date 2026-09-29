import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { createToken } from '../api/publicTokens.ts'
import { ApiError } from '../api/http.ts'
import { Alert } from '../ui/Status.tsx'

type EnlaceGenerado = { url: string; expira: string }

/**
 * Catálogo público del cliente. Ojo con el alcance: el backend solo tiene
 * `POST /api/tokens/clients/:clientId`. No hay GET para listar los enlaces ni
 * un endpoint para revocar, asi que la tabla muestra solo los que se
 * generaron en esta sesión y no hay botón de revocar: ponerlo sería un
 * control que no hace nada.
 */
export function PublicCatalogSection({ clientId }: { clientId: number }) {
  const [dias, setDias] = useState('30')
  const [copiado, setCopiado] = useState(false)
  const [generados, setGenerados] = useState<EnlaceGenerado[]>([])

  const mutation = useMutation({
    mutationFn: (expiraEnDias: number) => createToken(clientId, expiraEnDias),
    onSuccess: (data) => {
      const url = `${window.location.origin}${data.pathCatalogo}`
      setGenerados((prev) => [{ url, expira: data.expiresAt }, ...prev])
      setCopiado(false)
    },
  })

  const ultimo = generados[0] ?? null

  async function copiar(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
    } catch {
      // Sin permiso de portapapeles: se puede seleccionar a mano, no es un error.
      setCopiado(false)
    }
  }

  const error = mutation.isError
    ? mutation.error instanceof ApiError
      ? mutation.error.message
      : 'No se pudo generar el enlace'
    : null


  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <h2 className="text-sm font-semibold">Catálogo público</h2>
        <p className="text-sm text-slate-600">
          Un enlace para que el cliente vea el catálogo con sus precios y haga pedidos sin cuenta.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block w-40 text-sm">
          <span className="mb-1 block font-medium">Vigencia (días)</span>
          <input
            type="number"
            min={1}
            max={365}
            value={dias}
            onChange={(event) => setDias(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <button
          type="button"
          onClick={() => mutation.mutate(Number(dias) || 30)}
          disabled={mutation.isPending}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {mutation.isPending ? 'Generando…' : 'Generar enlace'}
        </button>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {ultimo ? (
        <div className="space-y-2 rounded border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-slate-500">Enlace generado</p>
          <p className="break-all font-mono text-sm">{ultimo.url}</p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => copiar(ultimo.url)}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              Copiar enlace
            </button>
            <span className="text-xs text-slate-500">
              {copiado ? 'Copiado al portapapeles' : `Vence el ${ultimo.expira.slice(0, 10)}`}
            </span>
          </div>
        </div>
      ) : null}

      {generados.length > 0 ? (
        <div className="overflow-x-auto rounded border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Enlace</th>
                <th className="px-3 py-2 font-medium">Vence</th>
              </tr>
            </thead>
            <tbody>
              {generados.map((fila) => (
                <tr key={fila.url} className="border-t border-slate-100">
                  <td className="break-all px-3 py-2 font-mono text-xs">{fila.url}</td>
                  <td className="px-3 py-2 text-slate-600">{fila.expira.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Alert tone="info">
        Esta pantalla solo muestra los enlaces generados en esta sesión. El backend no tiene un
        listado de tokens por cliente, así que los que se generaron antes no aparecen. Tampoco hay
        forma de revocar uno: no existe ese endpoint todavía. Un enlace deja de servir solo cuando
        vence.
      </Alert>
    </section>
  )
}