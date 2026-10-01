import { useRef, useState, type ChangeEvent } from 'react'
import { useFieldArray, type Control } from 'react-hook-form'
import type { ProductFormValues } from './productFormSchema.ts'

/** Lado máximo de la foto. Evita guardar imágenes de 4 MB en la base. */
const LADO_MAXIMO = 800
/** Tope duro del archivo antes de redimensionar. */
const PESO_MAXIMO_MB = 6

/**
 * Redimensiona la foto en el navegador antes de mandarla.
 *
 * El proyecto no tiene almacenamiento de archivos: product_images guarda una
 * URL. Guardar la foto como data URL (la imagen incrustada en el propio texto)
 * es lo que permite subirla sin montar un servidor de archivos ni sumar una
 * dependencia. El precio es que la imagen queda dentro de la base, así que se
 * achica antes: una foto de teléfono de 4 MB pasa a un rasterizado de decenas de
 * kilobytes que se ve igual en la tienda.
 */
async function achicar(archivo: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const lector = new FileReader()
    lector.onload = () => resolve(String(lector.result))
    lector.onerror = () => reject(new Error('No se pudo leer el archivo'))
    lector.readAsDataURL(archivo)
  })

  const imagen = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('Ese archivo no es una imagen'))
    el.src = dataUrl
  })

  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height))
  if (escala === 1 && dataUrl.length < 400_000) {
    return dataUrl
  }

  const lienzo = document.createElement('canvas')
  lienzo.width = Math.round(imagen.width * escala)
  lienzo.height = Math.round(imagen.height * escala)
  const contexto = lienzo.getContext('2d')
  if (!contexto) {
    return dataUrl
  }
  contexto.drawImage(imagen, 0, 0, lienzo.width, lienzo.height)
  return lienzo.toDataURL('image/jpeg', 0.82)
}

/**
 * El `control` llega por prop y no por useFormContext a propósito: esta pantalla
 * crea el formulario con useForm y no lo envuelve en un <FormProvider>, así que
 * useFormContext devolvería null y el componente reventaría al leer .control.
 */
export function ProductImagesField({ control }: { control: Control<ProductFormValues> }) {
  const { fields, append, remove, update } = useFieldArray({
    control,
    name: 'images',
  })
  const inputArchivo = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function alElegirArchivo(event: ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (archivos.length === 0) {
      return
    }

    setError(null)
    setOcupado(true)
    try {
      for (const archivo of archivos) {
        if (!archivo.type.startsWith('image/')) {
          setError(`"${archivo.name}" no es una imagen.`)
          continue
        }
        if (archivo.size > PESO_MAXIMO_MB * 1024 * 1024) {
          setError(`"${archivo.name}" pesa más de ${PESO_MAXIMO_MB} MB.`)
          continue
        }
        const url = await achicar(archivo)
        // La primera foto del producto es la principal si no hay ninguna elegida.
        append({ id: null, url, esPrincipal: fields.length === 0 })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar la foto')
    } finally {
      setOcupado(false)
    }
  }

  function marcarPrincipal(index: number) {
    fields.forEach((campo, i) => {
      update(i, { ...campo, esPrincipal: i === index })
    })
  }

  function alPegarUrl() {
    const entrada = window.prompt('Pegá el enlace de la imagen')
    const url = entrada?.trim()
    if (!url) {
      return
    }
    setError(null)
    append({ id: null, url, esPrincipal: fields.length === 0 })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink-soft">Imágenes del producto</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => inputArchivo.current?.click()}
            disabled={ocupado}
            className="rounded-[0.625rem] border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:border-brand/40 hover:bg-brand-soft/50 disabled:opacity-60"
          >
            {ocupado ? 'Procesando…' : 'Agregar foto'}
          </button>
          <button
            type="button"
            onClick={alPegarUrl}
            className="rounded-[0.625rem] border border-line bg-surface px-3 py-1.5 text-sm text-ink-soft transition-colors hover:border-brand/40 hover:bg-brand-soft/50"
          >
            Pegar enlace
          </button>
        </div>
      </div>

      <input
        ref={inputArchivo}
        type="file"
        accept="image/*"
        multiple
        onChange={alElegirArchivo}
        className="hidden"
      />

      {error ? (
        <p className="rounded-[0.625rem] border border-brand/25 bg-brand-soft px-3 py-2 text-sm text-brand-deep">
          {error}
        </p>
      ) : null}

      {fields.length === 0 ? (
        <p className="rounded-[0.625rem] border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          Sin fotos. La primera que agregues queda como la principal y es la que se
          ve en el catálogo del cliente.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {fields.map((campo, index) => (
            <li
              key={campo.id ?? `nueva-${index}`}
              className="overflow-hidden rounded-[0.625rem] border border-line bg-surface"
            >
              <img
                src={campo.url}
                alt={`Foto ${index + 1}`}
                className="aspect-square w-full bg-parchment object-cover"
              />
              {campo.esPrincipal ? (
                <span className="mt-1.5 inline-block rounded-full bg-brand px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-white">
                  Principal
                </span>
              ) : null}
              <div className="flex items-center justify-between gap-1 border-t border-line px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => marcarPrincipal(index)}
                  disabled={campo.esPrincipal}
                  className="text-xs font-medium text-muted transition-colors hover:text-brand disabled:opacity-60"
                >
                  {campo.esPrincipal ? 'Principal' : 'Hacer principal'}
                </button>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="text-xs font-medium text-muted transition-colors hover:text-brand"
                >
                  Quitar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted">
        Se achican a {LADO_MAXIMO} px antes de guardarse. La foto queda dentro de la
        base de datos: para producción conviene moverlas a un servidor de imágenes y
        guardar solo el enlace.
      </p>
    </div>
  )
}
