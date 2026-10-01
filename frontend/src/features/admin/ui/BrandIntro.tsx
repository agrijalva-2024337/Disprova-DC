import { useEffect, useRef, useState, type TransitionEvent } from 'react'
import { brandIntro } from '../../../shared/brand.ts'

/**
 * Intro de marca.
 *
 * Es el mismo video de public/brand que abre el catálogo público, reutilizado
 * acá para el ingreso al panel. Se salta sola si el navegador pide menos
 * movimiento, y un toque la cierra antes de que termine.
 */
const CLAVE = 'disprova-intro-panel'

function yaSalteada() {
  if (typeof window === 'undefined') {
    return true
  }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return true
  }
  return window.sessionStorage.getItem(CLAVE) === '1'
}

export function BrandIntro({
  onFinish,
  duracionMs = 2600,
}: {
  onFinish: () => void
  duracionMs?: number
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const cerrado = useRef(false)
  const [salida, setSalida] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) {
      return
    }
    video.muted = true
    void video.play().catch(() => {
      // Autoplay bloqueado: el temporizador de abajo la cierra igual.
    })
  }, [])

  // Red de seguridad: si el video no carga o el formato no es compatible en
  // este navegador, la intro no deja la pantalla bloqueada.
  useEffect(() => {
    const t = window.setTimeout(() => cerrar(), duracionMs)
    return () => window.clearTimeout(t)
  }, [duracionMs])

  function cerrar() {
    if (cerrado.current) {
      return
    }
    cerrado.current = true
    setSalida(true)
  }

  function alFundir(event: TransitionEvent<HTMLDivElement>) {
    if (event.propertyName !== 'opacity' || !salida) {
      return
    }
    window.sessionStorage.setItem(CLAVE, '1')
    onFinish()
  }

  return (
    <div
      onClick={cerrar}
      onTransitionEnd={alFundir}
      className={`fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-parchment transition-opacity duration-500 ${
        salida ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        poster={brandIntro.poster}
        muted
        autoPlay
        playsInline
        preload="auto"
        onEnded={cerrar}
        aria-hidden="true"
      >
        <source src={brandIntro.webm} type="video/webm" />
        <source src={brandIntro.mp4} type="video/mp4" />
      </video>
      <p className="absolute bottom-8 right-8 text-xs font-medium text-muted">Toca para continuar</p>
    </div>
  )
}

/** Decide si la intro corre en esta carga de página. */
export function useIntroInicial() {
  const [verIntro, setVerIntro] = useState(() => !yaSalteada())
  useEffect(() => {
    // Tras mostrarse una vez, no vuelve a estorbar en la misma pestaña.
    if (verIntro) {
      return
    }
    window.sessionStorage.setItem(CLAVE, '1')
  }, [verIntro])
  return { verIntro, setVerIntro }
}