import { useState } from 'react'
import { useCart } from '../cart/CartContext.tsx'
import type { PublicProduct, PublicUnit } from '../api/publicStore.ts'
import styles from './catalog.module.css'

function quetzales(value: string) {
  return `Q ${Number(value).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function primeraConPrecio(unidades: PublicUnit[]) {
  return unidades.find((unidad) => unidad.precio !== null) ?? unidades[0]
}

export function ProductCard({ producto }: { producto: PublicProduct }) {
  const { cantidades, add, setQty } = useCart()
  const inicial = primeraConPrecio(producto.unidades)
  const [unitId, setUnitId] = useState(inicial?.id)
  const unidad = producto.unidades.find((item) => item.id === unitId) ?? inicial
  const cantidad = unidad ? (cantidades[unidad.id] ?? 0) : 0
  const [fotoRota, setFotoRota] = useState(false)

  return (
    <article className={styles.card}>
      <div className={styles.photo}>
        {producto.imagenUrl && !fotoRota ? (
          <img
            className={styles.photoImg}
            src={producto.imagenUrl}
            alt={producto.nombre}
            onError={() => setFotoRota(true)}
          />
        ) : (
          <span className={styles.photoEmpty} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <circle cx="9" cy="10" r="1.5" />
              <path d="M21 16l-5-5-9 9" />
            </svg>
          </span>
        )}
      </div>
      <p className={styles.sku}>{producto.sku}</p>
      <h2 className={`${styles.name} font-display`}>{producto.nombre}</h2>
      {producto.unidades.length > 1 && unidad ? (
        <select
          className={`${styles.unitSelect} font-body`}
          aria-label={`Presentación de ${producto.nombre}`}
          value={unidad.id}
          onChange={(event) => setUnitId(Number(event.target.value))}
        >
          {producto.unidades.map((item) => (
            <option key={item.id} value={item.id}>
              {item.nombre}
            </option>
          ))}
        </select>
      ) : unidad ? (
        <p className={styles.sku}>{unidad.nombre}</p>
      ) : null}
      <p className={`${styles.price} font-display`}>
        {unidad?.precio ? quetzales(unidad.precio) : 'Sin precio'}
      </p>
      {unidad?.precio ? (
        cantidad > 0 ? (
          <div className={styles.stepper}>
            <button
              type="button"
              className={styles.qtybtn}
              aria-label={`Quitar uno de ${producto.nombre}`}
              onClick={() => setQty(unidad.id, cantidad - 1)}
            >
              −
            </button>
            <span className={styles.qty}>{cantidad}</span>
            <button
              type="button"
              className={styles.qtybtn}
              aria-label={`Sumar uno de ${producto.nombre}`}
              onClick={() => add(unidad.id)}
            >
              +
            </button>
          </div>
        ) : (
          <button type="button" className={`${styles.addbtn} w-full`} onClick={() => add(unidad.id)}>
            Agregar
          </button>
        )
      ) : null}
    </article>
  )
}
