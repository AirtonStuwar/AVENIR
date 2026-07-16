import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { requestPasswordReset } from '../features/auth/services/authService'

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await requestPasswordReset(email.trim())
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar el correo')
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
          <h1 className="text-slate-900 text-[22px] font-medium">Recuperar contraseña</h1>
          <p className="text-slate-500 text-sm mt-1">
            {sent
              ? 'Revisa tu correo para continuar'
              : 'Ingresa tu correo y te enviaremos un enlace para restablecerla'}
          </p>
        </div>

        <div className="px-8 pb-10">
          {sent ? (
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <CheckCircle2 size={40} className="text-emerald-500" />
              <p className="text-sm text-slate-600">
                Si <strong>{email}</strong> está registrado, te llegará un correo con instrucciones para crear una nueva contraseña.
              </p>
              <Link to="/login" className="text-sm text-[#003D7D] hover:underline mt-2">Volver al inicio de sesión</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="mb-5">
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Correo electrónico</label>
                <input
                  type="email"
                  required
                  placeholder="nombre@empresa.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
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
                {loading ? 'Enviando...' : 'Enviar enlace'}
              </button>

              <Link to="/login" className="block text-center text-sm text-slate-500 hover:text-[#003D7D] mt-4">
                Volver al inicio de sesión
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
