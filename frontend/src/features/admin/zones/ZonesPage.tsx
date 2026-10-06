import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { createZone, listZones, updateZone } from '../api/territory.ts'
import type { Zone } from '../api/types.ts'
import { ApiError } from '../api/http.ts'
import { AddButton, ModuleHead, SearchBox } from '../ui/ListTools.tsx'
import { ConfirmDialog } from '../ui/ConfirmDialog.tsx'
import { Modal } from '../ui/Modal.tsx'
import { Alert, QueryStatus } from '../ui/Status.tsx'
import { RecordSheet, RowMoves } from '../ui/RecordSheet.tsx'
import { useToast } from '../ui/Toast.tsx'

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
  const [visto, setVisto] = useState<Zone | null>(null)
  const [nombre, setNombre] = useState('')
  const [semanaMes, setSemanaMes] = useState('1')
  const [dias, setDias] = useState<number[]>([1])
  const [activo, setActivo] = useState(true)
  const [formError, setFormError] = useState<string | null>(null)
  const [formulario, setFormulario] = useState(false)
  const [base, setBase] = useState({ nombre: '', semanaMes: '1', dias: '1', activo: true })
  const [aDeshabilitar, setADeshabilitar] = useState<Zone | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const avisos = useToast()

  function loadZone(zone: Zone | null) {
    const valores = {
      nombre: zone?.nombre ?? '',
      semanaMes: String(zone?.semanaMes ?? 1),
      dias: (zone?.diasSemana ?? [1]).slice().sort((a, b) => a - b).join(','),
      activo: zone?.activo ?? true,
    }
    setEditing(zone)
    setNombre(valores.nombre)
    setSemanaMes(valores.semanaMes)
    setDias(zone?.diasSemana ?? [1])
    setActivo(valores.activo)
    setBase(valores)
    setFormError(null)
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
      const eraEdicion = editing !== null
      loadZone(null)
      setFormulario(false)
      setFormError(null)
      avisos.ok(eraEdicion ? 'Zona actualizada' : 'Zona agregada')
      await queryClient.invalidateQueries({ queryKey: ['zones'] })
    },
    onError: (err) => {
      const mensaje = err instanceof ApiError ? err.message : 'No se pudo guardar la zona'
      setFormError(mensaje)
      avisos.error(mensaje)
    },
  })

  function toggleDay(day: number) {
    setDias((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day],
    )
  }

  return (
    <div className="space-y-6">
      <ModuleHead
        title="Zonas"
        text="Semana del mes y días de visita de cada ruta."
        action={
          <AddButton
            onOpen={() => {
              loadZone(null)
              setFormulario(true)
            }}
          >
            Agregar zona
          </AddButton>
        }
      />
      <SearchBox value={busqueda} onChange={setBusqueda} placeholder="Buscar zona" />

      {formulario ? (
      <Modal
        title={editing ? 'Editar zona' : 'Agregar zona'}
        formId="zona-form"
        saving={saveMutation.isPending}
        dirty={
          nombre !== base.nombre ||
          semanaMes !== base.semanaMes ||
          [...dias].sort((a, b) => a - b).join(',') !== base.dias ||
          activo !== base.activo
        }
        onClose={() => {
          loadZone(null)
          setFormulario(false)
        }}
      >
      <form
        id="zona-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (dias.length === 0) {
            setFormError('Elige al menos un día')
            return
          }
          setFormError(null)
          saveMutation.mutate()
        }}
        className="space-y-3"
      >
        {formError ? <Alert tone="error">{formError}</Alert> : null}
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
      </form>
      </Modal>
      ) : null}

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
        <div className="registros">
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
              {(zonesQuery.data ?? [])
                .filter((zone) => zone.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()))
                .map((zone) => (
                <tr
                  key={zone.id}
                  className="cursor-pointer border-t border-slate-100"
                  onDoubleClick={() => setVisto(zone)}
                >
                  <td className="px-3 py-2">{zone.nombre}</td>
                  <td className="px-3 py-2">{zone.semanaMes}</td>
                  <td className="px-3 py-2">{dayLabels(zone.diasSemana)}</td>
                  <td className="px-3 py-2">{zone.activo ? 'Activa' : 'Inactiva'}</td>
                  <td className="px-3 py-2">
                    <RowMoves
                      onView={() => setVisto(zone)}
                      onEdit={() => {
                        loadZone(zone)
                        setFormulario(true)
                      }}
                      onDisable={zone.activo ? () => setADeshabilitar(zone) : undefined}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {visto ? (
        <RecordSheet title={visto.nombre} onClose={() => setVisto(null)}>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Semana</dt>
              <dd>{visto.semanaMes}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Días</dt>
              <dd>{dayLabels(visto.diasSemana)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Estado</dt>
              <dd>{visto.activo ? 'Activa' : 'Inactiva'}</dd>
            </div>
          </dl>
        </RecordSheet>
      ) : null}
      {aDeshabilitar ? (
        <ConfirmDialog
          title="Deshabilitar zona"
          confirmLabel="Deshabilitar"
          onClose={() => setADeshabilitar(null)}
          onConfirm={() => {
            const zone = aDeshabilitar
            updateZone(zone.id, {
              nombre: zone.nombre,
              semanaMes: zone.semanaMes,
              diasSemana: zone.diasSemana,
              activo: false,
            })
              .then(async () => {
                setADeshabilitar(null)
                avisos.ok('Zona deshabilitada')
                await queryClient.invalidateQueries({ queryKey: ['zones'] })
              })
              .catch((err) => {
                avisos.error(err instanceof ApiError ? err.message : 'No se pudo deshabilitar la zona')
              })
          }}
        >
          {aDeshabilitar.nombre} deja de usarse en la ruta. No se borra.
        </ConfirmDialog>
      ) : null}
    </div>
  )
}
