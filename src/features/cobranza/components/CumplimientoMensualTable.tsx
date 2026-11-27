import { useMemo } from 'react'
import type { CuotaMobysuite } from '../utils/carteraMobysuite'
import { calcularTablaMensual } from '../utils/reportesEmpresa'
import { textoCategoria } from '../utils/cobradoMes'
import type { FiltroCategoria } from '../utils/cobradoMes'
import type { EstadoMes } from '../utils/reportesEmpresa'

const num = (n: number) => Math.round(n).toLocaleString('es-PE')
const sol = (n: number) => `S/ ${num(n)}`

const COLOR: Record<EstadoMes, { barra: string; texto: string }> = {
  cumple:   { barra: '#1F4E9C', texto: 'text-[#1F4E9C]' },
  parcial:  { barra: '#E08A1E', texto: 'text-amber-700' },
  bajo:     { barra: '#B3261E', texto: 'text-red-700' },
  sin_meta: { barra: '#DDE3EE', texto: 'text-slate-500' },
}

export default function CumplimientoMensualTable({ cuotas, etapa, categoria = 'Todos' }: {
  cuotas: CuotaMobysuite[]; etapa?: string | null; categoria?: FiltroCategoria
}) {
  const t = useMemo(() => calcularTablaMensual(cuotas, categoria), [cuotas, categoria])

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold text-[#14213D]">Meta y cumplimiento mensual de cobranza</h2>
          <p className="text-sm text-slate-500 mt-1">Meta = lo que vence en el mes más la deuda atrasada · Cumplimiento = monto abonado en el mes · Soles{etapa ? ` · Etapa: ${etapa}` : ''}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold tracking-[0.3em] text-[#1F4E9C]">AVENIR</p>
          <p className="text-xs text-slate-500">Grupo Inmobiliario</p>
        </div>
      </div>

      {t.filas.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">No hay cuotas con fechas válidas para esta selección.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-blue-100">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="bg-[#1F4E9C] text-white text-left">
                <th className="px-4 py-2.5 font-semibold">Mes</th>
                <th className="px-4 py-2.5 font-semibold text-right">Atrasado</th>
                <th className="px-4 py-2.5 font-semibold text-right">Del mes</th>
                <th className="px-4 py-2.5 font-semibold text-right">Meta</th>
                <th className="px-4 py-2.5 font-semibold text-right">Cobrado</th>
                <th className="px-4 py-2.5 font-semibold w-[28%]">Barra de cumplimiento (meta = 100%)</th>
                <th className="px-4 py-2.5 font-semibold text-right">Cumpl.</th>
              </tr>
            </thead>
            <tbody>
              {t.filas.map((f, i) => {
                const c = COLOR[f.estado]
                const ancho = f.pct === null ? (f.estado === 'sin_meta' ? 100 : 0) : Math.min(100, f.pct)
                const etiqueta = f.estado === 'sin_meta' ? 'Sin meta' : `${Math.round(f.pct ?? 0)}%`
                return (
                  <tr key={f.mes} className={i % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                    <td className="px-4 py-2 text-slate-800">{f.etiqueta}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-500">{num(f.atrasado)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-500">{num(f.delMes)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-800 font-medium">{num(f.meta)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-800">{num(f.cobrado)}</td>
                    <td className="px-4 py-2">
                      <div className="h-3.5 rounded-full bg-[#DDE3EE] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${ancho}%`, background: f.estado === 'sin_meta' ? 'transparent' : c.barra }} />
                      </div>
                    </td>
                    <td className={`px-4 py-2 text-right font-bold ${c.texto}`}>{etiqueta}</td>
                  </tr>
                )
              })}
              <tr className="bg-[#DDE3EE] font-bold text-slate-900">
                <td className="px-4 py-2.5">Total acumulado</td>
                <td className="px-4 py-2.5 text-right text-slate-500">—</td>
                <td className="px-4 py-2.5 text-right text-slate-500">—</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{num(t.total.meta)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{num(t.total.cobrado)}</td>
                <td className="px-4 py-2.5">
                  <div className="h-3.5 rounded-full bg-white/70 overflow-hidden">
                    <div className="h-full rounded-full bg-[#1F4E9C]" style={{ width: `${Math.min(100, t.total.pct ?? 0)}%` }} />
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right text-[#1F4E9C]">{t.total.pct === null ? '—' : `${Math.round(t.total.pct)}%`}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-4 text-sm">
        <span className="flex items-center gap-1.5 text-[#1F4E9C]"><span className="w-3 h-3 rounded-sm bg-[#1F4E9C]" />Cumple (98% o más)</span>
        <span className="flex items-center gap-1.5 text-amber-700"><span className="w-3 h-3 rounded-sm bg-[#E08A1E]" />Parcial (80% a 98%)</span>
        <span className="flex items-center gap-1.5 text-red-700"><span className="w-3 h-3 rounded-sm bg-[#B3261E]" />Bajo (menos de 80%)</span>
      </div>
      <p className="text-xs text-slate-500 mt-3 leading-relaxed">
        {textoCategoria(categoria)} Atrasado = vencido en meses anteriores y sin pagar al empezar el mes. Del mes = cuotas que vencen en el mes (el mes en curso, hasta hoy), sin contar lo pagado antes. Cobrado = pagos con fecha dentro del mes, incluidos los adelantados. En el total, la meta es todo lo vencido a hoy, contado una sola vez (no es la suma de las metas mensuales).
        {t.dudosas.cuotas > 0 && <> {t.dudosas.cuotas} cuotas ({sol(t.dudosas.monto)}) están pagadas pero con fecha de pago dudosa en Mobysuite y no entran en ningún mes.</>}
      </p>
    </div>
  )
}
