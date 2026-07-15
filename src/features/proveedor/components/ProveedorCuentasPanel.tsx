import { useEffect, useState } from 'react'
import { X, Plus, Pencil, Trash2, Check, CreditCard } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getCuentasByProveedor,
  createCuentaProveedor,
  updateCuentaProveedor,
  deleteCuentaProveedor,
} from '../services/proveedorCuentaService'
import type { ProveedorCuenta } from '../types/proveedor'
import { BANCOS, labelNumeroCuenta, maxLengthNumeroCuenta } from '../../solicitud/constants/bancos'

interface Props {
  ruc:         string
  razonSocial: string | null
  onClose:     () => void
}

const MONEDAS = ['PEN', 'USD'] as const

const EMPTY = {
  banco:               BANCOS[0],
  numero_cuenta:       '',
  moneda:              'PEN' as 'PEN' | 'USD',
  cuenta_detracciones: '',
  descripcion:         '',
}

const INPUT = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 focus:border-[#003D7D]/50 focus:bg-white transition-all'
const LABEL = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5'

export default function ProveedorCuentasPanel({ ruc, razonSocial, onClose }: Props) {
  const [cuentas, setCuentas] = useState<ProveedorCuenta[]>([])
  const [loading, setLoading] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [editId,  setEditId]  = useState<number | 'new' | null>(null)
  const [delId,   setDelId]   = useState<number | null>(null)
  const [form,    setForm]    = useState(EMPTY)

  const load = async () => {
    setLoading(true)
    try { setCuentas(await getCuentasByProveedor(ruc)) }
    catch { toast.error('Error al cargar cuentas') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [ruc])

  const openNew  = () => { setForm(EMPTY); setEditId('new') }
  const openEdit = (c: ProveedorCuenta) => {
    setForm({
      banco:               c.banco,
      numero_cuenta:       c.numero_cuenta,
      moneda:              c.moneda,
      cuenta_detracciones: c.cuenta_detracciones ?? '',
      descripcion:         c.descripcion ?? '',
    })
    setEditId(c.id)
  }
  const cancelEdit = () => setEditId(null)

  const set = (k: keyof typeof EMPTY, v: string) => {
    setForm(f => ({
      ...f,
      [k]: v,
      ...(k === 'banco' ? { numero_cuenta: '' } : {}),
    }))
  }

  const handleSave = async () => {
    if (!form.banco || !form.numero_cuenta.trim()) {
      toast.error('Banco y número de cuenta son obligatorios')
      return
    }
    setSaving(true)
    try {
      if (editId === 'new') {
        await createCuentaProveedor({
          proveedor_ruc:       ruc,
          banco:               form.banco,
          numero_cuenta:       form.numero_cuenta.trim(),
          moneda:              form.moneda,
          cuenta_detracciones: form.cuenta_detracciones.trim() || null,
          descripcion:         form.descripcion.trim() || null,
          estado:              'Activo',
        })
        toast.success('Cuenta agregada')
      } else if (typeof editId === 'number') {
        await updateCuentaProveedor(editId, {
          banco:               form.banco,
          numero_cuenta:       form.numero_cuenta.trim(),
          moneda:              form.moneda,
          cuenta_detracciones: form.cuenta_detracciones.trim() || null,
          descripcion:         form.descripcion.trim() || null,
        })
        toast.success('Cuenta actualizada')
      }
      setEditId(null)
      await load()
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    setSaving(true)
    try {
      await deleteCuentaProveedor(id)
      setDelId(null)
      toast.success('Cuenta eliminada')
      await load()
    } catch {
      toast.error('Error al eliminar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-md bg-white shadow-2xl flex flex-col h-full overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <CreditCard size={16} className="text-[#003D7D]" />
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Cuentas bancarias</h2>
              <p className="text-xs text-gray-400 truncate max-w-[240px]">{razonSocial ?? ruc}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Formulario nuevo / editar */}
          {editId !== null && (
            <div className="bg-[#003D7D]/[0.04] border border-[#003D7D]/20 rounded-2xl p-5 space-y-4">
              <p className="text-xs font-semibold text-[#003D7D] uppercase tracking-wide">
                {editId === 'new' ? 'Nueva cuenta' : 'Editar cuenta'}
              </p>

              <div className="grid grid-cols-2 gap-3">
                {/* Banco */}
                <div className="col-span-2">
                  <label className={LABEL}>Banco <span className="text-red-500">*</span></label>
                  <select value={form.banco} onChange={e => set('banco', e.target.value)} className={INPUT}>
                    {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>

                {/* Moneda */}
                <div>
                  <label className={LABEL}>Moneda</label>
                  <div className="flex gap-2">
                    {MONEDAS.map(m => (
                      <button key={m} type="button" onClick={() => set('moneda', m)}
                        className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                          form.moneda === m
                            ? 'bg-[#003D7D] text-white border-[#003D7D]'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-[#003D7D]/40'
                        }`}>
                        {m === 'PEN' ? 'S/' : '$'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Número de cuenta */}
                <div className="col-span-2">
                  <label className={LABEL}>{labelNumeroCuenta(form.banco)} <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={form.numero_cuenta}
                    onChange={e => set('numero_cuenta', e.target.value)}
                    maxLength={maxLengthNumeroCuenta(form.banco)}
                    placeholder={`${maxLengthNumeroCuenta(form.banco)} dígitos`}
                    className={INPUT}
                  />
                </div>

                {/* Cuenta detracciones */}
                <div className="col-span-2">
                  <label className={LABEL}>Cuenta detracciones <span className="text-gray-400 font-normal">(opcional)</span></label>
                  <input
                    type="text"
                    value={form.cuenta_detracciones}
                    onChange={e => set('cuenta_detracciones', e.target.value)}
                    placeholder="N° cuenta SPOT — Banco de la Nación"
                    className={INPUT}
                  />
                </div>

                {/* Descripción */}
                <div className="col-span-2">
                  <label className={LABEL}>Descripción <span className="text-gray-400 font-normal">(opcional)</span></label>
                  <input
                    type="text"
                    value={form.descripcion}
                    onChange={e => set('descripcion', e.target.value)}
                    placeholder="Ej: Cuenta principal, Cuenta USD…"
                    className={INPUT}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={cancelEdit} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-600 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-all">
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-[#003D7D] text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#002D5C] disabled:opacity-50 transition-all">
                  {saving
                    ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    : <><Check size={14} /> Guardar</>}
                </button>
              </div>
            </div>
          )}

          {/* Lista de cuentas */}
          {loading ? (
            <div className="py-10 flex justify-center">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#003D7D]/20 border-t-[#003D7D]" />
            </div>
          ) : cuentas.length === 0 && editId === null ? (
            <div className="py-10 flex flex-col items-center gap-2 text-gray-400">
              <CreditCard size={28} className="text-gray-200" />
              <p className="text-sm">Sin cuentas registradas</p>
              <p className="text-xs text-center max-w-[200px]">Agrega una cuenta para que se auto-rellene en futuras solicitudes</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cuentas.map(c => (
                <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  {delId === c.id ? (
                    <div className="space-y-3">
                      <p className="text-sm text-red-600 font-medium">¿Eliminar esta cuenta?</p>
                      <div className="flex gap-2">
                        <button onClick={() => setDelId(null)} disabled={saving}
                          className="flex-1 py-2 rounded-xl border border-gray-200 bg-white text-gray-600 text-xs font-medium hover:bg-gray-50 disabled:opacity-50 transition-all">
                          Cancelar
                        </button>
                        <button onClick={() => handleDelete(c.id)} disabled={saving}
                          className="flex-1 py-2 rounded-xl bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition-all">
                          {saving ? '…' : 'Eliminar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-800">{c.banco}</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.moneda === 'USD' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                            {c.moneda === 'USD' ? 'Dólares' : 'Soles'}
                          </span>
                        </div>
                        <p className="text-xs font-mono text-gray-600 mt-0.5">{c.numero_cuenta}</p>
                        {c.cuenta_detracciones && (
                          <p className="text-xs text-gray-400 mt-0.5">Det: {c.cuenta_detracciones}</p>
                        )}
                        {c.descripcion && (
                          <p className="text-xs text-gray-400 mt-0.5 italic">{c.descripcion}</p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => openEdit(c)} disabled={editId !== null}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => setDelId(c.id)} disabled={editId !== null || saving}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 disabled:opacity-30 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {editId === null && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
            <button onClick={openNew}
              className="w-full py-2.5 rounded-xl border border-dashed border-[#003D7D]/30 text-[#003D7D] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#003D7D]/5 transition-all">
              <Plus size={15} /> Agregar cuenta
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
