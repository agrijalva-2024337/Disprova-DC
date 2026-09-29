import { useEffect, useRef, useState, type TransitionEvent } from 'react'
import styles from './catalog.module.css'

export function BrandIntro({ onFinish }: { onFinish: () => void }) {
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
      // Si el navegador bloquea el autoplay, el toque igual cierra la intro.
    })
  }, [])

  function cerrar() {
    if (cerrado.current) {
      return
    }
    cerrado.current = true
    setSalida(true)
  }

  function alFundir(event: TransitionEvent<HTMLButtonElement>) {
    if (event.propertyName !== 'opacity' || !salida) {
      return
    }
    onFinish()
  }

  return (
    <button
      type="button"
      className={`${styles.intro} ${salida ? styles.introOut : ''} font-body`}
      onClick={cerrar}
      onTransitionEnd={alFundir}
    >
      <video
        ref={videoRef}
        className={styles.introVideo}
        poster="/brand/logo-reveal-poster.jpg"
        muted
        autoPlay
        playsInline
        preload="auto"
        onEnded={cerrar}
        aria-hidden="true"
      >
        <source src="/brand/logo-reveal.webm" type="video/webm" />
        <source src="/brand/logo-reveal.mp4" type="video/mp4" />
      </video>
      <p className={styles.introHint}>Toca para continuar</p>
    </button>
  )
}
