import { useState } from 'react'
import type { Product, ProductUnit } from '../admin/api/types.ts'
import { Stepper } from './Stepper.tsx'
import { quetzales } from './format.ts'

/**
 * Tarjeta de producto para tomar el pedido en la ruta.
 *
 * Reemplaza la lista de texto: el vendedor ve la foto, el nombre y el precio de
 * la lista del cliente, y aprieta "+" para pedir fardos, cajas o unidades. Si
 * el producto se vende en varias presentaciones (fardo, media docena, docena),
 * el <select> cambia de presentación sin sacar la tarjeta de la pantalla, que es
 * lo que hace lento el pedido cuando hay que recordar el nombre exacto.
 */
export function ProductTile({
  producto,
  precioDe,
  cantidadDe,
  onCantidad,
}: {
  producto: Product
  /** Precio vigente de una presentación, o `undefined` si no está en la lista. */
  precioDe: (unidad: ProductUnit) => number | undefined
  /** Cantidad ya pedida de esa presentación. */
  cantidadDe: (unidadId: number) => number
  onCantidad: (unidad: ProductUnit, nueva: number) => void
}) {
  const conPrecio = producto.units.filter((unidad) => precioDe(unidad) !== undefined)
  const inicial = conPrecio[0] ?? producto.units[0] ?? null
  // La presentación elegida vive en la tarjeta: es estado de la vista, no del
  // pedido, y así no se reinicia cuando el padre vuelve a renderizar.
  const [unidadId, setUnidadId] = useState<number | null>(inicial?.id ?? null)
  const unidad = producto.units.find((item) => item.id === unidadId) ?? inicial
  const cantidad = unidad ? cantidadDe(unidad.id) : 0
  const precio = unidad ? precioDe(unidad) : undefined
  const foto = producto.images.find((image) => image.esPrincipal) ?? producto.images[0]

  return (
    <article className="flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card transition-shadow hover:shadow-lift">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-parchment">
        {foto ? (
          <img
            src={foto.url}
            alt={producto.nombre}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          // Sin foto el hueco no se disimula con un icono genérico: se muestra
          // la inicial para que el vendedor ubique el producto de un vistazo.
          <span
            className="flex h-full w-full items-center justify-center font-display text-3xl font-semibold text-line"
            aria-hidden="true"
          >
            {producto.nombre.trim().charAt(0).toUpperCase()}
          </span>
        )}
        {cantidad > 0 ? (
          <span className="absolute right-2 top-2 rounded-full bg-brand px-2.5 py-1 font-display text-xs font-semibold text-white shadow-card">
            {cantidad} en el pedido
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="truncate text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted">
          {producto.marca ?? producto.sku}
        </p>
        <h3 className="font-display text-sm font-semibold leading-snug text-ink">{producto.nombre}</h3>

        {producto.units.length > 1 && unidad ? (
          <select
            aria-label={`Presentación de ${producto.nombre}`}
            value={unidad.id}
            onChange={(event) => setUnidadId(Number(event.target.value))}
            className="h-9 w-full rounded-[0.5rem] border border-line bg-parchment px-2 text-xs text-ink outline-none transition-colors focus:border-brand"
          >
            {producto.units.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre}
                {precioDe(item) === undefined ? ' — sin precio' : ''}
              </option>
            ))}
          </select>
        ) : unidad ? (
          <p className="truncate text-xs text-muted">{unidad.nombre}</p>
        ) : null}

        <p className="font-display text-base font-semibold text-brand">
          {precio === undefined ? 'Sin precio' : quetzales(precio)}
        </p>

        <div className="mt-auto pt-1.5">
          {!unidad || precio === undefined ? (
            <p className="rounded-[0.5rem] bg-parchment px-2 py-2 text-center text-[0.6875rem] text-muted">
              No está en la lista de precios de este cliente
            </p>
          ) : cantidad === 0 ? (
            <button
              type="button"
              onClick={() => onCantidad(unidad, 1)}
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-[0.625rem] bg-brand text-sm font-semibold text-white transition-colors hover:bg-brand-deep active:translate-y-px"
            >
              <span className="text-lg leading-none">+</span> Agregar
            </button>
          ) : (
            <Stepper
              valor={cantidad}
              etiqueta={`${producto.nombre} ${unidad.nombre}`}
              onCambio={(nuevo) => onCantidad(unidad, nuevo)}
            />
          )}
        </div>
      </div>
    </article>
  )
}
