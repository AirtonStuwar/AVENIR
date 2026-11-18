import { useEffect, useState } from 'react'
import { X, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import type { SolicitudARendir } from '../types/arendir'
import { updateARendir } from '../services/arendirService'
import { getProyectos, getPartidasByProyecto } from '../../proyecto/services/proyectoService'
import type { Proyecto } from '../../proyecto/types/proyecto'
import type { ProyectoPartida } from '../../proyecto/types/proyecto'
import { BANCOS, labelNumeroCuenta, maxLengthNumeroCuenta, placeholderNumeroCuenta, esCuentaRecaudadora } from '../../solicitud/constants/bancos'

interface Props {
  solicitud: SolicitudARendir | null
  onSaved: () => void | Promise<void>
  onCancel: () => void
}

const INPUT = 'w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/30 focus:border-[#003D7D] bg-white'
const LABEL = 'text-xs font-semibold text-gray-600 uppercase tracking-wide'

/**
 * Edita los datos generales de una rendición mientras sigue en Pendiente o Devuelto
 * (antes de que el evaluador/aprobador la vea). Los gastos no se tocan aquí.
 */
export default function EditarDatosARendirModal({ solicitud, onSaved, onCancel }: Props) {
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [partidas, setPartidas] = useState<ProyectoPartida[]>([])
  const [beneficiario, setBeneficiario] = useState('')
  const [documento, setDocumento] = useState('')
  const [proyectoId, setProyectoId] = useState('')
  const [partidaId, setPartidaId] = useState('')
  const [moneda, setMoneda] = useState<'PEN' | 'USD'>('PEN')
  const [importe, setImporte] = useState('')
  const [motivo, setMotivo] = useState('')
  const [fecha, setFecha] = useState('')
  const [banco, setBanco] = useState('')
  const [cuenta, setCuenta] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getProyectos({ pageSize: 100 }).then(r => setProyectos(r.data)).catch(() => {})
  }, [])

  // Carga los datos actuales cada vez que se abre con una solicitud
  useEffect(() => {
    if (!solicitud) return
    setBeneficiario(solicitud.beneficiario_nombre ?? '')
    setDocumento(solicitud.beneficiario_dni ?? '')
    setProyectoId(solicitud.proyecto_id ? String(solicitud.proyecto_id) : '')
    setPartidaId(solicitud.proyecto_partida_id ? String(solicitud.proyecto_partida_id) : '')
    setMoneda(solicitud.moneda === 'USD' ? 'USD' : 'PEN')
    setImporte(String(solicitud.importe ?? ''))
    setMotivo(solicitud.motivo ?? '')
    setFecha(solicitud.fecha_rendicion ?? '')
    setBanco(solicitud.banco ?? '')
    setCuenta(solicitud.numero_cuenta ?? '')
  }, [solicitud?.id])

  // Centros de costo de la empresa elegida
  useEffect(() => {
    if (!proyectoId) { setPartidas([]); return }
    let cancelado = false
    getPartidasByProyecto(Number(proyectoId))
      .then(p => { if (!cancelado) setPartidas(p as ProyectoPartida[]) })
      .catch(() => { if (!cancelado) setPartidas([]) })
    return () => { cancelado = true }
  }, [proyectoId])

  if (!solicitud) return null

  function cambiarEmpresa(valor: string) {
    setProyectoId(valor)
    // El centro de costo pertenece a la empresa: al cambiarla hay que volver a elegirlo
    if (valor !== (solicitud?.proyecto_id ? String(solicitud.proyecto_id) : '')) setPartidaId('')
    else setPartidaId(solicitud?.proyecto_partida_id ? String(solicitud.proyecto_partida_id) : '')
  }

  async function guardar() {
    const monto = Number(importe)
    if (!importe || isNaN(monto) || monto <= 0) { toast.error('Ingresa un importe válido'); return }
    if (!beneficiario.trim()) { toast.error('Ingresa el nombre del beneficiario'); return }
    const doc = documento.trim()
    if (doc && doc.length !== 8 && doc.length !== 11) { toast.error('El documento debe ser un DNI (8 dígitos) o un RUC (11 dígitos)'); return }
    if (partidas.length > 0 && !partidaId) { toast.error('Selecciona un centro de costo de la empresa'); return }
    if (banco && !cuenta.trim()) { toast.error('Ingresa el número de cuenta del banco elegido'); return }

    setSaving(true)
    try {
      await updateARendir(solicitud!.id, {
        beneficiario_nombre: beneficiario.trim(),
        beneficiario_dni: doc || null,
        proyecto_id: proyectoId ? Number(proyectoId) : null,
        proyecto_partida_id: partidaId ? Number(partidaId) : null,
        moneda,
        importe: monto,
        motivo: motivo.trim() || null,
        fecha_rendicion: fecha || null,
        banco: banco || null,
        numero_cuenta: banco ? cuenta.trim() : null,
      })
      toast.success('Datos actualizados')
      await onSaved()
    } catch {
      toast.error('No se pudieron guardar los cambios')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={saving ? undefined : onCancel} />
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Pencil size={16} className="text-[#003D7D]" />
            <h2 className="text-sm font-semibold text-gray-800">Editar datos de {solicitud.codigo}</h2>
          </div>
          <button onClick={onCancel} disabled={saving} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className={LABEL}>Beneficiario</label>
              <input className={INPUT} value={beneficiario} onChange={e => setBeneficiario(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className={LABEL}>DNI / RUC</label>
              <input className={INPUT} value={documento} maxLength={11}
                onChange={e => setDocumento(e.target.value.replace(/\D/g, ''))} placeholder="8 u 11 dígitos" />
            </div>

            <div className="space-y-1">
              <label className={LABEL}>Empresa</label>
              <select className={INPUT} value={proyectoId} onChange={e => cambiarEmpresa(e.target.value)}>
                <option value="">— Sin empresa —</option>
                {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            {partidas.length > 0 ? (
              <div className="space-y-1">
                <label className={LABEL}>Centro de costo *</label>
                <select className={`${INPUT} ${!partidaId ? 'border-orange-300' : ''}`} value={partidaId} onChange={e => setPartidaId(e.target.value)}>
                  <option value="">Seleccionar centro de costo</option>
                  {partidas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
            ) : <div className="hidden md:block" />}

            <div className="space-y-1">
              <label className={LABEL}>Moneda</label>
              <select className={INPUT} value={moneda} onChange={e => setMoneda(e.target.value as 'PEN' | 'USD')}>
                <option value="PEN">S/ Soles (PEN)</option>
                <option value="USD">$ Dólares (USD)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className={LABEL}>Importe a rendir ({moneda === 'USD' ? '$' : 'S/'})</label>
              <input type="number" className={INPUT} value={importe} min="0" step="0.01" onChange={e => setImporte(e.target.value)} />
            </div>

            <div className="space-y-1">
              <label className={LABEL}>Motivo del adelanto</label>
              <input className={INPUT} value={motivo} onChange={e => setMotivo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className={LABEL}>Fecha requerida</label>
              <input type="date" className={INPUT} value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>

            <div className="space-y-1">
              <label className={LABEL}>Banco</label>
              <select className={INPUT} value={banco} onChange={e => { setBanco(e.target.value); setCuenta('') }}>
                <option value="">— Seleccionar banco —</option>
                {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className={LABEL}>{banco ? labelNumeroCuenta(banco) : 'Número de cuenta / CCI'}</label>
              <input className={`${INPUT} disabled:bg-gray-50 disabled:text-gray-400`} value={cuenta} disabled={!banco}
                maxLength={banco ? maxLengthNumeroCuenta(banco) : 20}
                placeholder={banco ? placeholderNumeroCuenta(banco) : '—'}
                onChange={e => setCuenta(esCuentaRecaudadora(banco) ? e.target.value : e.target.value.replace(/\D/g, ''))} />
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-4">
            Los gastos y el documento sustento no se modifican aquí. Los cambios se pueden hacer mientras la rendición esté Pendiente o Devuelta.
          </p>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button onClick={onCancel} disabled={saving}
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-all">
            Cancelar
          </button>
          <button onClick={guardar} disabled={saving}
            className="px-4 py-2 rounded-xl bg-[#003D7D] text-white text-sm font-medium flex items-center gap-2 hover:bg-[#002D5C] disabled:opacity-40 transition-all">
            {saving ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Guardando…</> : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}
