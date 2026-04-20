import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import type { SolicitudDetalle, SolicitudDetalleInsert } from '../types/solicitud'
import { getDetallesBySolicitud, createDetalle, updateDetalle, deleteDetalle } from '../services/solicitudService'

interface Props {
  solicitudId: number
  open: boolean
  onClose: () => void
}

export default function SolicitudDetalleEditor({ solicitudId, open, onClose }: Props) {
  const [detalles, setDetalles] = useState<SolicitudDetalle[]>([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const [cantidad, setCantidad] = useState<number>(1)
  const [descripcion, setDescripcion] = useState('')
  const [valor_unitario, setValorUnitario] = useState<number>(0)

  useEffect(() => {
    if (!open) return
    fetchDetalles()
    resetForm()
  }, [open])

  const fetchDetalles = async () => {
    setLoading(true)
    try {
      const data = await getDetallesBySolicitud(solicitudId)
      setDetalles(data)
    } catch (err: any) {
      toast.error(err?.message ?? 'Error al cargar detalles')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setDescripcion('')
    setCantidad(1)
    setValorUnitario(0)
    setEditingId(null)
  }

  const addOrUpdate = async () => {
    if (!descripcion.trim()) {
      toast.error('La descripción es requerida')
      return
    }
    if (cantidad <= 0) {
      toast.error('La cantidad debe ser mayor a 0')
      return
    }
    if (valor_unitario < 0) {
      toast.error('El valor unitario no puede ser negativo')
      return
    }

    try {
      if (editingId) {
        // Update existing
        const updated = await updateDetalle(editingId, { cantidad, descripcion, valor_unitario })
        setDetalles((d) => d.map((x) => (x.id === editingId ? updated : x)))
        toast.success('Detalle actualizado')
      } else {
        // Create new
        const payload: SolicitudDetalleInsert = { solicitud_id: solicitudId, cantidad, descripcion, valor_unitario }
        const nuevo = await createDetalle(payload)
        setDetalles((d) => [nuevo, ...d])
        toast.success('Detalle agregado')
      }
      resetForm()
    } catch (err: any) {
      toast.error(err?.message ?? `Error al ${editingId ? 'actualizar' : 'agregar'} detalle`)
    }
  }

  const edit = (detalle: SolicitudDetalle) => {
    setCantidad(detalle.cantidad)
    setDescripcion(detalle.descripcion)
    setValorUnitario(detalle.valor_unitario)
    setEditingId(detalle.id)
  }

  const remove = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este detalle?')) return
    try {
      await deleteDetalle(id)
      setDetalles((d) => d.filter((x) => x.id !== id))
      if (editingId === id) resetForm()
      toast.success('Detalle eliminado')
    } catch (err: any) {
      toast.error(err?.message ?? 'Error al eliminar detalle')
    }
  }

  const calcularTotal = () => {
    return detalles.reduce((sum, d) => sum + (d.valor_total ?? d.cantidad * d.valor_unitario), 0)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 border-b border-gray-200 bg-gradient-to-r from-[#003D7D] to-[#0056a3] px-6 py-4 rounded-t-xl">
          <h3 className="text-xl font-semibold text-white">
            Detalles de la solicitud #{solicitudId}
          </h3>
          <p className="mt-1 text-sm text-blue-100">Gestiona los productos o servicios solicitados</p>
        </div>

        {/* Formulario */}
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-5">
          <div className="grid grid-cols-12 gap-3 items-end">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-700">Cantidad</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#003D7D] focus:outline-none focus:ring-1 focus:ring-[#003D7D]"
                type="number"
                min="0.01"
                step="0.01"
                value={cantidad}
                onChange={(e) => setCantidad(Number(e.target.value))}
              />
            </div>
            <div className="col-span-6">
              <label className="mb-1 block text-xs font-medium text-gray-700">Descripción</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#003D7D] focus:outline-none focus:ring-1 focus:ring-[#003D7D]"
                placeholder="Ej: Laptop HP, Servicio de instalación, etc."
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addOrUpdate()}
              />
            </div>
            <div className="col-span-3">
              <label className="mb-1 block text-xs font-medium text-gray-700">Valor unitario</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  className="w-full rounded-lg border border-gray-300 py-2 pl-7 pr-3 text-sm focus:border-[#003D7D] focus:outline-none focus:ring-1 focus:ring-[#003D7D]"
                  type="number"
                  min="0"
                  step="0.01"
                  value={valor_unitario}
                  onChange={(e) => setValorUnitario(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="col-span-1">
              <button
                className="h-10 w-full rounded-lg bg-[#003D7D] font-medium text-white transition-all hover:bg-[#002a5a] focus:outline-none focus:ring-2 focus:ring-[#003D7D] focus:ring-offset-2"
                onClick={addOrUpdate}
              >
                {editingId ? 'Actualizar' : 'Agregar'}
              </button>
            </div>
          </div>
          {editingId && (
            <div className="mt-3 flex justify-end">
              <button
                className="text-sm text-gray-500 hover:text-gray-700"
                onClick={resetForm}
              >
                Cancelar edición
              </button>
            </div>
          )}
        </div>

        {/* Tabla de detalles */}
        <div className="px-6 py-5">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-700">
              Lista de detalles ({detalles.length})
            </h4>
            {loading && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#003D7D] border-t-transparent"></div>
                Cargando...
              </div>
            )}
          </div>

          <div className="max-h-96 overflow-auto rounded-lg border border-gray-200">
            {!loading && detalles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <svg className="mb-3 h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm text-gray-500">No hay detalles registrados</p>
                <p className="mt-1 text-xs text-gray-400">Agrega productos o servicios usando el formulario</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Descripción</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Cantidad</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Valor unitario</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {detalles.map((d, i) => (
                    <tr key={d.id} className="transition-colors hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{i + 1}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{d.descripcion}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-900">{d.cantidad}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-900">
                        ${d.valor_unitario.toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-[#003D7D]">
                        ${(d.valor_total ?? d.cantidad * d.valor_unitario).toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                        <button
                          className="mr-2 text-blue-600 transition-colors hover:text-blue-800"
                          onClick={() => edit(d)}
                        >
                          Editar
                        </button>
                        <button
                          className="text-red-600 transition-colors hover:text-red-800"
                          onClick={() => remove(d.id)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                      Total general:
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-lg font-bold text-[#003D7D]">
                      ${calcularTotal().toLocaleString()}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 rounded-b-xl">
          <button
            className="rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D] focus:ring-offset-2"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}