import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { pdf } from '@react-pdf/renderer'
import {
  ChevronLeft, ChevronRight, Plus, Trash2, Upload, Loader2, Send,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { getProyectos, getPartidasByProyecto, getConsumoByProyectos } from '../features/proyecto/services/proyectoService'
import type { ProyectoPartida } from '../features/proyecto/types/proyecto'
import type { Consumo } from '../features/proyecto/services/proyectoService'
import { BANCOS, labelNumeroCuenta, maxLengthNumeroCuenta, placeholderNumeroCuenta } from '../features/solicitud/constants/bancos'
import type { Proyecto } from '../features/proyecto/types/proyecto'
import {
  createARendir,
  enviarARendir,
  addDetalle,
  uploadSustento,
  uploadDetalleArchivo,
  uploadFirmaARendir,
  getArchivoUrl,
  recalcTotal,
  updateARendir,
} from '../features/arendir/services/arendirService'
import type { SolicitudARendir, ARendirDetalle } from '../features/arendir/types/arendir'
import { ARendirPDF } from '../features/arendir/components/ARendirPDF'
import FirmaModal from '../features/solicitud/components/FirmaModal'
import { getUserFirmaBlob } from '../features/usuario/services/usuarioService'
import { supabase } from '../api/supabase'
import logoUrl from '../assets/avenir-logo.png'

// ── Tipos locales ─────────────────────────────────────────────
interface DetalleRow {
  tempId: number
  fecha_documento: string
  proveedor: string
  tipo_documento: string
  numero_documento: string
  concepto: string
  importe: string
  file: File | null
  savedId: number | null
  archivo_path: string | null
}

const TIPOS_DOC = ['RECIBO', 'FACTURA', 'BOLETA', 'PLLA-MOV', 'TICKET', 'OTRO']

let nextTempId = 1

function newRow(): DetalleRow {
  return {
    tempId: nextTempId++,
    fecha_documento: '',
    proveedor: '',
    tipo_documento: '',
    numero_documento: '',
    concepto: '',
    importe: '',
    file: null,
    savedId: null,
    archivo_path: null,
  }
}

// ── Component ─────────────────────────────────────────────────
export default function ARendirNuevaPage() {
  const navigate = useNavigate()
  const { user, usuarioProfile, userRole } = useAuthStore()
  const canVerConsumo = userRole === 1 || userRole === 9

  const [step, setStep] = useState<1 | 2>(1)
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [saving, setSaving] = useState(false)
  const [solicitudCreada, setSolicitudCreada] = useState<SolicitudARendir | null>(null)

  // Step 1 form
  const [dniEdit, setDniEdit] = useState(usuarioProfile?.dni ?? '')
  const [proyectoId,      setProyectoId]      = useState<string>('')
  const [partidaId,       setPartidaId]       = useState<string>('')
  const [partidas,        setPartidas]        = useState<ProyectoPartida[]>([])
  const [moneda, setMoneda] = useState<'PEN' | 'USD'>('PEN')
  const [importe, setImporte] = useState('')
  const [fechaRendicion, setFechaRendicion] = useState('')
  const [banco, setBanco] = useState('')
  const [numeroCuenta, setNumeroCuenta] = useState('')
  const [sustentoFile, setSustentoFile] = useState<File | null>(null)

  // Step 2
  const [rows, setRows] = useState<DetalleRow[]>([newRow()])

  // Firma modal
  const [firmaOpen, setFirmaOpen] = useState(false)
  const [firmaBlob, setFirmaBlob] = useState<Blob | null>(null)

  // Load proyectos
  useEffect(() => {
    getProyectos({ pageSize: 100 })
      .then(r => setProyectos(r.data))
      .catch(() => toast.error('No se pudieron cargar los proyectos'))
  }, [])

  // Load partidas and consumo when proyecto changes
  const [consumoPartidas, setConsumoPartidas] = useState<Record<number, Consumo>>({})

  useEffect(() => {
    setPartidaId('')
    setPartidas([])
    setConsumoPartidas({})
    if (!proyectoId) return
    const pid = Number(proyectoId)
    Promise.all([
      getPartidasByProyecto(pid),
      canVerConsumo ? getConsumoByProyectos([pid]) : Promise.resolve(null),
    ])
      .then(([parts, c]) => {
        setPartidas(parts as ProyectoPartida[])
        if (c) setConsumoPartidas((c as { porPartida: Record<number, Consumo> }).porPartida)
      })
      .catch(() => {})
  }, [proyectoId, canVerConsumo])

  // ── Step 1: Guardar ──────────────────────────────────────────
  async function handleStep1() {
    if (!user?.id) return
    if (!importe || isNaN(Number(importe))) {
      toast.error('Ingresa un importe válido')
      return
    }
    if (partidas.length > 0 && !partidaId) {
      toast.error('Selecciona una partida del proyecto')
      return
    }
    setSaving(true)
    try {
      // Actualizar DNI si cambió
      if (dniEdit !== (usuarioProfile?.dni ?? '')) {
        await supabase.from('usuario').update({ dni: dniEdit || null }).eq('id', user.id)
      }

      const sol = await createARendir({
        beneficiario_id: user.id,
        proyecto_id: proyectoId ? Number(proyectoId) : null,
        proyecto_partida_id: partidaId ? Number(partidaId) : null,
        importe: Number(importe),
        moneda,
        fecha_rendicion: fechaRendicion || null,
        estado: 'Pendiente',
        banco: banco || null,
        numero_cuenta: numeroCuenta || null,
        documento_sustento_path: null,
      })

      // Upload sustento
      if (sustentoFile) {
        const path = await uploadSustento(sustentoFile, sol.id)
        await updateARendir(sol.id, { documento_sustento_path: path })
        sol.documento_sustento_path = path
      }

      sol.beneficiario_nombre = usuarioProfile?.nombre_completo ?? null
      sol.beneficiario_dni    = dniEdit || null
      sol.beneficiario_cargo  = usuarioProfile?.cargo ?? null
      setSolicitudCreada(sol)
      setStep(2)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  // ── Step 2: Modificar filas ──────────────────────────────────
  function updateRow(tempId: number, field: keyof DetalleRow, value: string | File | null) {
    setRows(prev => prev.map(r => r.tempId === tempId ? { ...r, [field]: value } : r))
  }

  function addRow() {
    setRows(prev => [...prev, newRow()])
  }

  function removeRow(tempId: number) {
    setRows(prev => prev.length > 1 ? prev.filter(r => r.tempId !== tempId) : prev)
  }

  const totalDetalle = rows.reduce((acc, r) => acc + (parseFloat(r.importe) || 0), 0)

  // ── Step 2: Guardar detalles y enviar ────────────────────────
  async function handleEnviar() {
    if (!solicitudCreada || !user?.id) return

    // Intentar obtener firma del usuario
    let blob: Blob | null = firmaBlob
    if (!blob && usuarioProfile?.firma_path) {
      try {
        blob = await getUserFirmaBlob(usuarioProfile.firma_path)
      } catch {
        // no hay firma previa
      }
    }

    if (!blob) {
      setFirmaOpen(true)
      return
    }

    await doEnviar(blob)
  }

  async function doEnviar(blob: Blob) {
    if (!solicitudCreada || !user?.id) return
    setSaving(true)
    try {
      // Guardar detalles
      const savedDetalles: ARendirDetalle[] = []
      for (const row of rows) {
        if (!row.concepto && !row.importe) continue
        const det = await addDetalle({
          solicitud_arendir_id: solicitudCreada.id,
          fecha_documento: row.fecha_documento || null,
          proveedor: row.proveedor || null,
          tipo_documento: row.tipo_documento || null,
          numero_documento: row.numero_documento || null,
          concepto: row.concepto || null,
          importe: parseFloat(row.importe) || 0,
          archivo_path: null,
        })

        // Upload archivo de detalle
        if (row.file) {
          const path = await uploadDetalleArchivo(row.file, solicitudCreada.id, det.id)
          await supabase.from('solicitud_arendir_detalle').update({ archivo_path: path }).eq('id', det.id)
          det.archivo_path = path
        }
        savedDetalles.push(det)
      }

      // Recalc total
      await recalcTotal(solicitudCreada.id)

      // Subir firma usuario
      const firmaPath = await uploadFirmaARendir(blob, solicitudCreada.id, 'firma_usuario')

      // Generar PDF
      let firmaUsuarioSrc: string | null = null
      try {
        firmaUsuarioSrc = await getArchivoUrl(firmaPath)
      } catch { /* sin firma */ }

      const enrichedSol: SolicitudARendir = {
        ...solicitudCreada,
        total_reembolso: totalDetalle,
        beneficiario_nombre: usuarioProfile?.nombre_completo ?? null,
        beneficiario_dni:    usuarioProfile?.dni ?? null,
        beneficiario_cargo:  usuarioProfile?.cargo ?? null,
      }

      const pdfBlob = await pdf(
        <ARendirPDF
          solicitud={enrichedSol}
          detalles={savedDetalles}
          logoSrc={logoUrl}
          firmaUsuarioSrc={firmaUsuarioSrc}
          firmaAprobadorSrc={null}
        />
      ).toBlob()

      // Descargar PDF
      const url = URL.createObjectURL(pdfBlob)
      const a   = document.createElement('a')
      a.href    = url
      a.download = `${solicitudCreada.codigo ?? `AR-${solicitudCreada.id}`}.pdf`
      a.click()
      URL.revokeObjectURL(url)

      // Enviar a revisión
      await enviarARendir(solicitudCreada.id)

      toast.success('Solicitud enviada a revisión')
      navigate('/arendir')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al enviar')
    } finally {
      setSaving(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => step === 1 ? navigate('/arendir') : setStep(1)}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nueva solicitud A Rendir</h1>
          <p className="text-sm text-gray-500">Paso {step} de 2</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2].map(n => (
          <div key={n} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
              step === n ? 'bg-[#003D7D] text-white' :
              step > n   ? 'bg-green-500 text-white' :
                           'bg-gray-200 text-gray-500'
            }`}>
              {n}
            </div>
            {n < 2 && <div className="w-12 h-0.5 bg-gray-200" />}
          </div>
        ))}
        <span className="ml-2 text-sm text-gray-500">
          {step === 1 ? 'Datos generales' : 'Detalle de gastos'}
        </span>
      </div>

      {/* ── STEP 1 ── */}
      {step === 1 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-900">Datos generales</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Beneficiario read-only */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Beneficiario</label>
              <input
                readOnly
                value={usuarioProfile?.nombre_completo ?? usuarioProfile?.correo ?? ''}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-600 cursor-not-allowed"
              />
            </div>

            {/* DNI editable */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">DNI</label>
              <input
                type="text"
                value={dniEdit}
                onChange={e => setDniEdit(e.target.value)}
                maxLength={8}
                placeholder="12345678"
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/30 focus:border-[#003D7D]"
              />
            </div>

            {/* Proyecto */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Proyecto</label>
              <select
                value={proyectoId}
                onChange={e => setProyectoId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/30 focus:border-[#003D7D] bg-white"
              >
                <option value="">— Sin proyecto —</option>
                {proyectos.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>

            {/* Partida — solo si el proyecto tiene partidas */}
            {partidas.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Partida *</label>
              <select
                value={partidaId}
                onChange={e => setPartidaId(e.target.value)}
                className={`w-full h-10 px-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/30 focus:border-[#003D7D] bg-white ${!partidaId ? 'border-orange-300' : 'border-gray-200'}`}
              >
                <option value="">Seleccionar partida</option>
                {partidas.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
              {!partidaId && <p className="text-xs text-orange-500">Selecciona una partida para continuar</p>}
              {canVerConsumo && (() => {
                if (!partidaId) return null
                const sel = partidas.find(p => p.id === Number(partidaId))
                const c = consumoPartidas[Number(partidaId)]
                if (!sel || !c) return null
                const pres = moneda === 'USD' ? sel.presupuesto_usd : sel.presupuesto_pen
                const cons = moneda === 'USD' ? c.usd : c.pen
                if (pres <= 0) return null
                const pct = (cons / pres) * 100
                const sym = moneda === 'USD' ? '$' : 'S/'
                const saldo = pres - cons
                if (pct <= 80) return (
                  <p className="text-[11px] text-emerald-600">
                    Saldo disponible: {sym} {saldo.toLocaleString('es-PE', { minimumFractionDigits: 2 })} ({(100 - pct).toFixed(0)}%)
                  </p>
                )
                return (
                  <div className={`flex items-start gap-1.5 px-3 py-2 rounded-lg text-xs ${pct >= 100 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                    <span className="shrink-0 mt-0.5">⚠️</span>
                    <span>{pct >= 100
                      ? `Presupuesto agotado — consumido ${sym} ${cons.toLocaleString('es-PE', { minimumFractionDigits: 2 })} de ${sym} ${pres.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
                      : `Presupuesto al ${pct.toFixed(0)}% — saldo: ${sym} ${saldo.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`}
                    </span>
                  </div>
                )
              })()}
            </div>
            )}

            {/* Moneda */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Moneda</label>
              <select
                value={moneda}
                onChange={e => setMoneda(e.target.value as 'PEN' | 'USD')}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/30 focus:border-[#003D7D] bg-white"
              >
                <option value="PEN">S/ Soles (PEN)</option>
                <option value="USD">$ Dólares (USD)</option>
              </select>
            </div>

            {/* Importe */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Importe adelanto ({moneda === 'USD' ? '$' : 'S/'})
              </label>
              <input
                type="number"
                value={importe}
                onChange={e => setImporte(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/30 focus:border-[#003D7D]"
              />
            </div>

            {/* Fecha requerida */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Fecha requerida</label>
              <input
                type="date"
                value={fechaRendicion}
                onChange={e => setFechaRendicion(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/30 focus:border-[#003D7D]"
              />
            </div>

            {/* Banco */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Banco</label>
              <select
                value={banco}
                onChange={e => { setBanco(e.target.value); setNumeroCuenta('') }}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/30 focus:border-[#003D7D] bg-white"
              >
                <option value="">— Seleccionar banco —</option>
                {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            {/* Número de cuenta / CCI */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                {banco ? labelNumeroCuenta(banco) : 'Número de cuenta / CCI'}
              </label>
              <input
                type="text"
                value={numeroCuenta}
                onChange={e => setNumeroCuenta(e.target.value)}
                maxLength={banco ? maxLengthNumeroCuenta(banco) : 20}
                placeholder={banco ? placeholderNumeroCuenta(banco) : '—'}
                disabled={!banco}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/30 focus:border-[#003D7D] disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>

            {/* Sustento */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Documento sustento</label>
              <label className="flex items-center gap-2 h-10 px-3 rounded-xl border border-dashed border-gray-300 cursor-pointer hover:border-[#003D7D] hover:bg-[#003D7D]/[0.02] transition-colors">
                <Upload size={14} className="text-gray-400" />
                <span className="text-sm text-gray-500 truncate">
                  {sustentoFile ? sustentoFile.name : 'Seleccionar archivo…'}
                </span>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  onChange={e => setSustentoFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleStep1}
              disabled={saving}
              className="flex items-center gap-2 h-10 px-6 rounded-xl bg-[#003D7D] text-white text-sm font-semibold hover:bg-[#002D5C] disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2 ── */}
      {step === 2 && solicitudCreada && (
        <div className="space-y-4">
          {/* Info card */}
          <div className="bg-[#003D7D]/[0.04] border border-[#003D7D]/20 rounded-2xl px-5 py-3 flex items-center gap-4 text-sm">
            <span className="font-mono font-bold text-[#003D7D]">{solicitudCreada.codigo}</span>
            <span className="text-gray-600">Importe adelanto: <strong>{moneda === 'USD' ? '$' : 'S/'} {Number(importe).toLocaleString(moneda === 'USD' ? 'en-US' : 'es-PE', { minimumFractionDigits: 2 })}</strong></span>
          </div>

          {/* Detail table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Detalle de gastos</h2>
              <button
                onClick={addRow}
                className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-[#003D7D]/30 text-xs font-semibold text-[#003D7D] hover:bg-[#003D7D]/[0.04] transition-colors"
              >
                <Plus size={13} /> Agregar fila
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide w-28">Fecha Doc.</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide">Proveedor</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide w-32">Tipo Doc.</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide w-28">N° Doc.</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide">Concepto</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide w-24">Importe</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide w-28">Archivo</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map(row => (
                    <tr key={row.tempId} className="hover:bg-gray-50">
                      <td className="px-2 py-1.5">
                        <input
                          type="date"
                          value={row.fecha_documento}
                          onChange={e => updateRow(row.tempId, 'fecha_documento', e.target.value)}
                          className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-[#003D7D]/40"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={row.proveedor}
                          onChange={e => updateRow(row.tempId, 'proveedor', e.target.value)}
                          placeholder="Proveedor"
                          className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-[#003D7D]/40"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          list={`tipos-${row.tempId}`}
                          value={row.tipo_documento}
                          onChange={e => updateRow(row.tempId, 'tipo_documento', e.target.value)}
                          placeholder="Tipo"
                          className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-[#003D7D]/40"
                        />
                        <datalist id={`tipos-${row.tempId}`}>
                          {TIPOS_DOC.map(t => <option key={t} value={t} />)}
                        </datalist>
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={row.numero_documento}
                          onChange={e => updateRow(row.tempId, 'numero_documento', e.target.value)}
                          placeholder="N° doc"
                          className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-[#003D7D]/40"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={row.concepto}
                          onChange={e => updateRow(row.tempId, 'concepto', e.target.value)}
                          placeholder="Concepto / descripción"
                          className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-[#003D7D]/40"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          value={row.importe}
                          onChange={e => updateRow(row.tempId, 'importe', e.target.value)}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs text-right focus:outline-none focus:ring-1 focus:ring-[#003D7D]/40"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <label className="flex items-center gap-1 h-8 px-2 rounded-lg border border-dashed border-gray-300 cursor-pointer hover:border-[#003D7D] transition-colors">
                          <Upload size={11} className="text-gray-400 shrink-0" />
                          <span className="truncate text-gray-500 max-w-[60px]">
                            {row.file ? row.file.name.slice(0, 8) + '…' : 'Adjuntar'}
                          </span>
                          <input
                            type="file"
                            accept="application/pdf,image/*"
                            className="hidden"
                            onChange={e => updateRow(row.tempId, 'file', e.target.files?.[0] ?? null)}
                          />
                        </label>
                      </td>
                      <td className="px-2 py-1.5">
                        <button
                          onClick={() => removeRow(row.tempId)}
                          disabled={rows.length <= 1}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#003D7D]/[0.04] border-t-2 border-[#003D7D]/20">
                    <td colSpan={5} className="px-3 py-2.5 text-xs font-bold text-gray-700 text-right uppercase">
                      Total a reembolsar:
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-[#003D7D] text-sm">
                      {moneda === 'USD' ? '$' : 'S/'} {totalDetalle.toLocaleString(moneda === 'USD' ? 'en-US' : 'es-PE', { minimumFractionDigits: 2 })}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Saldo info */}
          {importe && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 text-sm text-amber-800">
              {(() => {
              const sym = moneda === 'USD' ? '$' : 'S/'
              const loc = moneda === 'USD' ? 'en-US' : 'es-PE'
              const diff = Number(importe) - totalDetalle
              return diff >= 0
                ? `El usuario debe devolver: ${sym} ${diff.toLocaleString(loc, { minimumFractionDigits: 2 })}`
                : `La empresa reembolsa al usuario: ${sym} ${Math.abs(diff).toLocaleString(loc, { minimumFractionDigits: 2 })}`
            })()}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(1)}
              disabled={saving}
              className="flex items-center gap-2 h-10 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <ChevronLeft size={16} /> Anterior
            </button>
            <button
              onClick={handleEnviar}
              disabled={saving}
              className="flex items-center gap-2 h-10 px-6 rounded-xl bg-[#003D7D] text-white text-sm font-semibold hover:bg-[#002D5C] disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Enviar a revisión
            </button>
          </div>
        </div>
      )}

      {/* Firma modal */}
      <FirmaModal
        open={firmaOpen}
        title="Firma del rendidor"
        onClose={() => setFirmaOpen(false)}
        onConfirm={async (blob) => {
          setFirmaBlob(blob)
          setFirmaOpen(false)
          await doEnviar(blob)
        }}
      />
    </div>
  )
}
