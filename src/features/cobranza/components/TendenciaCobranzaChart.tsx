import { useMemo } from 'react'
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { CuotaMobysuite } from '../utils/carteraMobysuite'
import { calcularTablaMensual } from '../utils/reportesEmpresa'
import type { FilaMes } from '../utils/reportesEmpresa'
import { textoCategoria } from '../utils/cobradoMes'
import type { FiltroCategoria } from '../utils/cobradoMes'

const AZUL_META = '#1F4E9C'
const VERDE_COBRADO = '#6CC58A'
const MESES_VISIBLES = 6

const sol = (n: number) => `S/ ${Math.round(n).toLocaleString('es-PE')}`

type Punto = FilaMes & { corto: string }

function Detalle({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: Punto }> }) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  const fila = (nombre: string, valor: string, color?: string) => (
    <div className="flex items-center justify-between gap-5">
      <span className="flex items-center gap-1.5 text-slate-500">
        {color && <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />}{nombre}
      </span>
      <span className="tabular-nums text-slate-900">{valor}</span>
    </div>
  )
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-md text-xs space-y-1">
      <p className="font-semibold text-slate-900">{p.etiqueta}</p>
      {fila('Meta', sol(p.meta), AZUL_META)}
      <div className="pl-4 space-y-0.5">
        {fila('Atrasado', sol(p.atrasado))}
        {fila('Del mes', sol(p.delMes))}
      </div>
      {fila('Cobrado', sol(p.cobrado), VERDE_COBRADO)}
      {fila('Efectividad', p.pct === null ? 'Sin meta' : `${Math.round(p.pct)}%`)}
    </div>
  )
}

/** Meta (cartera exigible) contra lo cobrado en los últimos 6 meses, con su % de efectividad. */
export default function TendenciaCobranzaChart({ cuotas, etapa, categoria = 'Todos' }: {
  cuotas: CuotaMobysuite[]; etapa?: string | null; categoria?: FiltroCategoria
}) {
  // El % va como texto aparte para que la etiqueta quede vacía en los meses sin meta
  const datos = useMemo(() => calcularTablaMensual(cuotas, categoria).filas.slice(-MESES_VISIBLES).map(f => ({
    ...f,
    corto: f.etiqueta.replace(/^(\p{L}{3})\p{L}*/u, '$1'),
    efectividad: f.pct === null ? '' : `${Math.round(f.pct)}%`,
  })), [cuotas, categoria])

  if (datos.length === 0) return null

  return (
    <div className="rounded-2xl bg-[#0A2260] p-5 sm:p-7 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold text-white">Tendencia de Cobranza – Proyectado y su efectividad</h2>
          <p className="text-sm text-blue-100 mt-1">Cobrado vs. Meta · últimos {datos.length} meses{etapa ? ` · Etapa: ${etapa}` : ''}</p>
        </div>
        <div className="flex items-center gap-4 text-sm text-white">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm ring-1 ring-white/70" style={{ background: AZUL_META }} />Meta</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: VERDE_COBRADO }} />Cobrado</span>
        </div>
      </div>

      <div className="rounded-xl bg-white px-2 pt-3 pb-2 overflow-x-auto">
        <div className="h-72 min-w-[480px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={datos} barGap={4} margin={{ top: 22, right: 8, bottom: 0, left: 8 }}>
              <XAxis dataKey="corto" tickLine={false} axisLine={{ stroke: '#d1d5db' }} interval={0} tick={{ fontSize: 11, fontWeight: 600, fill: '#4b5563' }} />
              <YAxis hide domain={[0, 'dataMax']} />
              <Tooltip cursor={{ fill: 'rgba(31,78,156,0.06)' }} content={<Detalle />} />
              <Bar dataKey="meta" name="Meta" fill={AZUL_META} barSize={30} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="cobrado" name="Cobrado" fill={VERDE_COBRADO} barSize={30} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                <LabelList dataKey="efectividad" position="top" fill="#111827" fontSize={12} fontWeight={700} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="text-xs text-blue-100 mt-3 leading-relaxed">
        {textoCategoria(categoria)} Meta = deuda atrasada más las cuotas que vencen en el mes. El porcentaje es lo cobrado sobre la meta.
        El mes en curso está incompleto. Pasa el mouse por un mes para ver los montos; el detalle está en la tabla de arriba.
      </p>
    </div>
  )
}
