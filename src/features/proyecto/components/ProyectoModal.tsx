import { useEffect, useState } from 'react'
import { X, Save, FolderOpen } from 'lucide-react'
import type { Proyecto, ProyectoInsert } from '../types/proyecto'

interface Props {
  open: boolean
  proyecto?: Proyecto | null
  onClose: () => void
  onSubmit: (data: ProyectoInsert) => Promise<unknown>
}

const EMPTY: ProyectoInsert = {
  codigo: '', nombre: '', descripcion: null,
  presupuesto: null, fecha_inicio: null, fecha_fin: null, estado: 'Activo', ruc: null, direccion: null,
  usuario_creador: null,
}

export default function ProyectoModal({ open, proyecto, onClose, onSubmit }: Props) {
  const [form,    setForm]    = useState<ProyectoInsert>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [errors,  setErrors]  = useState<Partial<Record<keyof ProyectoInsert, string>>>({})

  const isEdit = Boolean(proyecto)

  useEffect(() => {
    if (proyecto) {
      setForm({
        codigo: proyecto.codigo ?? '', nombre: proyecto.nombre,
        descripcion: proyecto.descripcion ?? null, presupuesto: proyecto.presupuesto ?? null,
        fecha_inicio: proyecto.fecha_inicio ?? null, fecha_fin: proyecto.fecha_fin ?? null,
        estado: proyecto.estado ?? 'Activo', ruc: proyecto.ruc ?? null, direccion: proyecto.direccion ?? null,
        usuario_creador: proyecto.usuario_creador ?? null,
      })
    } else {
      setForm(EMPTY)
    }
    setErrors({})
  }, [proyecto, open])

  const set = (key: keyof ProyectoInsert, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }))

  const validate = (): boolean => {
    const e: typeof errors = {}
    if (!form.codigo?.toString().trim())      e.codigo  = 'El código es obligatorio.'
    if (form.codigo.length > 10)  e.codigo  = 'Máximo 10 caracteres.'
    if (!form.nombre.trim())      e.nombre  = 'El nombre es obligatorio.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await onSubmit({ ...form, presupuesto: form.presupuesto !== null ? Number(form.presupuesto) : null })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const inputCls = (err?: string) =>
    `w-full rounded-xl border ${err ? 'border-[#F65740]/60 focus:ring-[#F65740]/30' : 'border-gray-200 focus:ring-[#003D7D]/20 focus:border-[#003D7D]/40'}
     bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400
     focus:outline-none focus:ring-2 focus:bg-white transition-all`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#003D7D]/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-[slideUp_.4s_cubic-bezier(.16,1,.3,1)_both]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#003D7D]">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
              <FolderOpen size={16} className="text-white" />
            </div>
            <h2 className="font-semibold text-white text-lg">
              {isEdit ? 'Editar proyecto' : 'Nuevo proyecto'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="h-0.5 bg-gradient-to-r from-[#F65740] via-[#F65740]/60 to-transparent" />

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Código *</label>
              <input className={inputCls(errors.codigo) + ' font-mono uppercase'}
                value={form.codigo} maxLength={10} placeholder="PRY-001"
                onChange={(e) => set('codigo', e.target.value.toUpperCase())} />
              {errors.codigo && <p className="mt-1 text-xs text-[#F65740]">{errors.codigo}</p>}
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Nombre *</label>
              <input className={inputCls(errors.nombre)}
                value={form.nombre} maxLength={150} placeholder="Nombre del proyecto"
                onChange={(e) => set('nombre', e.target.value)} />
              {errors.nombre && <p className="mt-1 text-xs text-[#F65740]">{errors.nombre}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Descripción</label>
            <textarea className={inputCls() + ' resize-none'} rows={3}
              value={form.descripcion ?? ''} placeholder="Descripción opcional…"
              onChange={(e) => set('descripcion', e.target.value || null)} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Presupuesto (S/)</label>
            <input className={inputCls(errors.presupuesto)} type="number" min="0" step="0.01"
              value={form.presupuesto ?? ''} placeholder="0.00"
              onChange={(e) => set('presupuesto', e.target.value ? Number(e.target.value) : null)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Fecha inicio</label>
              <input className={inputCls()} type="date" value={form.fecha_inicio ?? ''}
                onChange={(e) => set('fecha_inicio', e.target.value || null)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Fecha fin</label>
                <input className={inputCls()} type="date" value={form.fecha_fin ?? ''}
                  onChange={(e) => set('fecha_fin', e.target.value || null)} />
            </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">RUC</label>
                <input className={inputCls()} value={form.ruc ?? ''} onChange={(e) => set('ruc', e.target.value || null)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Dirección</label>
                <input className={inputCls()} value={form.direccion ?? ''} onChange={(e) => set('direccion', e.target.value || null)} />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <label className="text-sm text-gray-700">Estado</label>
              <select className="h-8 rounded border px-2" value={form.estado ?? 'Activo'} onChange={(e) => set('estado', e.target.value || null)}>
                <option>Activo</option>
                <option>Inactivo</option>
              </select>
            </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition-all">
            Cancelar
          </button>
          <button onClick={handleSubmit as unknown as React.MouseEventHandler} disabled={loading}
            className="px-4 py-2 rounded-xl bg-[#003D7D] text-white text-sm font-medium
                       flex items-center gap-2 hover:bg-[#002D5C] disabled:opacity-50 transition-all">
            {loading
              ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              : <Save size={15} />}
            {isEdit ? 'Guardar cambios' : 'Crear proyecto'}
          </button>
        </div>
      </div>
    </div>
  )
}