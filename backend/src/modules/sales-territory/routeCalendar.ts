export type RouteCalendar = {
  semanaMes: number;
  diaSemana: number;
  fecha: Date;
};

/** Semana del mes 1-4 (los días 29-31 siguen en la semana 4) y día ISO (lunes = 1). */
export function routeCalendar(now = new Date()): RouteCalendar {
  const diaSemana = now.getDay() === 0 ? 7 : now.getDay();
  const semanaMes = Math.min(4, Math.ceil(now.getDate() / 7));
  const fecha = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  return { semanaMes, diaSemana, fecha };
}
