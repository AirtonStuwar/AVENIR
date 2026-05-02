import { useState } from 'react';
import { loginWithEmail } from '../services/authService';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react'; // o usa heroicons si ya lo tienes

export const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await loginWithEmail(email, password);
      navigate('/dashboard');
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#003D7D] px-4">
      <div className="w-full max-w-[420px] bg-white rounded-2xl overflow-hidden">

        {/* Header */}
        <div className="px-8 pt-10 pb-8">
          <div className="w-12 h-12 bg-[#EEF4FF] rounded-xl flex items-center justify-center mb-5">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="#003D7D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <h1 className="text-slate-900 text-[22px] font-medium">Bienvenido</h1>
          <p className="text-slate-500 text-sm mt-1">Ingresa tus credenciales para continuar</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 pb-10">

          {/* Email */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-slate-600 mb-1.5">
              Correo electrónico
            </label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
              <input
                type="email"
                required
                placeholder="nombre@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm
                  text-slate-800 placeholder:text-slate-400 outline-none transition-all
                  focus:border-[#003D7D] focus:ring-2 focus:ring-[#003D7D]/10"
              />
            </div>
          </div>

          {/* Password */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-sm font-medium text-slate-600">Contraseña</label>
              <a href="#" className="text-xs text-[#F65740] hover:underline">
                ¿Olvidaste tu contraseña?
              </a>
            </div>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-10 py-2.5 border border-slate-200 rounded-lg text-sm
                  text-slate-800 placeholder:text-slate-400 outline-none transition-all
                  focus:border-[#003D7D] focus:ring-2 focus:ring-[#003D7D]/10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400
                  hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#003D7D] hover:bg-[#002e5e] active:bg-[#002050]
              text-white text-[15px] font-medium rounded-lg transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Cargando...' : 'Iniciar sesión'}
          </button>

          {/* <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400">o</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <button
            type="button"
            className="w-full py-2.5 border border-[#003D7D] text-[#003D7D]
              hover:bg-[#003D7D]/5 text-sm font-medium rounded-lg transition-colors"
          >
            Acceder con SSO
          </button> */}
        </form>
      </div>
    </div>
  );
};