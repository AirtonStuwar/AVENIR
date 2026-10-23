import { useState } from 'react'
import { X, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { upsertProveedor } from '../services/proveedorService'
import { buscarRuc } from '../../solicitud/services/rucService'
import type { Proveedor } from '../types/proveedor'

interface Props {
  /** null = proveedor nuevo */
  proveedor: Proveedor | null
  onClose: () => void
  onSaved: () => void
}

const INPUT = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 focus:border-[#003D7D]/50 focus:bg-white transition-all'
const LABEL = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5'

/** ADMIN: registra o corrige un proveedor (datos y contacto que se autocompletan en las solicitudes). */
export default function ProveedorFormModal({ proveedor, onClose, onSaved }: Props) {
  const esNuevo = !proveedor
  const [ruc, setRuc] = useState(proveedor?.ruc ?? '')
  const [razon, setRazon] = useState(proveedor?.razon_social ?? '')
  const [direccion, setDireccion] = useState(proveedor?.direccion ?? '')
  const [estadoSunat, setEstadoSunat] = useState(proveedor?.estado_sunat ?? '')
  const [cNombre, setCNombre] = useState(proveedor?.contacto_nombre ?? '')
  const [cTel, setCTel] = useState(proveedor?.contacto_telefono ?? '')
  const [cCorreo, setCCorreo] = useState(proveedor?.contacto_correo ?? '')
  const [buscando, setBuscando] = useState(false)
  const [saving, setSaving] = useState(false)

  const buscarSunat = async () => {
    if (ruc.length !== 11) { toast.error('El RUC debe tener 11 dígitos'); return }
    setBuscando(true)
    try {
      const d = await buscarRuc(ruc)
      setRazon(d.razon_social)
      setDireccion(d.direccion)
      setEstadoSunat(d.estado)
    } catch {
      toast.error('RUC no encontrado en SUNAT: completa los datos a mano')
    } finally { setBuscando(false) }
  }

  const guardar = async () => {
    if (!/^\d{11}$/.test(ruc)) { toast.error('El RUC debe tener 11 dígitos'); return }
    if (!razon.trim()) { toast.error('La razón social es obligatoria'); return }
    setSaving(true)
    try {
      await upsertProveedor({
        ruc,
        razon_social: razon.trim(),
        direccion: direccion.trim() || null,
        estado_sunat: estadoSunat.trim() || null,
        contacto_nombre: cNombre.trim() || null,
        contacto_telefono: cTel.trim() || null,
        contacto_correo: cCorreo.trim() || null,
      })
      toast.success(esNuevo ? 'Proveedor registrado' : 'Proveedor actualizado')
      onSaved()
    } catch {
      toast.error('No se pudo guardar el proveedor')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">{esNuevo ? 'Nuevo proveedor' : 'Editar proveedor'}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"><X size={16} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className={LABEL}>RUC <span className="text-red-500">*</span></label>
            <div className="flex gap-2">
              <input className={INPUT} value={ruc} disabled={!esNuevo} maxLength={11} placeholder="11 dígitos"
                onChange={e => setRuc(e.target.value.replace(/\D/g, ''))} />
              {esNuevo && (
                <button type="button" onClick={buscarSunat} disabled={buscando || ruc.length !== 11}
                  className="shrink-0 flex items-center gap-1.5 px-3 rounded-xl border border-[#003D7D]/30 text-[#003D7D] text-sm font-medium hover:bg-[#003D7D]/5 disabled:opacity-40">
                  <Search size={14} /> {buscando ? 'Buscando…' : 'SUNAT'}
                </button>
              )}
            </div>
            {esNuevo && <p className="mt-1 text-xs text-gray-400">Con "SUNAT" se traen razón social y dirección; puedes corregirlas.</p>}
          </div>
          <div>
            <label className={LABEL}>Razón social <span className="text-red-500">*</span></label>
            <input className={INPUT} value={razon} onChange={e => setRazon(e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Dirección</label>
            <input className={INPUT} value={direccion} onChange={e => setDireccion(e.target.value)} />
          </div>

          <div className="pt-1 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 mt-3">Contacto (se autocompleta en las solicitudes)</p>
            <div className="space-y-3">
              <div>
                <label className={LABEL}>Nombre del contacto</label>
                <input className={INPUT} value={cNombre} onChange={e => setCNombre(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Teléfono</label>
                  <input className={INPUT} value={cTel} placeholder="9XXXXXXXX" onChange={e => setCTel(e.target.value)} />
                </div>
                <div>
                  <label className={LABEL}>Correo</label>
                  <input className={INPUT} type="email" value={cCorreo} placeholder="correo@empresa.com" onChange={e => setCCorreo(e.target.value)} />
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400">Las cuentas bancarias se gestionan con el botón de tarjeta de la lista.</p>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
          <button onClick={guardar} disabled={saving}
            className="px-4 py-2 rounded-xl bg-[#003D7D] text-white text-sm font-medium hover:bg-[#002D5C] disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
