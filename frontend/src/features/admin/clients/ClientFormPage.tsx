import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { listPriceLists } from '../api/catalog.ts'
import { ApiError } from '../api/http.ts'
import {
  createClient,
  createContact,
  deleteContact,
  getClient,
  listZones,
  updateClient,
  updateContact,
} from '../api/territory.ts'
import { Alert, QueryStatus } from '../ui/Status.tsx'
import { clientFormSchema, type ClientFormValues } from './clientFormSchema.ts'

const emptyContact = {
  nombre: '',
  telefono: '',
  esWhatsapp: false,
  aceptaMensajes: false,
  esPrincipal: true,
}

const emptyValues: ClientFormValues = {
  nombreComercial: '',
  nit: '',
  tipoNegocio: 'tienda',
  zoneId: 0,
  ordenRuta: 1,
  direccion: '',
  priceListId: 0,
  limiteCredito: '0',
  plazoDias: 0,
  activo: true,
  contacts: [emptyContact],
}

export function ClientFormPage() {
  const { id } = useParams()
  const clientId = id ? Number(id) : null
  const isEdit = clientId !== null
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const zonesQuery = useQuery({ queryKey: ['zones'], queryFn: listZones })
  const listsQuery = useQuery({ queryKey: ['price-lists'], queryFn: listPriceLists })
  const clientQuery = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => getClient(clientId!),
    enabled: isEdit,
  })

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: emptyValues,
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'contacts' })

  useEffect(() => {
    if (!clientQuery.data) {
      return
    }
    const client = clientQuery.data
    form.reset({
      nombreComercial: client.nombreComercial,
      nit: client.nit ?? '',
      tipoNegocio: client.tipoNegocio,
      zoneId: client.zoneId,
      ordenRuta: client.ordenRuta,
      direccion: client.direccion,
      priceListId: client.priceListId,
      limiteCredito: String(client.limiteCredito),
      plazoDias: client.plazoDias,
      activo: client.activo,
      contacts:
        (client.contacts ?? []).length > 0
          ? client.contacts!.map((contact) => ({
              id: contact.id,
              nombre: contact.nombre,
              telefono: contact.telefono,
              esWhatsapp: contact.esWhatsapp,
              aceptaMensajes: contact.aceptaMensajes,
              esPrincipal: contact.esPrincipal,
            }))
          : [emptyContact],
    })
  }, [clientQuery.data, form])

  const saveMutation = useMutation({
    mutationFn: async (values: ClientFormValues) => {
      const payload = {
        nombreComercial: values.nombreComercial,
        nit: values.nit?.trim() ? values.nit.trim() : null,
        tipoNegocio: values.tipoNegocio,
        zoneId: values.zoneId,
        ordenRuta: values.ordenRuta,
        direccion: values.direccion,
        priceListId: values.priceListId,
        limiteCredito: values.limiteCredito,
        plazoDias: values.plazoDias,
        activo: values.activo,
      }
      const saved = isEdit && clientId ? await updateClient(clientId, payload) : await createClient(payload)
      const existingIds = new Set((clientQuery.data?.contacts ?? []).map((contact) => contact.id))
      const keptIds = new Set<number>()

      const ordered = [...values.contacts].sort((a, b) => Number(b.esPrincipal) - Number(a.esPrincipal))
      for (const contact of ordered) {
        const body = {
          nombre: contact.nombre,
          telefono: contact.telefono,
          esWhatsapp: contact.esWhatsapp,
          aceptaMensajes: contact.aceptaMensajes,
          esPrincipal: contact.esPrincipal,
        }
        if (contact.id) {
          keptIds.add(contact.id)
          await updateContact(saved.id, contact.id, body)
        } else {
          await createContact(saved.id, body)
        }
      }

      for (const contactId of existingIds) {
        if (!keptIds.has(contactId)) {
          await deleteContact(saved.id, contactId)
        }
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['clients'] })
      navigate('/admin/clientes')
    },
  })

  function markPrincipal(index: number) {
    const contacts = form.getValues('contacts')
    contacts.forEach((_, contactIndex) => {
      form.setValue(`contacts.${contactIndex}.esPrincipal`, contactIndex === index)
    })
  }

  if (isEdit && clientQuery.isLoading) {
    return <QueryStatus isLoading loadingText="Cargando cliente…" />
  }

  if (isEdit && clientQuery.isError) {
    return (
      <Alert tone="error">
        {clientQuery.error instanceof ApiError ? clientQuery.error.message : 'No se pudo cargar el cliente'}
      </Alert>
    )
  }

  const saveError =
    saveMutation.error instanceof ApiError
      ? saveMutation.error.message
      : saveMutation.isError
        ? 'No se pudo guardar el cliente'
        : null

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link to="/admin/clientes" className="text-sm text-slate-600 hover:underline">
          ← Volver a clientes
        </Link>
        <h1 className="mt-2 text-xl font-semibold">{isEdit ? 'Editar cliente' : 'Nuevo cliente'}</h1>
      </div>
      {saveError ? <Alert tone="error">{saveError}</Alert> : null}
      <form
        onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
        className="space-y-5 rounded-lg border border-slate-200 bg-white p-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium">Nombre comercial</span>
            <input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" {...form.register('nombreComercial')} />
            {form.formState.errors.nombreComercial ? (
              <span className="text-xs text-red-700">{form.formState.errors.nombreComercial.message}</span>
            ) : null}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">NIT</span>
            <input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" {...form.register('nit')} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Tipo de negocio</span>
            <select className="w-full rounded border border-slate-300 px-3 py-2 text-sm" {...form.register('tipoNegocio')}>
              <option value="tienda">Tienda</option>
              <option value="farmacia">Farmacia</option>
              <option value="mercado">Mercado</option>
              <option value="otro">Otro</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Zona</span>
            <select className="w-full rounded border border-slate-300 px-3 py-2 text-sm" {...form.register('zoneId')}>
              <option value={0}>Selecciona…</option>
              {(zonesQuery.data ?? []).map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.nombre}
                </option>
              ))}
            </select>
            {form.formState.errors.zoneId ? (
              <span className="text-xs text-red-700">{form.formState.errors.zoneId.message}</span>
            ) : null}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Orden en la ruta</span>
            <input type="number" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" {...form.register('ordenRuta')} />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium">Dirección</span>
            <input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" {...form.register('direccion')} />
            {form.formState.errors.direccion ? (
              <span className="text-xs text-red-700">{form.formState.errors.direccion.message}</span>
            ) : null}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Lista de precios</span>
            <select className="w-full rounded border border-slate-300 px-3 py-2 text-sm" {...form.register('priceListId')}>
              <option value={0}>Selecciona…</option>
              {(listsQuery.data ?? []).map((list) => (
                <option key={list.id} value={list.id}>
                  {list.nombre}
                </option>
              ))}
            </select>
            {form.formState.errors.priceListId ? (
              <span className="text-xs text-red-700">{form.formState.errors.priceListId.message}</span>
            ) : null}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Límite de crédito</span>
            <input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" {...form.register('limiteCredito')} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Plazo (días)</span>
            <input type="number" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" {...form.register('plazoDias')} />
          </label>
          <label className="flex items-end gap-2 text-sm">
            <input type="checkbox" {...form.register('activo')} />
            Activo
          </label>
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Contactos</h2>
            <button
              type="button"
              onClick={() =>
                append({ nombre: '', telefono: '', esWhatsapp: false, aceptaMensajes: false, esPrincipal: false })
              }
              className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
            >
              Agregar contacto
            </button>
          </div>
          {form.formState.errors.contacts?.message ? (
            <p className="text-xs text-red-700">{form.formState.errors.contacts.message}</p>
          ) : null}
          {fields.map((field, index) => (
            <div key={field.id} className="grid gap-3 rounded border border-slate-200 p-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Nombre</span>
                <input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" {...form.register(`contacts.${index}.nombre`)} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Teléfono</span>
                <input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" {...form.register(`contacts.${index}.telefono`)} />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...form.register(`contacts.${index}.esWhatsapp`)} />
                WhatsApp
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...form.register(`contacts.${index}.aceptaMensajes`)} />
                Acepta mensajes
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  {...form.register(`contacts.${index}.esPrincipal`)}
                  onChange={() => markPrincipal(index)}
                />
                Principal
              </label>
              {fields.length > 1 ? (
                <button type="button" onClick={() => remove(index)} className="justify-self-start text-sm text-red-700 hover:underline">
                  Quitar
                </button>
              ) : null}
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={saveMutation.isPending}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {saveMutation.isPending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear cliente'}
        </button>
      </form>
    </div>
  )
}
