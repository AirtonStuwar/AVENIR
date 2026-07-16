import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { supabase } from '../api/supabase'
import { updatePassword } from '../features/auth/services/authService'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [showPass,  setShowPass]  = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [done,      setDone]      = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  useEffect(() => {
    // El enlace del correo (recovery/invite) crea una sesión automáticamente al cargar la página
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session)
      setChecking(false)
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }

    setLoading(true)
    try {
      await updatePassword(password)
      setDone(true)
      setTimeout(() => navigate('/dashboard'), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar la contraseña')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#003D7D] px-4">
      <div className="w-full max-w-[420px] bg-white rounded-2xl overflow-hidden">
        <div className="px-8 pt-10 pb-8">
          <div className="w-12 h-12 bg-[#EEF4FF] rounded-xl flex items-center justify-center mb-5">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="#003D7D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h1 className="text-slate-900 text-[22px] font-medium">Crear nueva contraseña</h1>
          <p className="text-slate-500 text-sm mt-1">Ingresa tu nueva contraseña para continuar</p>
        </div>

        <div className="px-8 pb-10">
          {checking ? (
            <p className="text-sm text-slate-500 text-center py-6">Verificando enlace...</p>
          ) : done ? (
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <CheckCircle2 size={40} className="text-emerald-500" />
              <p className="text-sm text-slate-600">Contraseña actualizada. Redirigiendo...</p>
            </div>
          ) : !hasSession ? (
            <div className="text-center py-4">
              <p className="text-sm text-red-600">
                Este enlace no es válido o ya expiró. Solicita uno nuevo desde "¿Olvidaste tu contraseña?".
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="mb-5">
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Nueva contraseña</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-4 pr-10 py-2.5 border border-slate-200 rounded-lg text-sm
                      text-slate-800 placeholder:text-slate-400 outline-none transition-all
                      focus:border-[#003D7D] focus:ring-2 focus:ring-[#003D7D]/10"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Confirmar contraseña</label>
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm
                    text-slate-800 placeholder:text-slate-400 outline-none transition-all
                    focus:border-[#003D7D] focus:ring-2 focus:ring-[#003D7D]/10"
                />
              </div>

              {error && <p className="text-xs text-red-600 mb-4">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-[#003D7D] hover:bg-[#002e5e] active:bg-[#002050]
                  text-white text-[15px] font-medium rounded-lg transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Guardando...' : 'Guardar contraseña'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
