/// La BarcodeDetector API (Shape Detection) todavía no está en las lib de
/// TypeScript. Se declara el subconjunto que usamos para no exigir `any` ni
/// romper el typecheck. Si el navegador no la implementa, el componente hace
/// fallback a escribir el código a mano.
interface DetectedBarcode {
  rawValue: string
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike
  getSupportedFormats?: () => Promise<string[]>
}

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor
  }
}

export {}
