import { useNavigate } from 'react-router-dom'
import { Plus, Eye, Loader2, Receipt } from 'lucide-react'
import { useARendir } from '../features/arendir/hooks/useArendir'
import { useAuthStore } from '../store/authStore'
import { ROLES } from '../features/solicitud/types/solicitud'
import type { SolicitudARendir } from '../features/arendir/types/arendir'

// ── Badge de estado ───────────────────────────────────────────
function EstadoBadge({ estado }: { estado: SolicitudARendir['estado'] }) {
  const map: Record<string, string> = {
    'Pendiente':   'bg-yellow-100 text-yellow-800',
    'En Revision': 'bg-blue-100 text-blue-800',
    'Autorizado':  'bg-green-100 text-green-800',
    'Rechazado':   'bg-red-100 text-red-800',
    'Devuelto':    'bg-orange-100 text-orange-800',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[estado] ?? 'bg-gray-100 text-gray-700'}`}>
      {estado}
    </span>
  )
}

// ── Formatters ────────────────────────────────────────────────
function fmtMoney(val: number) {
  return `S/ ${val.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
}

function fmtDate(val: string | null) {
  if (!val) return '—'
  return new Date(val.includes('T') ? val : val + 'T00:00:00').toLocaleDateString('es-PE')
}

// ── Page ──────────────────────────────────────────────────────
export default function ARendirPage() {
  const navigate  = useNavigate()
  const { userRole } = useAuthStore()
  const { data, total, page, pageSize, totalPages, loading, setPage, refresh } = useARendir()

  const canCreate = userRole === ROLES.USUARIO || userRole === ROLES.ADMIN

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
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Código</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Beneficiario</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Proyecto</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Importe</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Reembolso</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
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
                      {fmtMoney(item.importe)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {fmtMoney(item.total_reembolso)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <EstadoBadge estado={item.estado} />
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {fmtDate(item.fecha_creacion)}
                    </td>
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
