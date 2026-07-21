import { useEffect, useState } from 'react'
import { X, Plus, Pencil, Trash2, Check, AlertCircle, CreditCard } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../../api/supabase'
import type { Proyecto } from '../types/proyecto'

interface CuentaBancaria {
  id: number
  proyecto_id: number
  proyecto_partida_id: number | null
  banco: string
  moneda: string
  tipo: string
  numero_cuenta: string
  cci: string | null
  concepto: string | null
  estado: string
}

interface Partida { id: number; nombre: string }

interface Props {
  proyecto: Proyecto | null
  onClose: () => void
}

const BANCOS = ['BBVA', 'INTERBANK', 'BCP', 'SCOTIABANK', 'BANBIF', 'PICHINCHA']
const MONEDAS = ['PEN', 'USD']
const TIPOS = ['CORRIENTE', 'GARANTIA', 'RECAUDADORA', 'AHORRO']

const EMPTY = { banco: 'BBVA', moneda: 'PEN', tipo: 'CORRIENTE', numero_cuenta: '', cci: '', concepto: '', proyecto_partida_id: '' }

export default function CuentasBancariasPanel({ proyecto, onClose }: Props) {
  const [cuentas, setCuentas]     = useState<CuentaBancaria[]>([])
  const [partidas, setPartidas]   = useState<Partida[]>([])
  const [loading, setLoading]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [editId, setEditId]       = useState<number | 'new' | null>(null)
  const [deleteId, setDeleteId]   = useState<number | null>(null)
  const [form, setForm]           = useState(EMPTY)

  useEffect(() => {
    if (!proyecto) return
    setLoading(true)
    Promise.all([
      supabase.from('cuenta_bancaria').select('*').eq('proyecto_id', proyecto.id).eq('estado', 'Activo').order('banco'),
      supabase.from('proyecto_partida').select('id, nombre').eq('proyecto_id', proyecto.id).eq('estado', 'Activo').order('nombre'),
    ])
      .then(([cRes, pRes]) => {
        setCuentas((cRes.data ?? []) as CuentaBancaria[])
        setPartidas((pRes.data ?? []) as Partida[])
      })
      .catch(() => toast.error('Error al cargar cuentas'))
      .finally(() => setLoading(false))
  }, [proyecto])

  if (!proyecto) return null

  const openNew = () => { setForm(EMPTY); setEditId('new') }
  const openEdit = (c: CuentaBancaria) => {
    setForm({
      banco: c.banco, moneda: c.moneda, tipo: c.tipo,
      numero_cuenta: c.numero_cuenta, cci: c.cci ?? '', concepto: c.concepto ?? '',
      proyecto_partida_id: c.proyecto_partida_id ? String(c.proyecto_partida_id) : '',
    })
    setEditId(c.id)
  }
  const cancelEdit = () => { setEditId(null); setForm(EMPTY) }

  const handleSave = async () => {
    if (!form.numero_cuenta.trim()) { toast.error('El número de cuenta es obligatorio'); return }
    setSaving(true)
    try {
      const payload = {
        proyecto_id: proyecto.id,
        proyecto_partida_id: form.proyecto_partida_id ? Number(form.proyecto_partida_id) : null,
        banco: form.banco,
        moneda: form.moneda,
        tipo: form.tipo,
        numero_cuenta: form.numero_cuenta.trim(),
        cci: form.cci.trim() || null,
        concepto: form.concepto.trim() || null,
        estado: 'Activo',
      }
      if (editId === 'new') {
        const { data, error } = await supabase.from('cuenta_bancaria').insert(payload).select().single()
        if (error) throw error
        setCuentas(prev => [...prev, data as CuentaBancaria])
        toast.success('Cuenta creada')
      } else if (typeof editId === 'number') {
        const { data, error } = await supabase.from('cuenta_bancaria').update(payload).eq('id', editId).select().single()
        if (error) throw error
        setCuentas(prev => prev.map(c => c.id === editId ? data as CuentaBancaria : c))
        toast.success('Cuenta actualizada')
      }
      cancelEdit()
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setSaving(true)
    try {
      const { error } = await supabase.from('cuenta_bancaria').delete().eq('id', deleteId)
      if (error) throw error
      setCuentas(prev => prev.filter(c => c.id !== deleteId))
      toast.success('Cuenta eliminada')
    } catch {
      toast.error('No se puede eliminar — puede estar vinculada a un pago')
    } finally {
      setSaving(false)
      setDeleteId(null)
    }
  }

  const generales = cuentas.filter(c => !c.proyecto_partida_id)
  const porPartida = cuentas.filter(c => c.proyecto_partida_id)

  const INPUT = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 focus:border-[#003D7D]/50 focus:bg-white transition-all'

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white z-50 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-[#003D7D]">
          <div>
            <p className="text-xs text-white/60 uppercase tracking-wide">Cuentas bancarias</p>
            <h2 className="text-sm font-semibold text-white mt-0.5">{proyecto.nombre}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {editId === null && (
            <button onClick={openNew}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#003D7D] text-white text-sm font-medium hover:bg-[#002D5C] transition-all">
              <Plus size={14} /> Nueva cuenta
            </button>
          )}

          {/* Form */}
          {editId !== null && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 space-y-3">
              <p className="text-xs font-semibold text-[#003D7D] uppercase tracking-wide">
                {editId === 'new' ? 'Nueva cuenta' : 'Editar cuenta'}
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Banco *</label>
                  <select className={INPUT} value={form.banco} onChange={e => setForm(f => ({ ...f, banco: e.target.value }))}>
                    {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Moneda</label>
                  <select className={INPUT} value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}>
                    {MONEDAS.map(m => <option key={m} value={m}>{m === 'PEN' ? 'Soles' : 'Dólares'}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Tipo</label>
                  <select className={INPUT} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                    {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">N° Cuenta *</label>
                <input className={INPUT} value={form.numero_cuenta} placeholder="00110518010009346"
                  onChange={e => setForm(f => ({ ...f, numero_cuenta: e.target.value.replace(/\D/g, '') }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">CCI</label>
                <input className={INPUT} value={form.cci} placeholder="01151800010000934686"
                  onChange={e => setForm(f => ({ ...f, cci: e.target.value.replace(/\D/g, '') }))} />
              </div>
              {partidas.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Centro de costo (opcional)</label>
                  <select className={INPUT} value={form.proyecto_partida_id}
                    onChange={e => setForm(f => ({ ...f, proyecto_partida_id: e.target.value }))}>
                    <option value="">— General (empresa) —</option>
                    {partidas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Concepto</label>
                <input className={INPUT} value={form.concepto} placeholder="Descripción de la cuenta"
                  onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))} />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#003D7D] text-white text-sm font-medium disabled:opacity-50 transition-all">
                  {saving ? 'Guardando…' : <><Check size={13} /> Guardar</>}
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
          ) : cuentas.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-gray-400">
              <AlertCircle size={28} className="text-gray-200" />
              <p className="text-sm">No hay cuentas registradas.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {generales.length > 0 && (
                <>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Cuentas generales</p>
                  {generales.map(c => (
                    <CuentaCard key={c.id} cuenta={c} onEdit={openEdit} onDelete={setDeleteId} />
                  ))}
                </>
              )}
              {porPartida.length > 0 && (
                <>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mt-4">Por centro de costo</p>
                  {porPartida.map(c => {
                    const p = partidas.find(p => p.id === c.proyecto_partida_id)
                    return <CuentaCard key={c.id} cuenta={c} partidaNombre={p?.nombre} onEdit={openEdit} onDelete={setDeleteId} />
                  })}
                </>
              )}
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
              <p className="text-sm font-semibold text-gray-800">¿Eliminar esta cuenta?</p>
              <p className="text-xs text-gray-500">Si hay pagos vinculados, no se podrá eliminar.</p>
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

function CuentaCard({ cuenta, partidaNombre, onEdit, onDelete }: {
  cuenta: CuentaBancaria; partidaNombre?: string
  onEdit: (c: CuentaBancaria) => void; onDelete: (id: number) => void
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 bg-white hover:border-[#003D7D]/20 transition-all group">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <CreditCard size={13} className="text-[#003D7D] shrink-0" />
          <span className="text-sm font-semibold text-gray-800">{cuenta.banco}</span>
          <span className="text-xs text-gray-400">{cuenta.moneda === 'USD' ? 'Dólares' : 'Soles'}</span>
          <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">{cuenta.tipo}</span>
        </div>
        <p className="text-xs font-mono text-gray-600 mt-0.5">{cuenta.numero_cuenta}</p>
        {cuenta.cci && <p className="text-[10px] text-gray-400">CCI: {cuenta.cci}</p>}
        {partidaNombre && <p className="text-[10px] text-[#003D7D] font-medium mt-0.5">{partidaNombre}</p>}
        {cuenta.concepto && <p className="text-[10px] text-gray-400 italic">{cuenta.concepto}</p>}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onEdit(cuenta)} className="p-1.5 rounded-lg hover:bg-[#003D7D]/8 text-gray-400 hover:text-[#003D7D] transition-colors">
          <Pencil size={14} />
        </button>
        <button onClick={() => onDelete(cuenta.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
