import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { createZone, listZones, updateZone } from '../api/territory.ts'
import type { Zone } from '../api/types.ts'
import { ApiError } from '../api/http.ts'
import { Alert, QueryStatus } from '../ui/Status.tsx'

const DAY_OPTIONS = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 7, label: 'Dom' },
]

function dayLabels(days: number[]) {
  return DAY_OPTIONS.filter((day) => days.includes(day.value))
    .map((day) => day.label)
    .join(', ')
}

export function ZonesPage() {
  const queryClient = useQueryClient()
  const zonesQuery = useQuery({ queryKey: ['zones'], queryFn: listZones })
  const [editing, setEditing] = useState<Zone | null>(null)
  const [nombre, setNombre] = useState('')
  const [semanaMes, setSemanaMes] = useState('1')
  const [dias, setDias] = useState<number[]>([1])
  const [activo, setActivo] = useState(true)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)

  function loadZone(zone: Zone | null) {
    setEditing(zone)
    setNombre(zone?.nombre ?? '')
    setSemanaMes(String(zone?.semanaMes ?? 1))
    setDias(zone?.diasSemana ?? [1])
    setActivo(zone?.activo ?? true)
    setFormError(null)
    setFormSuccess(null)
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const input = {
        nombre: nombre.trim(),
        semanaMes: Number(semanaMes),
        diasSemana: [...dias].sort((a, b) => a - b),
        activo,
      }
      return editing ? updateZone(editing.id, input) : createZone(input)
    },
    onSuccess: async () => {
      const message = editing ? 'Zona actualizada' : 'Zona creada'
      loadZone(null)
      setFormError(null)
      setFormSuccess(message)
      await queryClient.invalidateQueries({ queryKey: ['zones'] })
    },
    onError: (err) => {
      setFormSuccess(null)
      setFormError(err instanceof ApiError ? err.message : 'No se pudo guardar la zona')
    },
  })

  function toggleDay(day: number) {
    setDias((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day],
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Zonas</h1>
        <p className="text-sm text-slate-600">Semana del mes y días de visita de cada ruta.</p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (dias.length === 0) {
            setFormError('Elige al menos un día')
            return
          }
          setFormError(null)
          saveMutation.mutate()
        }}
        className="max-w-xl space-y-3 rounded-lg border border-slate-200 bg-white p-4"
      >
        <h2 className="text-sm font-semibold">{editing ? `Editar ${editing.nombre}` : 'Nueva zona'}</h2>
        {formError ? <Alert tone="error">{formError}</Alert> : null}
        {formSuccess ? <Alert tone="success">{formSuccess}</Alert> : null}
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Nombre</span>
          <input
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Semana del mes</span>
          <select
            value={semanaMes}
            onChange={(event) => setSemanaMes(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="1">Semana 1</option>
            <option value="2">Semana 2</option>
            <option value="3">Semana 3</option>
            <option value="4">Semana 4</option>
          </select>
        </label>
        <fieldset className="text-sm">
          <legend className="mb-1 font-medium">Días</legend>
          <div className="flex flex-wrap gap-3">
            {DAY_OPTIONS.map((day) => (
              <label key={day.value} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={dias.includes(day.value)}
                  onChange={() => toggleDay(day.value)}
                />
                {day.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={activo} onChange={(event) => setActivo(event.target.checked)} />
          Activa
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saveMutation.isPending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear zona'}
          </button>
          {editing ? (
            <button type="button" onClick={() => loadZone(null)} className="rounded border border-slate-300 px-4 py-2 text-sm">
              Cancelar
            </button>
          ) : null}
        </div>
      </form>

      <QueryStatus
        isLoading={zonesQuery.isLoading}
        errorMessage={
          zonesQuery.isError
            ? zonesQuery.error instanceof ApiError
              ? zonesQuery.error.message
              : 'No se pudieron cargar las zonas'
            : null
        }
      />

      {(zonesQuery.data ?? []).length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Semana</th>
                <th className="px-3 py-2 font-medium">Días</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(zonesQuery.data ?? []).map((zone) => (
                <tr key={zone.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{zone.nombre}</td>
                  <td className="px-3 py-2">{zone.semanaMes}</td>
                  <td className="px-3 py-2">{dayLabels(zone.diasSemana)}</td>
                  <td className="px-3 py-2">{zone.activo ? 'Activa' : 'Inactiva'}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => loadZone(zone)}
                      className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
