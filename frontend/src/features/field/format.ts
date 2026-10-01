/** Utilidades de formato para las pantallas de campo (se usan en el teléfono). */

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

/** El backend usa día ISO: lunes = 1, domingo = 7. */
export function nombreDia(diaSemana: number): string {
  return DIAS[diaSemana - 1] ?? ''
}

export function nombreDiaCorto(diaSemana: number): string {
  const nombre = nombreDia(diaSemana)
  return nombre ? nombre.slice(0, 3) : ''
}

export function quetzales(valor: number | string): string {
  const numero = Number(valor)
  if (Number.isNaN(numero)) {
    return 'Q 0.00'
  }
  return `Q ${numero.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** "2026-09-29" -> "martes 29 de septiembre". */
export function fechaLarga(iso: string): string {
  // Se arma en UTC a propósito: el backend manda la fecha del calendario de
  // ruta en UTC, y parsearla como local la retrocede un día.
  const [anio, mes, dia] = iso.split('-').map(Number)
  if (!anio || !mes || !dia) {
    return iso
  }
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  const diaSemana = fecha.getUTCDay() === 0 ? 7 : fecha.getUTCDay()
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ]
  return `${nombreDia(diaSemana).toLowerCase()} ${dia} de ${meses[mes - 1]}`
}

/**
 * Próxima fecha en la que la zona toca visita, a partir de hoy.
 *
 * El calendario de ruta divide el mes en cuatro semanas (`semanaMes`) y cada
 * zona visita en una de ellas. Cuando hoy no toca, el vendedor no puede
 * quedarse sin saber cuándo vuelve: esto le dice el próximo día.
 */
export function proximaVisita(zona: { semanaMes: number; diasSemana: number[] }): string | null {
  const hoy = new Date()

  for (let salto = 0; salto < 35; salto += 1) {
    const dia = new Date(hoy)
    dia.setDate(hoy.getDate() + salto)
    const diaSemana = dia.getDay() === 0 ? 7 : dia.getDay()
    const semana = Math.min(4, Math.ceil(dia.getDate() / 7))
    if (semana === zona.semanaMes && zona.diasSemana.includes(diaSemana)) {
      const etiqueta = salto === 0 ? 'hoy' : salto === 1 ? 'mañana' : `en ${salto} días`
      return `${nombreDia(diaSemana)} ${dia.getDate()} (${etiqueta})`
    }
  }
  return null
}

/** Rango de fechas de una semana del mes, para explicarle el calendario. */
export function rangoSemana(semanaMes: number): string {
  const inicio = (semanaMes - 1) * 7 + 1
  const fin = Math.min(30, inicio + 6)
  return `${inicio}–${fin}`
}