import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../api/supabase'
import { createCajaChica, getSaldoAnterior } from '../features/caja-chica/services/cajaChicaService'

const INPUT = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 focus:border-[#003D7D]/50 focus:bg-white transition-all'
const LABEL = 'block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide'

interface ProyectoCC { id: number; nombre: string; monto_caja_chica: number }

export default function CajaChicaNuevaPage() {
  const navigate = useNavigate()
  const { user, usuarioProfile } = useAuthStore()
  const [saving, setSaving] = useState(false)

  const [proyectos, setProyectos] = useState<ProyectoCC[]>([])
  const [proyectoId, setProyectoId] = useState<number | null>(null)
  const [periodoDesde, setPeriodoDesde] = useState('')
  const [periodoHasta, setPeriodoHasta] = useState('')
  const [cuentaBbva, setCuentaBbva] = useState('')
  const [montoAsignado, setMontoAsignado] = useState(0)
  const [saldoAnterior, setSaldoAnterior] = useState(0)
  const [transferencia, setTransferencia] = useState(0)

  useEffect(() => {
    supabase.from('proyecto').select('id, nombre, monto_caja_chica').eq('estado', 'Activo').order('nombre')
      .then(({ data }) => {
        const rows = (data ?? []) as ProyectoCC[]
        setProyectos(rows.filter(p => p.monto_caja_chica > 0))
      })
  }, [])

  useEffect(() => {
    if (!proyectoId) { setMontoAsignado(0); setSaldoAnterior(0); setTransferencia(0); return }
    const proy = proyectos.find(p => p.id === proyectoId)
    const monto = proy?.monto_caja_chica ?? 0
    setMontoAsignado(monto)
    getSaldoAnterior(proyectoId).then(saldo => {
      setSaldoAnterior(saldo)
      setTransferencia(monto - saldo)
    })
  }, [proyectoId, proyectos])

  const handleGuardar = async () => {
    if (!user?.id) return
    if (!proyectoId) { toast.error('Selecciona un proyecto'); return }
    if (!periodoDesde || !periodoHasta) { toast.error('Ingresa el período'); return }
    if (montoAsignado <= 0) { toast.error('El proyecto no tiene monto de caja chica configurado'); return }

    setSaving(true)
    try {
      const cc = await createCajaChica({
        proyecto_id: proyectoId,
        responsable_id: user.id,
        periodo_desde: periodoDesde,
        periodo_hasta: periodoHasta,
        monto_asignado: montoAsignado,
        saldo_anterior: saldoAnterior,
        transferencia,
        cuenta_bbva: cuentaBbva || null,
        documento_sustento_path: null,
        estado: 'Pendiente',
      })
      toast.success(`Caja chica ${cc.codigo} creada`)
      navigate(`/caja-chica/${cc.id}`)
    } catch {
      toast.error('Error al crear la caja chica')
    } finally {
      setSaving(false)
    }
  }

  const fmt = (n: number) => `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-2xl px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/caja-chica')}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Nueva Caja Chica</h1>
            <p className="text-xs text-gray-400">Registra una nueva rendición de caja chica</p>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-6 space-y-5">

          {/* Responsable */}
          <div>
            <label className={LABEL}>Responsable</label>
            <input className={INPUT + ' bg-gray-100 cursor-not-allowed'} readOnly
              value={usuarioProfile?.nombre_completo ?? user?.email ?? ''} />
          </div>

          {/* Proyecto */}
          <div>
            <label className={LABEL}>Empresa *</label>
            <select className={INPUT} value={proyectoId ?? ''}
              onChange={e => setProyectoId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Seleccionar empresa</option>
              {proyectos.map(p => (
                <option key={p.id} value={p.id}>{p.nombre} — Fondo: S/ {p.monto_caja_chica.toLocaleString('es-PE')}</option>
              ))}
            </select>
            {proyectos.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">No hay empresas con monto de caja chica configurado. El ADMIN debe asignar el monto desde Empresas.</p>
            )}
          </div>

          {/* Período */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Período desde *</label>
              <input type="date" className={INPUT} value={periodoDesde}
                onChange={e => setPeriodoDesde(e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Período hasta *</label>
              <input type="date" className={INPUT} value={periodoHasta}
                onChange={e => setPeriodoHasta(e.target.value)} />
            </div>
          </div>

          {/* Cuenta BBVA */}
          <div>
            <label className={LABEL}>Cuenta BBVA</label>
            <input className={INPUT} placeholder="0011-0814-0252670683"
              value={cuentaBbva} onChange={e => setCuentaBbva(e.target.value)} />
          </div>

          {/* Resumen financiero */}
          {proyectoId && montoAsignado > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 space-y-2">
              <p className="text-xs font-semibold text-[#003D7D] uppercase tracking-wide">Resumen</p>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Saldo anterior</p>
                  <p className="font-semibold text-gray-800">{fmt(saldoAnterior)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Transferencia</p>
                  <p className="font-bold text-[#003D7D]">{fmt(transferencia)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Monto asignado</p>
                  <p className="font-bold text-emerald-700">{fmt(montoAsignado)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => navigate('/caja-chica')}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-all">
              Cancelar
            </button>
            <button onClick={handleGuardar} disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-[#003D7D] text-white text-sm font-medium flex items-center gap-2 hover:bg-[#002D5C] disabled:opacity-50 transition-all">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Guardando…</> : 'Crear caja chica'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
