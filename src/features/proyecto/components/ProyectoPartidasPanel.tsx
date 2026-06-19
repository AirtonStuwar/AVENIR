import { useEffect, useState } from 'react'
import { X, Plus, Pencil, Trash2, Check, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getPartidasByProyecto,
  getConsumoByProyectos,
  createPartida,
  updatePartida,
  deletePartida,
} from '../services/proyectoService'
import type { ProyectoPartida, Proyecto } from '../types/proyecto'
import type { Consumo } from '../services/proyectoService'

interface Props {
  proyecto: Proyecto | null
  mostrarConsumo?: boolean
  onClose: () => void
}

const fmtPEN = (n: number) =>
  n > 0 ? `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2 })}` : '—'
const fmtUSD = (n: number) =>
  n > 0 ? `$ ${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'

const EMPTY = { nombre: '', presupuesto_pen: '', presupuesto_usd: '' }

export default function ProyectoPartidasPanel({ proyecto, mostrarConsumo = false, onClose }: Props) {
  const [partidas,  setPartidas]  = useState<ProyectoPartida[]>([])
  const [consumoMap, setConsumoMap] = useState<Record<number, Consumo>>({})
  const [loading,   setLoading]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [editId,    setEditId]    = useState<number | 'new' | null>(null)
  const [deleteId,  setDeleteId]  = useState<number | null>(null)
  const [form,      setForm]      = useState(EMPTY)

  useEffect(() => {
    if (!proyecto) return
    setLoading(true)
    const promises: [Promise<ProyectoPartida[]>, Promise<{ porPartida: Record<number, Consumo> }> | Promise<null>] = [
      getPartidasByProyecto(proyecto.id),
      mostrarConsumo ? getConsumoByProyectos([proyecto.id]) : Promise.resolve(null),
    ]
    Promise.all(promises)
      .then(([parts, consumoData]) => {
        setPartidas(parts as ProyectoPartida[])
        if (consumoData) setConsumoMap((consumoData as { porPartida: Record<number, Consumo> }).porPartida)
      })
      .catch(() => toast.error('Error al cargar partidas'))
      .finally(() => setLoading(false))
  }, [proyecto, mostrarConsumo])

  if (!proyecto) return null

  const openNew = () => { setForm(EMPTY); setEditId('new') }
  const openEdit = (p: ProyectoPartida) => {
    setForm({
      nombre: p.nombre,
      presupuesto_pen: p.presupuesto_pen > 0 ? String(p.presupuesto_pen) : '',
      presupuesto_usd: p.presupuesto_usd > 0 ? String(p.presupuesto_usd) : '',
    })
    setEditId(p.id)
  }
  const cancelEdit = () => { setEditId(null); setForm(EMPTY) }

  const handleSave = async () => {
    if (!form.nombre.trim()) { toast.error('El nombre es obligatorio'); return }
    setSaving(true)
    try {
      const payload = {
        proyecto_id:     proyecto.id,
        nombre:          form.nombre.trim(),
        presupuesto_pen: parseFloat(form.presupuesto_pen) || 0,
        presupuesto_usd: parseFloat(form.presupuesto_usd) || 0,
        estado:          'Activo',
      }
      if (editId === 'new') {
        const nueva = await createPartida(payload)
        setPartidas(prev => [...prev, nueva])
        toast.success('Partida creada')
      } else if (typeof editId === 'number') {
        const updated = await updatePartida(editId, payload)
        setPartidas(prev => prev.map(p => p.id === editId ? updated : p))
        toast.success('Partida actualizada')
      }
      cancelEdit()
    } catch {
      toast.error('Error al guardar la partida')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setSaving(true)
    try {
      await deletePartida(deleteId)
      setPartidas(prev => prev.filter(p => p.id !== deleteId))
      toast.success('Partida eliminada')
    } catch {
      toast.error('No se puede eliminar — puede tener solicitudes asociadas')
    } finally {
      setSaving(false)
      setDeleteId(null)
    }
  }

  const INPUT = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 focus:border-[#003D7D]/50 focus:bg-white transition-all'

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white z-50 shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-[#003D7D]">
          <div>
            <p className="text-xs text-white/60 uppercase tracking-wide">Partidas del proyecto</p>
            <h2 className="text-sm font-semibold text-white mt-0.5">{proyecto.nombre}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Add button */}
          {editId === null && (
            <button onClick={openNew}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#003D7D] text-white text-sm font-medium hover:bg-[#002D5C] transition-all">
              <Plus size={14} /> Nueva partida
            </button>
          )}

          {/* Form (new or edit) */}
          {editId !== null && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 space-y-3">
              <p className="text-xs font-semibold text-[#003D7D] uppercase tracking-wide">
                {editId === 'new' ? 'Nueva partida' : 'Editar partida'}
              </p>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Nombre *</label>
                <input className={INPUT} placeholder="Ej: HITO, JOMY, OP-ADM…"
                  value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Presupuesto S/.</label>
                  <input type="number" min="0" step="0.01" className={INPUT}
                    placeholder="0.00"
                    value={form.presupuesto_pen}
                    onChange={e => setForm(f => ({ ...f, presupuesto_pen: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Presupuesto $</label>
                  <input type="number" min="0" step="0.01" className={INPUT}
                    placeholder="0.00"
                    value={form.presupuesto_usd}
                    onChange={e => setForm(f => ({ ...f, presupuesto_usd: e.target.value }))} />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#003D7D] text-white text-sm font-medium disabled:opacity-50 transition-all">
                  {saving
                    ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> Guardando…</>
                    : <><Check size={13} /> Guardar</>}
                </button>
                <button onClick={cancelEdit} disabled={saving}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-all">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* List */}
          {loading ? (
            <div className="flex justify-center py-10 text-gray-400">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#003D7D] border-t-transparent" />
            </div>
          ) : partidas.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-gray-400">
              <AlertCircle size={28} className="text-gray-200" />
              <p className="text-sm">Este proyecto no tiene partidas aún.</p>
              <p className="text-xs">Usa el botón "Nueva partida" para agregar una.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {partidas.map(p => {
                const c = consumoMap[p.id] ?? { pen: 0, usd: 0 }
                const pctPen = p.presupuesto_pen > 0 ? (c.pen / p.presupuesto_pen) * 100 : 0
                const pctUsd = p.presupuesto_usd > 0 ? (c.usd / p.presupuesto_usd) * 100 : 0
                const barColor = (pct: number) => pct > 100 ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                const txtColor = (pct: number) => pct > 100 ? 'text-red-600' : pct > 80 ? 'text-amber-600' : 'text-emerald-600'
                return (
                  <div key={p.id} className="px-4 py-3 rounded-xl border border-gray-200 bg-white hover:border-[#003D7D]/20 hover:bg-[#003D7D]/[0.02] transition-all group">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-800">{p.nombre}</p>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(p)} title="Editar"
                          className="p-1.5 rounded-lg hover:bg-[#003D7D]/8 text-gray-400 hover:text-[#003D7D] transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setDeleteId(p.id)} title="Eliminar"
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {mostrarConsumo ? (
                        <>
                          {p.presupuesto_pen > 0 ? (
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-gray-500">S/ {fmtPEN(c.pen)} / {fmtPEN(p.presupuesto_pen)}</span>
                                <span className={`text-[10px] font-bold ${txtColor(pctPen)}`}>{pctPen.toFixed(0)}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${barColor(pctPen)}`} style={{ width: `${Math.min(pctPen, 100)}%` }} />
                              </div>
                            </div>
                          ) : c.pen > 0 ? (
                            <span className="text-[10px] text-gray-500">Consumido S/ {fmtPEN(c.pen)}</span>
                          ) : null}
                          {p.presupuesto_usd > 0 ? (
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-gray-500">$ {fmtUSD(c.usd)} / {fmtUSD(p.presupuesto_usd)}</span>
                                <span className={`text-[10px] font-bold ${txtColor(pctUsd)}`}>{pctUsd.toFixed(0)}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${barColor(pctUsd)}`} style={{ width: `${Math.min(pctUsd, 100)}%` }} />
                              </div>
                            </div>
                          ) : c.usd > 0 ? (
                            <span className="text-[10px] text-gray-500">Consumido $ {fmtUSD(c.usd)}</span>
                          ) : null}
                        </>
                      ) : (
                        <>
                          {p.presupuesto_pen > 0 && (
                            <span className="text-xs text-gray-500">S/. <span className="font-medium text-gray-700">{fmtPEN(p.presupuesto_pen)}</span></span>
                          )}
                          {p.presupuesto_usd > 0 && (
                            <span className="text-xs text-gray-500">$ <span className="font-medium text-gray-700">{fmtUSD(p.presupuesto_usd)}</span></span>
                          )}
                        </>
                      )}
                      {p.presupuesto_pen === 0 && p.presupuesto_usd === 0 && (
                        <span className="text-xs text-gray-400 italic">Sin presupuesto asignado</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex flex-col items-center gap-3 text-center mb-5">
              <div className="w-11 h-11 rounded-2xl bg-red-50 flex items-center justify-center">
                <Trash2 size={20} className="text-red-500" />
              </div>
              <p className="text-sm font-semibold text-gray-800">¿Eliminar esta partida?</p>
              <p className="text-xs text-gray-500">Esta acción no se puede deshacer. Si hay solicitudes asociadas, no se podrá eliminar.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={handleDelete} disabled={saving}
                className="flex-1 h-10 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors">
                {saving ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
