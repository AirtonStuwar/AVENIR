import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../api/supabase'
import { useAuthStore } from '../../../store/authStore'
import { getNotificaciones, marcarLeida, marcarTodasLeidas, type Notificacion } from '../services/notificacionService'

function hace(fecha: string): string {
  // fecha_creacion es timestamptz: new Date() la interpreta bien
  const min = Math.max(0, Math.round((Date.now() - new Date(fecha).getTime()) / 60000))
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.round(h / 24)} d`
}

export default function NotificacionesBell() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [items, setItems] = useState<Notificacion[]>([])
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  const cargar = useCallback(() => {
    getNotificaciones().then(setItems).catch(() => {})
  }, [])

  useEffect(() => {
    if (!user?.id) return
    cargar()
    // Tiempo real; el sondeo cada 60 s cubre una conexión realtime caída
    const canal = supabase
      .channel('notificaciones-' + user.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificacion', filter: `usuario_id=eq.${user.id}` }, cargar)
      .subscribe()
    const timer = setInterval(cargar, 60000)
    return () => { clearInterval(timer); supabase.removeChannel(canal) }
  }, [user?.id, cargar])

  useEffect(() => {
    if (!open) return
    const fuera = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [open])

  const noLeidas = items.filter(n => !n.leida).length

  async function abrir(n: Notificacion) {
    setOpen(false)
    if (!n.leida) {
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, leida: true } : x))
      marcarLeida(n.id).catch(() => {})
    }
    if (n.ruta) navigate(n.ruta)
  }

  async function todas() {
    setItems(prev => prev.map(x => ({ ...x, leida: true })))
    marcarTodasLeidas().catch(cargar)
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Notificaciones"
        className="relative w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
      >
        <Bell size={18} />
        {noLeidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#F65740] text-white text-[10px] font-semibold flex items-center justify-center border-2 border-white">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[340px] max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-800">Notificaciones</span>
            {noLeidas > 0 && (
              <button onClick={todas} className="flex items-center gap-1 text-xs text-[#003D7D] hover:underline">
                <CheckCheck size={13} /> Marcar todas como leídas
              </button>
            )}
          </div>
          <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-50">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">No tienes notificaciones</p>
            ) : items.map(n => (
              <button
                key={n.id}
                onClick={() => abrir(n)}
                className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex gap-2.5 ${n.leida ? '' : 'bg-[#003D7D]/[0.04]'}`}
              >
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.leida ? 'bg-transparent' : 'bg-[#F65740]'}`} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-slate-800 truncate">{n.titulo}</span>
                    <span className="text-[11px] text-slate-400 shrink-0">{hace(n.fecha_creacion)}</span>
                  </span>
                  {n.mensaje && <span className="block text-xs text-slate-500 mt-0.5 leading-snug">{n.mensaje}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
