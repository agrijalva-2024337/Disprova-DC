import { useRef, useState } from 'react'

/**
 * Botón "Escanear" que abre la cámara y lee un código de barras con la
 * BarcodeDetector API nativa del navegador. No agrega dependencias: funciona
 * en Chrome/Edge (incluido Android, que es lo que usa el repartor). Si el
 * navegador no la soporta o no da permiso de cámara, avisa y deja escribir el
 * código a mano en el campo de texto de al lado.
 *
 * `onDetected` recibe el código ya leído para que el formulario lo ponga en el
 * input. Tras la primera lectura válida se cierra la cámara solo.
 */
export function BarcodeScannerButton({ onDetected }: { onDetected: (codigo: string) => void }) {
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)

  function detener() {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  function cerrar() {
    detener()
    setAbierto(false)
    setError(null)
  }

  async function abrir() {
    setError(null)
    const Ctor = window.BarcodeDetector
    if (!Ctor) {
      setError('Este navegador no permite escanear con la cámara. Escribí el código a mano.')
      setAbierto(true)
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('No se pudo acceder a la cámara. Escribí el código a mano.')
      setAbierto(true)
      return
    }

    setAbierto(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      // El <video> se monta al poner abierto=true, pero el ref puede no estar
      // listo en el mismo tick: se espera al siguiente frame antes de asignar.
      requestAnimationFrame(async () => {
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play().catch(() => undefined)

        const detector = new Ctor({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'],
        })
        const leer = async () => {
          if (!videoRef.current || video.readyState < 2) {
            frameRef.current = requestAnimationFrame(leer)
            return
          }
          try {
            const codigos = await detector.detect(video)
            if (codigos.length > 0 && codigos[0].rawValue) {
              onDetected(codigos[0].rawValue)
              cerrar()
              return
            }
          } catch {
            // Un frame fallido no detiene el escaneo: se reintenta en el siguiente.
          }
          frameRef.current = requestAnimationFrame(leer)
        }
        frameRef.current = requestAnimationFrame(leer)
      })
    } catch (err) {
      const nombre = err instanceof DOMException ? err.name : ''
      if (nombre === 'NotAllowedError') {
        setError('Permiso de cámara denegado. Habilitarlo o escribir el código a mano.')
      } else if (nombre === 'NotFoundError' || nombre === 'OverconstrainedError') {
        setError('No se encontró una cámara disponible. Escribí el código a mano.')
      } else {
        setError('No se pudo abrir la cámara. Escribí el código a mano.')
      }
      detener()
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="mt-1 rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
      >
        Escanear con cámara
      </button>

      {abierto ? (
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-black/80 p-4"
          onClick={cerrar}
        >
          <div onClick={(event) => event.stopPropagation()} className="w-full max-w-md">
            {error ? (
              <div className="rounded bg-white p-5 text-center text-sm text-slate-800">
                <p className="mb-4">{error}</p>
                <button
                  type="button"
                  onClick={cerrar}
                  className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  className="w-full rounded bg-black"
                  playsInline
                  muted
                  autoPlay
                />
                <p className="mt-3 text-center text-sm text-white">
                  Apuntá la cámara al código de barras.
                </p>
                <button
                  type="button"
                  onClick={cerrar}
                  className="mx-auto mt-3 block rounded bg-white px-4 py-2 text-sm font-medium text-slate-900"
                >
                  Cancelar
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
