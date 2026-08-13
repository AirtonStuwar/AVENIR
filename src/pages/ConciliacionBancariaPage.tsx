import { useEffect, useState } from 'react'
import { Landmark, Upload, Download, Loader2, CheckCircle2, AlertTriangle, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import { getAllCuentasBancarias } from '../features/solicitud/services/cuentaBancariaService'
import type { CuentaBancaria } from '../features/solicitud/services/cuentaBancariaService'
import { parseEstadoCuentaBBVA } from '../features/conciliacion/services/estadoCuentaParser'
import {
  getRegistrosPagables, conciliar, guardarConciliacion, exportarConciliacionExcel, rangoDesdeMovimientos,
} from '../features/conciliacion/services/conciliacionService'
import type { ResultadoConciliacion, EstadoCuentaBBVA } from '../features/conciliacion/types/conciliacion'

const fmt = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

type Tab = 'conciliados' | 'banco' | 'sistema'

export default function ConciliacionBancariaPage() {
  const { user } = useAuthStore()

  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([])
  const [cuentaId, setCuentaId] = useState<number | ''>('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [estadoCuenta, setEstadoCuenta] = useState<EstadoCuentaBBVA | null>(null)
  const [resultado, setResultado] = useState<ResultadoConciliacion | null>(null)
  const [tab, setTab] = useState<Tab>('conciliados')

  useEffect(() => {
    getAllCuentasBancarias().then(setCuentas).catch(() => toast.error('Error al cargar cuentas bancarias'))
  }, [])

  const cuentaSel = cuentas.find(c => c.id === cuentaId)

  async function handleConciliar() {
    if (!cuentaId) { toast.error('Selecciona una cuenta bancaria'); return }
    if (!fechaDesde || !fechaHasta) { toast.error('Ingresa el rango de fechas'); return }
    if (!archivo) { toast.error('Sube el estado de cuenta del banco'); return }

    setLoading(true)
    setResultado(null)
    try {
      const ec = await parseEstadoCuentaBBVA(archivo, fechaHasta)
      setEstadoCuenta(ec)
      // El rango real de búsqueda se toma del propio archivo (± tolerancia de match), no del
      // fechaDesde/fechaHasta tipeado por el usuario — así nunca puede cruzar con registros
      // de un período que el estado de cuenta subido no cubre.
      const rangoArchivo = rangoDesdeMovimientos(ec.movimientos)
      if (!rangoArchivo) throw new Error('No se pudo determinar el rango de fechas del archivo.')
      const registros = await getRegistrosPagables(Number(cuentaId), rangoArchivo.desde, rangoArchivo.hasta)
      const res = conciliar(ec.movimientos, registros)
      setResultado(res)
      setTab('conciliados')
      toast.success('Conciliación generada')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al procesar el archivo')
    } finally {
      setLoading(false)
    }
  }

  async function handleExportar() {
    if (!resultado || !cuentaSel) return
    await exportarConciliacionExcel(resultado, `${cuentaSel.banco}_${cuentaSel.numero_cuenta}`, fechaDesde, fechaHasta)
  }

  async function handleGuardar() {
    if (!resultado || !cuentaId || !user?.id) return
    setSaving(true)
    try {
      await guardarConciliacion(
        Number(cuentaId), fechaDesde, fechaHasta,
        estadoCuenta?.saldoAnterior ?? null,
        estadoCuenta?.movimientos.at(-1)?.saldo_contable ?? null,
        archivo?.name ?? null, user.id, resultado,
      )
      toast.success('Conciliación guardada')
    } catch {
      toast.error('Error al guardar la conciliación')
    } finally {
      setSaving(false)
    }
  }

  const totalConciliados = resultado ? resultado.conciliados.reduce((s, m) => s + Math.abs(m.movimiento.monto), 0) : 0
  const totalSoloBanco = resultado ? resultado.sinMatchBanco.reduce((s, m) => s + Math.abs(m.movimiento.monto), 0) : 0
  const totalSoloSistema = resultado ? resultado.sinMatchSistema.reduce((s, r) => s + r.monto, 0) : 0

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-[#003D7D]/10 flex items-center justify-center">
          <Landmark size={20} className="text-[#003D7D]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Conciliación Bancaria</h1>
          <p className="text-sm text-gray-500">Cruza el estado de cuenta del banco contra los pagos registrados en AVENIR</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cuenta bancaria</label>
            <select className="w-full h-10 mt-1 px-3 rounded-xl border border-gray-200 text-sm bg-white"
              value={cuentaId} onChange={e => setCuentaId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">— Selecciona —</option>
              {cuentas.map(c => (
                <option key={c.id} value={c.id}>
                  {c.proyecto?.nombre ?? ''} · {c.banco} · {c.numero_cuenta}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha desde</label>
            <input type="date" className="w-full h-10 mt-1 px-3 rounded-xl border border-gray-200 text-sm"
              value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha hasta</label>
            <input type="date" className="w-full h-10 mt-1 px-3 rounded-xl border border-gray-200 text-sm"
              value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado de cuenta (.xlsb/.xlsx)</label>
            <label className="flex items-center gap-2 h-10 mt-1 px-3 rounded-xl border border-dashed border-gray-300 cursor-pointer hover:border-[#003D7D] transition-colors">
              <Upload size={14} className="text-gray-400 shrink-0" />
              <span className="text-sm text-gray-500 truncate">{archivo ? archivo.name : 'Seleccionar archivo…'}</span>
              <input type="file" accept=".xlsb,.xlsx,.xls" className="hidden"
                onChange={e => setArchivo(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        </div>
        <button onClick={handleConciliar} disabled={loading}
          className="flex items-center gap-2 h-10 px-5 rounded-xl bg-[#003D7D] text-white text-sm font-semibold hover:bg-[#002D5C] disabled:opacity-50 transition-colors">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          Conciliar
        </button>
      </div>

      {resultado && (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Conciliados</p>
              <p className="text-2xl font-bold text-emerald-800 mt-1">{resultado.conciliados.length}</p>
              <p className="text-sm text-emerald-700">S/ {fmt(totalConciliados)}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Solo en el banco</p>
              <p className="text-2xl font-bold text-amber-800 mt-1">{resultado.sinMatchBanco.length}</p>
              <p className="text-sm text-amber-700">S/ {fmt(totalSoloBanco)}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Solo en AVENIR</p>
              <p className="text-2xl font-bold text-amber-800 mt-1">{resultado.sinMatchSistema.length}</p>
              <p className="text-sm text-amber-700">S/ {fmt(totalSoloSistema)}</p>
            </div>
          </div>

          {/* Tabs + acciones */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                {([
                  ['conciliados', `Conciliados (${resultado.conciliados.length})`],
                  ['banco', `Solo en el banco (${resultado.sinMatchBanco.length})`],
                  ['sistema', `Solo en AVENIR (${resultado.sinMatchSistema.length})`],
                ] as [Tab, string][]).map(([key, label]) => (
                  <button key={key} onClick={() => setTab(key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      tab === key ? 'bg-[#003D7D] text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleExportar}
                  className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                  <Download size={13} /> Descargar
                </button>
                <button onClick={handleGuardar} disabled={saving}
                  className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  Guardar
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              {tab === 'conciliados' && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Descripción banco</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Monto banco</th>
                      <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Coincide con (AVENIR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {resultado.conciliados.map((mc, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{mc.movimiento.fecha_oper}</td>
                        <td className="px-4 py-2.5 text-gray-800 max-w-[260px] truncate">{mc.movimiento.descripcion}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{fmt(Math.abs(mc.movimiento.monto))}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${mc.estado === 'grupo' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {mc.estado === 'grupo' ? 'Grupo' : 'Individual'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">
                          {mc.registros.map(r => `${r.codigo ?? r.id} — ${r.beneficiario ?? ''} (S/ ${fmt(r.monto)})`).join(' · ')}
                        </td>
                      </tr>
                    ))}
                    {resultado.conciliados.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">Sin coincidencias</td></tr>
                    )}
                  </tbody>
                </table>
              )}

              {tab === 'banco' && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Descripción</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">N° Operación</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {resultado.sinMatchBanco.map((mc, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{mc.movimiento.fecha_oper}</td>
                        <td className="px-4 py-2.5 text-gray-800">{mc.movimiento.descripcion}</td>
                        <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{mc.movimiento.n_operacion}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-amber-700">{fmt(Math.abs(mc.movimiento.monto))}</td>
                      </tr>
                    ))}
                    {resultado.sinMatchBanco.length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">
                        <CheckCircle2 size={20} className="mx-auto mb-1 text-emerald-400" /> Todo lo que salió del banco fue identificado
                      </td></tr>
                    )}
                  </tbody>
                </table>
              )}

              {tab === 'sistema' && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Módulo</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Código</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Beneficiario</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Fecha de pago</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {resultado.sinMatchSistema.map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-600">{r.modulo}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-[#003D7D]">{r.codigo ?? r.id}</td>
                        <td className="px-4 py-2.5 text-gray-800">{r.beneficiario}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">{r.fecha_pago}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-amber-700">{fmt(r.monto)}</td>
                      </tr>
                    ))}
                    {resultado.sinMatchSistema.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">
                        <AlertTriangle size={20} className="mx-auto mb-1 text-gray-300" /> No hay registros pendientes de aparecer en el banco
                      </td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
