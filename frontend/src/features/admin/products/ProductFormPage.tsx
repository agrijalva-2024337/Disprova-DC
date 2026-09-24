import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createProduct, getProduct, listCategories, updateProduct } from '../api/catalog.ts'
import { ApiError } from '../api/http.ts'
import { Alert, QueryStatus } from '../ui/Status.tsx'
import { productFormSchema, type ProductFormValues } from './productFormSchema.ts'

const emptyValues: ProductFormValues = {
  sku: '',
  nombre: '',
  descripcion: '',
  categoryId: 0,
  marca: '',
  unidadBase: '',
  controlado: false,
  activo: true,
  units: [{ nombre: '', factor: '1', codigoBarras: '', precioBase: '' }],
}

export function ProductFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const productId = id ? Number(id) : null
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: listCategories,
  })
  const productQuery = useQuery({
    queryKey: ['product', productId],
    queryFn: () => getProduct(productId!),
    enabled: isEdit && productId !== null && Number.isFinite(productId),
  })

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: emptyValues,
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'units',
  })

  useEffect(() => {
    if (!productQuery.data) {
      return
    }
    const product = productQuery.data
    form.reset({
      sku: product.sku,
      nombre: product.nombre,
      descripcion: product.descripcion ?? '',
      categoryId: product.categoryId,
      marca: product.marca ?? '',
      unidadBase: product.unidadBase,
      controlado: product.controlado,
      activo: product.activo,
      units:
        product.units.length > 0
          ? product.units.map((unit) => ({
              nombre: unit.nombre,
              factor: String(unit.factor),
              codigoBarras: unit.codigoBarras ?? '',
              precioBase: String(unit.precioBase),
            }))
          : emptyValues.units,
    })
  }, [form, productQuery.data])

  const saveMutation = useMutation({
    mutationFn: (values: ProductFormValues) => {
      const payload = {
        sku: values.sku,
        nombre: values.nombre,
        descripcion: values.descripcion || null,
        categoryId: values.categoryId,
        marca: values.marca || null,
        unidadBase: values.unidadBase,
        controlado: values.controlado,
        activo: values.activo,
        units: values.units.map((unit) => ({
          nombre: unit.nombre,
          factor: unit.factor,
          codigoBarras: unit.codigoBarras ? unit.codigoBarras : null,
          precioBase: unit.precioBase,
        })),
      }
      if (isEdit && productId) {
        return updateProduct(productId, payload)
      }
      return createProduct(payload)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] })
      if (productId) {
        await queryClient.invalidateQueries({ queryKey: ['product', productId] })
      }
      navigate('/admin/productos')
    },
  })

  const saveError =
    saveMutation.error instanceof ApiError
      ? saveMutation.error.message
      : saveMutation.isError
        ? 'No se pudo guardar el producto'
        : null

  if (isEdit && productQuery.isLoading) {
    return <QueryStatus isLoading loadingText="Cargando producto…" />
  }

  if (isEdit && productQuery.isError) {
    return (
      <Alert tone="error">
        {productQuery.error instanceof ApiError
          ? productQuery.error.message
          : 'No se pudo cargar el producto'}
      </Alert>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link to="/admin/productos" className="text-sm text-slate-600 hover:underline">
          ← Volver a productos
        </Link>
        <h1 className="mt-2 text-xl font-semibold">{isEdit ? 'Editar producto' : 'Nuevo producto'}</h1>
      </div>

      {categoriesQuery.isError ? (
        <Alert tone="error">
          {categoriesQuery.error instanceof ApiError
            ? categoriesQuery.error.message
            : 'No se pudieron cargar las categorías'}
        </Alert>
      ) : null}
      {saveError ? <Alert tone="error">{saveError}</Alert> : null}

      <form
        onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
        className="space-y-5 rounded-lg border border-slate-200 bg-white p-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">SKU</span>
            <input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" {...form.register('sku')} />
            {form.formState.errors.sku ? (
              <span className="text-xs text-red-700">{form.formState.errors.sku.message}</span>
            ) : null}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Nombre</span>
            <input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" {...form.register('nombre')} />
            {form.formState.errors.nombre ? (
              <span className="text-xs text-red-700">{form.formState.errors.nombre.message}</span>
            ) : null}
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium">Descripción</span>
            <textarea
              rows={2}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              {...form.register('descripcion')}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Categoría</span>
            <select className="w-full rounded border border-slate-300 px-3 py-2 text-sm" {...form.register('categoryId')}>
              <option value={0}>Selecciona…</option>
              {(categoriesQuery.data ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.nombre}
                </option>
              ))}
            </select>
            {form.formState.errors.categoryId ? (
              <span className="text-xs text-red-700">{form.formState.errors.categoryId.message}</span>
            ) : null}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Marca</span>
            <input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" {...form.register('marca')} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Unidad base</span>
            <input
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              {...form.register('unidadBase')}
            />
            {form.formState.errors.unidadBase ? (
              <span className="text-xs text-red-700">{form.formState.errors.unidadBase.message}</span>
            ) : null}
          </label>
          <div className="flex items-end gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" {...form.register('controlado')} />
              Controlado
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" {...form.register('activo')} />
              Activo
            </label>
          </div>
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Presentaciones</h2>
            <button
              type="button"
              onClick={() => append({ nombre: '', factor: '1', codigoBarras: '', precioBase: '' })}
              className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
            >
              Agregar presentación
            </button>
          </div>
          {form.formState.errors.units?.root ? (
            <p className="text-xs text-red-700">{form.formState.errors.units.root.message}</p>
          ) : null}
          {form.formState.errors.units?.message ? (
            <p className="text-xs text-red-700">{form.formState.errors.units.message}</p>
          ) : null}

          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="grid gap-3 rounded border border-slate-200 p-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Nombre</span>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    {...form.register(`units.${index}.nombre`)}
                  />
                  {form.formState.errors.units?.[index]?.nombre ? (
                    <span className="text-xs text-red-700">
                      {form.formState.errors.units[index]?.nombre?.message}
                    </span>
                  ) : null}
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Factor</span>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    {...form.register(`units.${index}.factor`)}
                  />
                  {form.formState.errors.units?.[index]?.factor ? (
                    <span className="text-xs text-red-700">
                      {form.formState.errors.units[index]?.factor?.message}
                    </span>
                  ) : null}
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Código de barras</span>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    {...form.register(`units.${index}.codigoBarras`)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Precio base</span>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    {...form.register(`units.${index}.precioBase`)}
                  />
                  {form.formState.errors.units?.[index]?.precioBase ? (
                    <span className="text-xs text-red-700">
                      {form.formState.errors.units[index]?.precioBase?.message}
                    </span>
                  ) : null}
                </label>
                {fields.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="justify-self-start text-sm text-red-700 hover:underline"
                  >
                    Quitar
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={saveMutation.isPending}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {saveMutation.isPending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear producto'}
        </button>
      </form>
    </div>
  )
}
