import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Eye, Loader2, RotateCcw, Download, Filter } from 'lucide-react'
import ExcelJS from 'exceljs'
import toast from 'react-hot-toast'
import { useDevolucion } from '../features/devolucion/hooks/useDevolucion'
import { useAuthStore } from '../store/authStore'
import { ROLES } from '../features/solicitud/types/solicitud'
import { sanitizeBBVA } from '../features/solicitud/constants/bancos'
import type { DevolucionCliente } from '../features/devolucion/types/devolucion'
import { getProyectos } from '../features/proyecto/services/proyectoService'
import type { Proyecto } from '../features/proyecto/types/proyecto'

const ESTADOS = ['Pendiente', 'Autorizado', 'Rechazado']

function EstadoBadge({ estado }: { estado: DevolucionCliente['estado'] }) {
  const map: Record<string, string> = {
    'Pendiente':  'bg-yellow-100 text-yellow-800',
    'Autorizado': 'bg-green-100 text-green-800',
    'Rechazado':  'bg-red-100 text-red-800',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[estado] ?? 'bg-gray-100 text-gray-700'}`}>
      {estado}
    </span>
  )
}

function fmtMoney(val: number | null, moneda = 'PEN') {
  if (val == null) return '—'
  const sym = moneda === 'USD' ? '$ ' : 'S/ '
  return `${sym}${val.toLocaleString(moneda === 'USD' ? 'en-US' : 'es-PE', { minimumFractionDigits: 2 })}`
}

function fmtDate(val: string | null) {
  if (!val) return '—'
  return new Date(val.includes('T') ? val : val + 'T00:00:00').toLocaleDateString('es-PE')
}

export default function DevolucionPage() {
  const navigate = useNavigate()
  const { userRole } = useAuthStore()
  const {
    data, total, page, totalPages, loading,
    estadoFilter, proyectoFilter,
    setPage, setEstadoFilter, setProyectoFilter,
  } = useDevolucion()

  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    getProyectos({ page: 1, pageSize: 100 }).then(r => setProyectos(r.data)).catch(() => {})
  }, [])

  const canCreate = userRole === ROLES.USUARIO || userRole === ROLES.ADMIN
  const canExport = userRole === ROLES.VISUALIZADOR || userRole === ROLES.ADMIN

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleExport() {
    const selected = data.filter(s => selectedIds.has(s.id))
    if (selected.length === 0) return

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Pagos Devolución')

    ws.addRow([
      'DOI tipo', 'DOI Numero', 'Tipo abono', 'Cuenta', 'Nombre del beneficiario',
      'Importe abonar', 'Tipo recibo', 'Numero documento', 'Abono Agrupado', 'Referencia',
      'Indicador de Aviso', 'Medio de aviso', 'Persona Contacto', 'Validacion',
    ])

    selected.forEach((s, idx) => {
      ws.addRow([
        'L',
        s.cliente_dni ?? '',
        s.banco === 'BBVA' ? 'P' : 'I',
        s.numero_cuenta ?? '',
        sanitizeBBVA(s.cliente_nombre),
        s.monto ?? 0,
        'B',
        String(idx + 1).padStart(3, '0'),
        'N',
        'Devolucion Cliente',
        'E',
        s.creador_email ?? '',
        '',
        '',
      ])
    })

    const buffer = await wb.xlsx.writeBuffer()
    const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url    = URL.createObjectURL(blob)
    const a      = document.createElement('a')
    a.href       = url
    a.download   = `devolucion_pagos_${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Excel generado con ${selected.length} devolución${selected.length > 1 ? 'es' : ''}`)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <RotateCcw size={20} className="text-[#003D7D]" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Devolución de Cliente</h1>
            <p className="text-sm text-gray-500">{total} registro{total !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canExport && selectedIds.size > 0 && (
            <button onClick={handleExport}
              className="flex items-center gap-1.5 h-10 px-4 rounded-xl bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors">
              <Download size={13} /> Excel ({selectedIds.size})
            </button>
          )}
          {canCreate && (
            <button onClick={() => navigate('/devolucion/nueva')}
              className="flex items-center gap-1.5 h-10 px-4 rounded-xl bg-[#003D7D] text-white text-sm font-semibold hover:bg-[#002D5C] transition-colors">
              <Plus size={15} /> Nueva devolución
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-gray-400"><Filter size={13} /> Filtros:</div>
        <select
          value={estadoFilter ?? ''}
          onChange={e => setEstadoFilter(e.target.value || null)}
          className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 shadow-sm"
        >
          <option value="">Todos los estados</option>
          {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select
          value={proyectoFilter ?? ''}
          onChange={e => setProyectoFilter(e.target.value ? Number(e.target.value) : null)}
          className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 shadow-sm"
        >
          <option value="">Todas las empresas</option>
          {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        {(estadoFilter || proyectoFilter) && (
          <button onClick={() => { setEstadoFilter(null); setProyectoFilter(null) }}
            className="text-xs text-gray-500 hover:text-[#003D7D] underline">
            Limpiar
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">
            <Loader2 size={22} className="animate-spin mr-2" /> Cargando...
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-gray-400">
            <RotateCcw size={32} className="text-gray-200" />
            <p className="text-sm">Sin devoluciones registradas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {canExport && <th className="px-4 py-2.5 w-8" />}
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Código</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cliente</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">DNI</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Empresa</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Monto</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/devolucion/${d.id}`)}>
                    {canExport && (
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.has(d.id)} onChange={() => toggleSelect(d.id)}
                          className="rounded border-gray-300 text-[#003D7D] focus:ring-[#003D7D]/30" />
                      </td>
                    )}
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{d.codigo ?? `#${d.id}`}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{d.cliente_nombre}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{d.cliente_dni ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{d.proyecto?.nombre ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmtMoney(d.monto, d.moneda)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <EstadoBadge estado={d.estado} />
                        {d.estado === 'Autorizado' && (
                          d.fecha_pago
                            ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">Pagado</span>
                            : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700">Por pagar</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(d.fecha_creacion)}</td>
                    <td className="px-4 py-3 text-right">
                      <Eye size={15} className="text-gray-400 inline" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}
            className="h-9 px-4 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40">
            Anterior
          </button>
          <span className="text-sm text-gray-500">Página {page} de {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
            className="h-9 px-4 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40">
            Siguiente
          </button>
        </div>
      )}
    </div>
  )
}
