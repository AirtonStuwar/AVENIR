import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Building, RefreshCw, Loader2, Pencil, X, Info } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import { ROLES } from '../features/solicitud/types/solicitud'
import { getProyectosConMobysuite, updateProyecto } from '../features/proyecto/services/proyectoService'
import type { Proyecto } from '../features/proyecto/types/proyecto'
import { getStatusMobysuite, type StatusMobysuite } from '../features/status-proyecto/services/statusProyectoService'

const AZUL = '#003D7D'
const CELESTE = '#8CB8E8'
const GRIS = '#C3C8D0'

const fmtS = (n: number) => `S/ ${n.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`
const fmtN = (n: number) => n.toLocaleString('es-PE', { maximumFractionDigits: 0 })
const pct = (n: number) => `${n.toLocaleString('es-PE', { maximumFractionDigits: 1 })}%`

interface Cargado { status?: StatusMobysuite; error?: string }

function Tile({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold text-gray-900">{value}</p>
      {children && <div className="mt-1.5 text-xs text-gray-500">{children}</div>}
    </div>
  )
}

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <p className="text-sm font-semibold text-gray-800 mb-3">{titulo}</p>
      {children}
    </div>
  )
}

// Cifras derivadas de un proyecto (datos fijos + Mobysuite)
function derivar(p: Proyecto, s: StatusMobysuite) {
  const vendidas = s.deptos.promesado
  const separadas = s.deptos.reservado
  // El stock sale del inventario de Mobysuite; solo si no se pudo leer se usa el stock inicial cargado a mano
  const stock = s.stock?.deptos.total ?? p.stock_inicial ?? null
  const disponibles = s.stock
    ? s.stock.deptos.disponible
    : stock != null ? Math.max(0, stock - vendidas - separadas) : null
  const meta = p.meta_proyectada ?? null
  const venta = s.venta.promesado
  return {
    vendidas, separadas, stock, disponibles, meta, venta,
    avance: meta ? (venta / meta) * 100 : null,
    cobradoPct: s.valorContratos ? (s.cobrado / s.valorContratos) * 100 : null,
  }
}

// ── Modal de datos fijos (solo ADMIN) ─────────────────────────────────
const CAMPOS: Array<{ campo: keyof Proyecto; label: string }> = [
  { campo: 'meta_proyectada', label: 'Meta proyectada de venta (S/)' },
  { campo: 'pisos', label: 'Pisos' },
  { campo: 'sotanos', label: 'Sótanos' },
]

function DatosFijosModal({ proyecto, onClose, onSaved }: { proyecto: Proyecto; onClose: () => void; onSaved: () => void }) {
  const [vals, setVals] = useState<Record<string, string>>(
    Object.fromEntries(CAMPOS.map(c => [c.campo, proyecto[c.campo] != null ? String(proyecto[c.campo]) : ''])),
  )
  const [saving, setSaving] = useState(false)

  const guardar = async () => {
    setSaving(true)
    try {
      const payload: Record<string, number | null> = {}
      for (const c of CAMPOS) payload[c.campo] = vals[c.campo].trim() === '' ? null : Number(vals[c.campo])
      if (Object.values(payload).some(v => v !== null && (Number.isNaN(v) || v < 0))) {
        toast.error('Escribe solo números positivos'); setSaving(false); return
      }
      await updateProyecto(proyecto.id, payload)
      toast.success('Datos del proyecto guardados')
      onSaved()
    } catch {
      toast.error('No se pudieron guardar los datos')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Datos fijos — {proyecto.nombre}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"><X size={16} /></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          {CAMPOS.map(c => (
            <div key={c.campo}>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{c.label}</label>
              <input type="number" min="0" value={vals[c.campo]} onChange={e => setVals(v => ({ ...v, [c.campo]: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20" />
            </div>
          ))}
          <p className="text-xs text-gray-400">Estos datos no vienen de Mobysuite. Déjalos vacíos si aún no los tienes. El stock, los estacionamientos y los depósitos ya se leen de Mobysuite.</p>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
          <button onClick={guardar} disabled={saving} className="px-4 py-2 rounded-xl bg-[#003D7D] text-white text-sm font-medium hover:bg-[#002D5C] disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function StatusProyectoPage() {
  const { userRole } = useAuthStore()
  const permitido = userRole === ROLES.ADMIN || userRole === ROLES.APROBADOR
  const esAdmin = userRole === ROLES.ADMIN

  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [datos, setDatos] = useState<Record<number, Cargado>>({})
  const [loading, setLoading] = useState(true)
  const [seleccion, setSeleccion] = useState<'todos' | number>('todos')
  const [editando, setEditando] = useState<Proyecto | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const lista = (await getProyectosConMobysuite()).filter(p => !p.nombre.toLowerCase().includes('concyssa'))
      setProyectos(lista)
      const resultados = await Promise.allSettled(lista.map(p => getStatusMobysuite(p.moby_project_id as number)))
      const nuevo: Record<number, Cargado> = {}
      lista.forEach((p, i) => {
        const r = resultados[i]
        nuevo[p.id] = r.status === 'fulfilled' ? { status: r.value } : { error: (r.reason as Error)?.message ?? 'Error' }
      })
      setDatos(nuevo)
    } catch {
      toast.error('No se pudieron cargar los proyectos')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (permitido) cargar() }, [permitido, cargar])

  const proyecto = typeof seleccion === 'number' ? proyectos.find(p => p.id === seleccion) ?? null : null
  const cargado = proyecto ? datos[proyecto.id] : undefined

  const filas = useMemo(() => proyectos.map(p => {
    const s = datos[p.id]?.status
    return { p, s, d: s ? derivar(p, s) : null }
  }), [proyectos, datos])

  if (!permitido) return <Navigate to="/dashboard" replace />

  // Totales de todos los proyectos
  const conDatos = filas.filter(f => f.s && f.d)
  const tot = conDatos.reduce((a, f) => ({
    venta: a.venta + f.d!.venta,
    meta: a.meta + (f.d!.meta ?? 0),
    vendidas: a.vendidas + f.d!.vendidas,
    separadas: a.separadas + f.d!.separadas,
    cobrado: a.cobrado + f.s!.cobrado,
  }), { venta: 0, meta: 0, vendidas: 0, separadas: 0, cobrado: 0 })

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#003D7D]/10 text-[#003D7D] flex items-center justify-center"><Building size={20} /></div>
          <div>
            <h1 className="text-xl font-bold text-[#003D7D]">Status de Proyecto</h1>
            <p className="text-sm text-gray-400">Estado comercial al día de hoy, desde Mobysuite</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={String(seleccion)} onChange={e => setSeleccion(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
            className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20">
            <option value="todos">Todos los proyectos</option>
            {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <button onClick={cargar} disabled={loading} title="Actualizar"
            className="h-9 w-9 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-gray-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="flex gap-2 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-900">
        <Info size={14} className="shrink-0 mt-0.5" />
        <p>
          Cifras en vivo de Mobysuite (departamentos con minuta = vendidos; con separación = separaciones activas; el stock sale del inventario).
          Aún no se muestra la evolución mes a mes ni las caídas: Mobysuite no entrega los contratos caídos; ese historial se irá armando con fotos periódicas.
        </p>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center gap-2 text-gray-400">
          <Loader2 size={28} className="animate-spin text-[#003D7D]/40" />
          <p className="text-sm">Consultando Mobysuite…</p>
        </div>
      ) : seleccion === 'todos' ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Tile label="Venta en minutas (todos)" value={fmtS(tot.venta)}>{tot.meta > 0 ? `${pct((tot.venta / tot.meta) * 100)} de la meta (${fmtS(tot.meta)})` : 'Falta cargar las metas'}</Tile>
            <Tile label="Departamentos vendidos (minuta)" value={fmtN(tot.vendidas)} />
            <Tile label="Separaciones activas" value={fmtN(tot.separadas)} />
            <Tile label="Cobrado acumulado" value={fmtS(tot.cobrado)} />
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#003D7D]/[0.03] border-b border-gray-100">
                  {['Proyecto', 'Meta', 'Venta en minutas', '% meta', 'Vendidos', 'Separaciones', 'Disponibles', 'Precio m²', 'Cobrado'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#003D7D]/60 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map(({ p, s, d }) => (
                  <tr key={p.id} onClick={() => setSeleccion(p.id)} className="border-b border-gray-50 cursor-pointer hover:bg-[#003D7D]/[0.03]">
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{p.nombre}</td>
                    {!s || !d ? (
                      <td colSpan={8} className="px-4 py-3 text-xs text-red-500">{datos[p.id]?.error ?? 'Sin datos'}</td>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-gray-600">{d.meta ? fmtS(d.meta) : <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-gray-800">{fmtS(d.venta)}</td>
                        <td className="px-4 py-3 text-gray-600">{d.avance != null ? pct(d.avance) : <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-gray-800">{fmtN(d.vendidas)}</td>
                        <td className="px-4 py-3 text-gray-800">{fmtN(d.separadas)}</td>
                        <td className="px-4 py-3 text-gray-600">{d.disponibles != null ? fmtN(d.disponibles) : <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-gray-600">{s.precioM2.minutas ? fmtS(s.precioM2.minutas) : '—'}</td>
                        <td className="px-4 py-3 text-gray-800">{fmtS(s.cobrado)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400">Toca un proyecto para ver su detalle. "—" significa que falta cargar ese dato fijo (meta o stock inicial) en el detalle del proyecto.</p>
        </>
      ) : proyecto && cargado?.status ? (
        (() => {
          const s = cargado.status
          const d = derivar(proyecto, s)
          const dona = [
            { name: 'Vendidas (minuta)', value: d.vendidas, color: AZUL },
            { name: 'Separaciones activas', value: d.separadas, color: CELESTE },
            ...(d.disponibles != null ? [{ name: 'Disponibles', value: d.disponibles, color: GRIS }] : []),
          ]
          const dorm = Object.entries(s.porDormitorios).sort((a, b) => a[0].localeCompare(b[0]))
            .map(([k, v]) => ({ nombre: k === 's/d' ? 'Sin dato' : `${k} dorm.`, Minuta: v.promesado, Separación: v.reservado }))
          const pisos = Object.entries(s.porPiso).sort((a, b) => a[0].localeCompare(b[0]))
            .map(([k, v]) => ({ nombre: k === 's/d' ? 'Sin dato' : `Piso ${Number(k)}`, Minuta: v.promesado, Separación: v.reservado }))
          return (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Tile label="Meta proyectada" value={d.meta ? fmtS(d.meta) : '—'}>{d.meta ? '' : 'Falta cargarla (botón Editar datos)'}</Tile>
                <Tile label="Venta en minutas" value={fmtS(d.venta)}>
                  {d.avance != null ? (
                    <div>
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-1"><div className="h-full rounded-full" style={{ width: `${Math.min(100, d.avance)}%`, background: AZUL }} /></div>
                      {pct(d.avance)} de la meta
                    </div>
                  ) : 'Incluye estacionamientos y depósitos'}
                </Tile>
                <Tile label="Departamentos vendidos (minuta)" value={fmtN(d.vendidas)}>{d.stock ? `de ${fmtN(d.stock)} departamentos` : ''}</Tile>
                <Tile label="Separaciones activas" value={fmtN(d.separadas)}>{fmtS(s.venta.reservado)} en separaciones</Tile>
                <Tile label="Departamentos disponibles" value={d.disponibles != null ? fmtN(d.disponibles) : '—'}>
                  {s.stock ? 'Inventario real de Mobysuite' : d.disponibles != null ? 'Stock inicial − vendidas − separadas' : 'No se pudo leer el inventario'}
                </Tile>
                <Tile label="Precio por m² (minutas)" value={s.precioM2.minutas ? fmtS(s.precioM2.minutas) : '—'}>
                  {s.stock?.precioM2Ponderado ? `${fmtS(s.stock.precioM2Ponderado)} sobre área ponderada` : s.precioM2.todos ? `${fmtS(s.precioM2.todos)} incluyendo separaciones` : ''}
                </Tile>
                <Tile label="Cobrado acumulado" value={fmtS(s.cobrado)}>{d.cobradoPct != null ? `${pct(d.cobradoPct)} del valor de los contratos` : ''}</Tile>
                <Tile label="Estac. y depósitos con contrato" value={fmtN(s.estacionamientos.promesado + s.estacionamientos.reservado + s.depositos.promesado + s.depositos.reservado)}>
                  {fmtN(s.estacionamientos.promesado + s.estacionamientos.reservado)} estac.{s.stock ? ` de ${fmtN(s.stock.estacionamientos.total)}` : ''} · {fmtN(s.depositos.promesado + s.depositos.reservado)} dep.{s.stock ? ` de ${fmtN(s.stock.depositos.total)}` : ''}
                </Tile>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Tarjeta titulo="Departamentos">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={dona} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={1}
                          label={({ value }) => (value as number) > 0 ? fmtN(value as number) : ''}>
                          {dona.map(x => <Cell key={x.name} fill={x.color} />)}
                        </Pie>
                        <Tooltip formatter={(v) => fmtN(Number(v))} />
                        <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Tarjeta>

                <Tarjeta titulo="Por número de dormitorios">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dorm} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="#EEF0F3" />
                        <XAxis dataKey="nombre" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="Minuta" stackId="a" fill={AZUL} maxBarSize={44} />
                        <Bar dataKey="Separación" stackId="a" fill={CELESTE} maxBarSize={44} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Tarjeta>

                <Tarjeta titulo="Por piso">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={pisos} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="#EEF0F3" />
                        <XAxis dataKey="nombre" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="Minuta" stackId="a" fill={AZUL} maxBarSize={32} />
                        <Bar dataKey="Separación" stackId="a" fill={CELESTE} maxBarSize={32} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Tarjeta>
              </div>

              <Tarjeta titulo="Datos fijos del proyecto">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-sm flex-1">
                    {CAMPOS.map(c => (
                      <div key={c.campo}>
                        <p className="text-xs text-gray-400">{c.label}</p>
                        <p className="font-semibold text-gray-800">{proyecto[c.campo] != null ? Number(proyecto[c.campo]).toLocaleString('es-PE') : <span className="text-gray-300">—</span>}</p>
                      </div>
                    ))}
                  </div>
                  {esAdmin && (
                    <button onClick={() => setEditando(proyecto)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#003D7D]/30 text-[#003D7D] text-sm font-medium hover:bg-[#003D7D]/5">
                      <Pencil size={14} /> Editar datos
                    </button>
                  )}
                </div>
              </Tarjeta>
            </>
          )
        })()
      ) : (
        <div className="py-16 text-center text-sm text-red-500">
          {cargado?.error ?? 'No se pudo cargar este proyecto'}
        </div>
      )}

      {editando && (
        <DatosFijosModal
          proyecto={editando}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); cargar() }}
        />
      )}
    </div>
  )
}
