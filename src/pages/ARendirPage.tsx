import { useNavigate } from 'react-router-dom'
import { Plus, Eye, Loader2, Receipt, Download, Filter } from 'lucide-react'
import ExcelJS from 'exceljs'
import toast from 'react-hot-toast'
import { useState, useEffect } from 'react'
import { useARendir } from '../features/arendir/hooks/useArendir'
import { useAuthStore } from '../store/authStore'
import { ROLES } from '../features/solicitud/types/solicitud'
import { sanitizeBBVA } from '../features/solicitud/constants/bancos'
import type { SolicitudARendir } from '../features/arendir/types/arendir'
import { getProyectos } from '../features/proyecto/services/proyectoService'
import type { Proyecto } from '../features/proyecto/types/proyecto'

// ── Badge de estado ────────────────────────────────────────────
function EstadoBadge({ estado }: { estado: SolicitudARendir['estado'] }) {
  const map: Record<string, string> = {
    'Pendiente':   'bg-yellow-100 text-yellow-800',
    'Aprobado':    'bg-emerald-100 text-emerald-800',
    'Pagado':      'bg-blue-100 text-blue-800',
    'En Revision': 'bg-purple-100 text-purple-800',
    'Cerrado':     'bg-green-100 text-green-800',
    'Observado':   'bg-amber-100 text-amber-800',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[estado] ?? 'bg-gray-100 text-gray-700'}`}>
      {estado}
    </span>
  )
}

// ── Formatters ─────────────────────────────────────────────────
function fmtMoney(val: number, moneda = 'PEN') {
  const sym = moneda === 'USD' ? '$ ' : 'S/ '
  const loc = moneda === 'USD' ? 'en-US' : 'es-PE'
  return `${sym}${val.toLocaleString(loc, { minimumFractionDigits: 2 })}`
}

function fmtDate(val: string | null) {
  if (!val) return '—'
  return new Date(val.includes('T') ? val : val + 'T00:00:00').toLocaleDateString('es-PE')
}

// ── Page ───────────────────────────────────────────────────────
const ESTADOS_ARENDIR: Record<string, string[]> = {
  default:      ['Pendiente', 'Aprobado', 'Pagado', 'En Revision', 'Cerrado'],
  aprobador:    ['Pendiente', 'Aprobado'],
  evaluador:    ['En Revision', 'Cerrado'],
  visualizador: ['Aprobado', 'Pagado', 'En Revision', 'Cerrado'],
}

export default function ARendirPage() {
  const navigate   = useNavigate()
  const { userRole } = useAuthStore()
  const {
    data, total, page, pageSize, totalPages, loading,
    estadoFilter, proyectoFilter,
    setPage, setEstadoFilter, setProyectoFilter, refresh,
  } = useARendir()

  const canCreate      = userRole === ROLES.USUARIO || userRole === ROLES.ADMIN
  const isVisualizador = userRole === ROLES.VISUALIZADOR || userRole === ROLES.ADMIN

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [proyectos,   setProyectos]   = useState<Proyecto[]>([])

  useEffect(() => {
    getProyectos({ pageSize: 100 })
      .then(r => setProyectos(r.data))
      .catch(() => {/* silencioso */})
  }, [])

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selectedIds.size === data.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(data.map(d => d.id)))
    }
  }

  async function handleExport() {
    const selected = data.filter(s => selectedIds.has(s.id))
    if (selected.length === 0) return

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Pagos A Rendir')

    ws.addRow([
      'DOI tipo', 'DOI Numero', 'Tipo abono', 'Cuenta', 'Nombre del beneficiario',
      'Importe abonar', 'Tipo recibo', 'Numero documento', 'Abono Agrupado', 'Referencia',
      'Indicador de Aviso', 'Medio de aviso', 'Persona Contacto', 'Validacion',
    ])

    selected.forEach((s, idx) => {
      ws.addRow([
        'L',
        s.beneficiario_dni ?? '',
        s.banco === 'BBVA' ? 'P' : 'I',
        s.numero_cuenta ?? '',
        sanitizeBBVA(s.beneficiario_nombre),
        s.total_reembolso ?? 0,
        'B',
        String(idx + 1).padStart(3, '0'),
        'N',
        'A Rendir',
        'E',
        s.beneficiario_email ?? '',
        '',
        '',
      ])
    })

    const buffer = await wb.xlsx.writeBuffer()
    const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url    = URL.createObjectURL(blob)
    const a      = document.createElement('a')
    a.href       = url
    a.download   = `arendir_pagos_${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Excel generado con ${selected.length} registro${selected.length > 1 ? 's' : ''}`)
  }

  return (
    <div className="p-6 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#003D7D]/10 flex items-center justify-center">
            <Receipt size={20} className="text-[#003D7D]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">A Rendir</h1>
            <p className="text-sm text-gray-500">{total} registro{total !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isVisualizador && selectedIds.size > 0 && (
            <button
              onClick={handleExport}
              className="flex items-center gap-2 h-9 px-4 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors"
            >
              <Download size={15} />
              Excel ({selectedIds.size})
            </button>
          )}
          {canCreate && (
            <button
              onClick={() => navigate('/arendir/nueva')}
              className="flex items-center gap-2 h-9 px-4 rounded-xl bg-[#003D7D] text-white text-sm font-semibold hover:bg-[#002D5C] transition-colors"
            >
              <Plus size={16} />
              Nueva solicitud
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
          <Filter size={13} /> Filtrar
        </div>

        {/* Estado */}
        <select
          value={estadoFilter ?? ''}
          onChange={e => setEstadoFilter(e.target.value || null)}
          className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20"
        >
          <option value="">Todos los estados</option>
          {(
            userRole === ROLES.APROBADOR    ? ESTADOS_ARENDIR.aprobador    :
            userRole === ROLES.EVALUADOR    ? ESTADOS_ARENDIR.evaluador    :
            userRole === ROLES.VISUALIZADOR ? ESTADOS_ARENDIR.visualizador :
            ESTADOS_ARENDIR.default
          ).map(e => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>

        {/* Proyecto */}
        <select
          value={proyectoFilter ?? ''}
          onChange={e => setProyectoFilter(e.target.value ? Number(e.target.value) : null)}
          className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20"
        >
          <option value="">Todas las empresas</option>
          {proyectos.map(p => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>

        {/* Limpiar */}
        {(estadoFilter || proyectoFilter) && (
          <button
            onClick={() => { setEstadoFilter(null); setProyectoFilter(null) }}
            className="h-9 px-3 rounded-xl border border-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 size={24} className="animate-spin mr-2" />
            Cargando...
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
            <Receipt size={36} className="text-gray-300" />
            <p className="text-sm">No hay solicitudes A Rendir</p>
            {canCreate && (
              <button
                onClick={() => navigate('/arendir/nueva')}
                className="mt-2 text-sm text-[#003D7D] font-semibold hover:underline"
              >
                Crear la primera
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {isVisualizador && (
                    <th className="px-4 py-3 w-8">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === data.length && data.length > 0}
                        onChange={toggleAll}
                        className="rounded"
                      />
                    </th>
                  )}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Código</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Beneficiario</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Empresa</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Importe</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Reembolso</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha solicitud</th>
                  {isVisualizador && (
                    <>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha requerida</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha aprobación</th>
                    </>
                  )}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    {isVisualizador && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          className="rounded"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 font-mono text-xs text-[#003D7D] font-semibold">
                      {item.codigo ?? `#${item.id}`}
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-medium">
                      {item.beneficiario_nombre ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {item.proyecto?.nombre ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {fmtMoney(item.importe, item.moneda)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {fmtMoney(item.total_reembolso, item.moneda)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <EstadoBadge estado={item.estado} />
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {fmtDate(item.fecha_creacion)}
                    </td>
                    {isVisualizador && (
                      <>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {fmtDate(item.fecha_rendicion)}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {fmtDate(item.fecha_aprobacion)}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/arendir/${item.id}`)}
                        className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-100 hover:border-gray-300 transition-colors"
                      >
                        <Eye size={13} />
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500">
              Mostrando {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="h-8 px-3 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-white disabled:opacity-40 transition-colors"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="h-8 px-3 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-white disabled:opacity-40 transition-colors"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Unused refresh workaround */}
      <span className="hidden" onClick={refresh} />
    </div>
  )
}
