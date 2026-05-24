import { useRef, useState, useEffect } from 'react'
import { X, Trash2, Check } from 'lucide-react'

interface Props {
  open: boolean
  title: string
  onClose: () => void
  /** Async — FirmaModal stays open (spinner) until this resolves/rejects */
  onConfirm: (blob: Blob) => Promise<void>
}

export default function FirmaModal({ open, title, onClose, onConfirm }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const lastPos    = useRef<{ x: number; y: number } | null>(null)
  const [drawing,   setDrawing]   = useState(false)
  const [hasDrawn,  setHasDrawn]  = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // ── Reset canvas when modal opens ────────────────────────────
  useEffect(() => {
    if (!open) return
    setHasDrawn(false)
    setSubmitting(false)
    setDrawing(false)
    lastPos.current = null
    // tiny delay so the canvas is mounted
    requestAnimationFrame(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = '#1e3a5f'
      ctx.lineWidth   = 2.5
      ctx.lineCap     = 'round'
      ctx.lineJoin    = 'round'
    })
  }, [open])

  // ── Coordinate helpers ───────────────────────────────────────
  function getPos(
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  ): { x: number; y: number } {
    const canvas = canvasRef.current!
    const rect   = canvas.getBoundingClientRect()
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      const t = e.touches[0]
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY }
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  function startDraw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault()
    setDrawing(true)
    lastPos.current = getPos(e)
  }

  function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault()
    if (!drawing || !lastPos.current) return
    const canvas = canvasRef.current
    const ctx    = canvas?.getContext('2d')
    if (!ctx) return
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPos.current = pos
    if (!hasDrawn) setHasDrawn(true)
  }

  function endDraw() {
    setDrawing(false)
    lastPos.current = null
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    const ctx    = canvas?.getContext('2d')
    if (!ctx || !canvas) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  async function handleConfirm() {
    const canvas = canvasRef.current
    if (!canvas || !hasDrawn) return
    setSubmitting(true)
    try {
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
      )
      await onConfirm(blob)
    } catch {
      // errors are toasted by the caller
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        {/* Canvas */}
        <div className="px-6 py-4 space-y-2">
          <p className="text-xs text-gray-500">Dibuja tu firma en el recuadro con el cursor o tu dedo.</p>
          <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 overflow-hidden">
            <canvas
              ref={canvasRef}
              width={460}
              height={190}
              className="w-full touch-none cursor-crosshair select-none"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
          </div>
          {!hasDrawn && (
            <p className="text-xs text-gray-400 italic text-center">— Traza tu firma aquí —</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <button
            onClick={clearCanvas}
            disabled={!hasDrawn || submitting}
            className="flex items-center gap-1.5 h-9 px-4 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            <Trash2 size={13} /> Limpiar
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={submitting}
              className="h-9 px-4 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={!hasDrawn || submitting}
              className="flex items-center gap-1.5 h-9 px-5 rounded-xl bg-[#003D7D] text-white text-xs font-semibold hover:bg-[#002D5C] disabled:opacity-40 transition-colors"
            >
              {submitting
                ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                : <><Check size={13} /> Confirmar firma</>
              }
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
