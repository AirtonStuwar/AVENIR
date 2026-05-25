import { useState } from 'react'
import toast from 'react-hot-toast'
import { Star, Send, Pencil, CheckCircle } from 'lucide-react'
import { createEncuesta, updateEncuesta } from '../services/proveedorService'
import type { Encuesta, EncuestaInsert } from '../types/proveedor'

// ── StarRating ────────────────────────────────────────────────────
function StarRating({
  value, onChange, readonly = false,
}: {
  value: number | null
  onChange?: (v: number) => void
  readonly?: boolean
}) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={readonly}
          onClick={() => !readonly && onChange?.(n)}
          onMouseEnter={() => !readonly && setHover(n)}
          onMouseLeave={() => !readonly && setHover(0)}
          className={`transition-colors ${readonly ? 'cursor-default' : 'cursor-pointer'}`}
        >
          <Star
            size={22}
            className={`transition-colors ${
              n <= (hover || value || 0)
                ? 'fill-amber-400 text-amber-400'
                : 'fill-transparent text-gray-300'
            }`}
          />
        </button>
      ))}
      {value && (
        <span className="ml-1 text-xs font-semibold text-amber-500">{value}.0</span>
      )}
    </div>
  )
}

const CRITERIOS: { key: keyof Pick<Encuesta, 'calidad' | 'tiempo' | 'precio' | 'comunicacion'>; label: string; desc: string }[] = [
  { key: 'calidad',      label: 'Calidad',      desc: 'Calidad del producto o servicio recibido' },
  { key: 'tiempo',       label: 'Puntualidad',  desc: 'Cumplimiento de los plazos acordados' },
  { key: 'precio',       label: 'Precio',       desc: 'Relación calidad / precio' },
  { key: 'comunicacion', label: 'Comunicación', desc: 'Trato y comunicación durante el proceso' },
]

interface Props {
  solicitudId:  number
  proveedorRuc: string | null
  usuarioId:    string
  encuesta:     Encuesta | null
  onSaved:      (enc: Encuesta) => void
}

export default function EncuestaProveedorForm({ solicitudId, proveedorRuc, usuarioId, encuesta, onSaved }: Props) {
  const [editing,   setEditing]   = useState(!encuesta)
  const [saving,    setSaving]    = useState(false)

  const [calidad,      setCalidad]      = useState<number | null>(encuesta?.calidad      ?? null)
  const [tiempo,       setTiempo]       = useState<number | null>(encuesta?.tiempo       ?? null)
  const [precio,       setPrecio]       = useState<number | null>(encuesta?.precio       ?? null)
  const [comunicacion, setComunicacion] = useState<number | null>(encuesta?.comunicacion ?? null)
  const [recomendaria, setRecomendaria] = useState<boolean | null>(encuesta?.recomendaria ?? null)
  const [comentarios,  setComentarios]  = useState(encuesta?.comentarios ?? '')

  const setters: Record<string, (v: number) => void> = {
    calidad:      setCalidad,
    tiempo:       setTiempo,
    precio:       setPrecio,
    comunicacion: setComunicacion,
  }
  const values: Record<string, number | null> = { calidad, tiempo, precio, comunicacion }

  const isComplete = calidad && tiempo && precio && comunicacion && recomendaria !== null

  const promedio = (calidad && tiempo && precio && comunicacion)
    ? (((calidad + tiempo + precio + comunicacion) / 4)).toFixed(1)
    : null

  const handleSave = async () => {
    if (!isComplete) { toast.error('Completa todas las estrellas y la recomendación'); return }
    setSaving(true)
    try {
      const payload = { calidad: calidad!, tiempo: tiempo!, precio: precio!, comunicacion: comunicacion!, recomendaria: recomendaria!, comentarios: comentarios || null }
      let saved: Encuesta
      if (encuesta) {
        saved = await updateEncuesta(encuesta.id, payload)
      } else {
        const insert: EncuestaInsert = { solicitud_id: solicitudId, proveedor_ruc: proveedorRuc, usuario_id: usuarioId, ...payload }
        saved = await createEncuesta(insert)
      }
      toast.success('Evaluación guardada')
      setEditing(false)
      onSaved(saved)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star size={15} className="text-amber-400 fill-amber-400" />
          <h2 className="text-sm font-semibold text-[#003D7D] uppercase tracking-wide">
            Evaluación del proveedor
          </h2>
          {encuesta && !editing && (
            <span className="flex items-center gap-1 text-xs text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full font-medium">
              <CheckCircle size={11} /> Evaluado
            </span>
          )}
        </div>
        {encuesta && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Pencil size={12} /> Editar
          </button>
        )}
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Promedio global (read-only mode) */}
        {!editing && promedio && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
            <span className="text-3xl font-bold text-amber-500">{promedio}</span>
            <div>
              <StarRating value={Math.round(parseFloat(promedio))} readonly />
              <p className="text-xs text-amber-600 mt-0.5">Puntuación general</p>
            </div>
          </div>
        )}

        {/* Criterios */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {CRITERIOS.map(c => (
            <div key={c.key} className="space-y-1">
              <p className="text-xs font-semibold text-gray-700">{c.label}</p>
              <p className="text-[11px] text-gray-400">{c.desc}</p>
              <StarRating
                value={values[c.key]}
                onChange={editing ? setters[c.key] : undefined}
                readonly={!editing}
              />
            </div>
          ))}
        </div>

        {/* ¿Lo recomendarías? */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-700">¿Lo contratarías de nuevo?</p>
          {editing ? (
            <div className="flex gap-3">
              {([true, false] as const).map(val => (
                <button
                  key={String(val)}
                  type="button"
                  onClick={() => setRecomendaria(val)}
                  className={`flex-1 h-9 rounded-xl border text-sm font-semibold transition-all ${
                    recomendaria === val
                      ? val
                        ? 'border-teal-400 bg-teal-50 text-teal-700'
                        : 'border-red-300 bg-red-50 text-red-600'
                      : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  {val ? '👍 Sí' : '👎 No'}
                </button>
              ))}
            </div>
          ) : (
            <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${recomendaria ? 'text-teal-600' : 'text-red-500'}`}>
              {recomendaria ? '👍 Sí, lo recomendaría' : '👎 No lo recomendaría'}
            </span>
          )}
        </div>

        {/* Comentarios */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-700">Comentarios adicionales</p>
          {editing ? (
            <textarea
              value={comentarios}
              onChange={e => setComentarios(e.target.value)}
              rows={3}
              placeholder="Describe tu experiencia con este proveedor…"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 focus:border-[#003D7D] resize-none"
            />
          ) : (
            <p className="text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
              {comentarios || <span className="text-gray-300 italic">Sin comentarios</span>}
            </p>
          )}
        </div>

        {/* Botón guardar */}
        {editing && (
          <button
            onClick={handleSave}
            disabled={saving || !isComplete}
            className="flex items-center gap-2 h-9 px-5 rounded-xl bg-[#003D7D] text-white text-xs font-semibold hover:bg-[#002D5C] disabled:opacity-50 transition-colors"
          >
            {saving
              ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              : <><Send size={13} /> Guardar evaluación</>
            }
          </button>
        )}
      </div>
    </div>
  )
}
