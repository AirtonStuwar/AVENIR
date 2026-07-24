import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, Users, Briefcase, LogOut, X, AlertCircle, Receipt, RefreshCw, BarChart2, Building2, Wallet, PieChart, RotateCcw, UserCog } from 'lucide-react';
import { supabase } from '../../api/supabase';
import { useAuthStore } from '../../store/authStore';

// ── Menú + roles ─────────────────────────────────────────────────
// Roles: 1=Admin | 8=Evaluador | 9=Aprobador | 10=Visualizador | 11=Usuario
const ALL_ROLES = [1, 8, 9, 10, 11]

const menuItems = [
  { name: 'Dashboard',   path: '/dashboard',   icon: LayoutDashboard, roles: [1, 8, 9, 10, 11] },
  { name: 'Solicitudes', path: '/solicitudes', icon: FileText,   roles: ALL_ROLES },
  { name: 'A Rendir',    path: '/arendir',     icon: Receipt,    roles: [1, 8, 9, 10, 11] },
  { name: 'Reembolso',   path: '/reembolso',   icon: RefreshCw,  roles: [1, 8, 9, 10, 11] },
  { name: 'Caja Chica',  path: '/caja-chica',  icon: Wallet,     roles: [1, 8, 9, 10, 11] },
  { name: 'Devolución Cliente', path: '/devolucion', icon: RotateCcw, roles: [1, 8, 9, 10, 11] },
  { name: 'Usuarios',    path: '/usuarios',    icon: UserCog,    roles: [1] },
  { name: 'Proveedores', path: '/proveedores', icon: Users,      roles: [1, 11] },
  { name: 'Empresas',    path: '/proyectos',   icon: Briefcase,  roles: [1] },
  { name: 'Áreas',       path: '/areas',       icon: Building2,  roles: [1, 9] },
  { name: 'Reportes',    path: '/reportes',    icon: BarChart2,  roles: [1, 8, 10] },
  { name: 'Plan Contable', path: '/plan-contable', icon: PieChart, roles: [1, 11] },
]

const ROLE_LABELS: Record<number, string> = {
  1:  'Administrador',
  8:  'Evaluador',
  9:  'Aprobador',
  10: 'Visualizador',
  11: 'Usuario',
}

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const { userRole, usuarioProfile } = useAuthStore()
  const [logoutOpen, setLogoutOpen] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const filteredMenu = menuItems.filter(item => {
    if (!item.roles) return true
    if (userRole === null) return false
    return item.roles.includes(userRole)
  })

  const displayName = usuarioProfile?.nombre_completo
    ?? usuarioProfile?.correo
    ?? '—'
  const roleLabel   = userRole ? (ROLE_LABELS[userRole] ?? `Rol ${userRole}`) : '—'

  return (
    <>
      {/* ── Overlay móvil ── */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside className={`
        fixed top-0 left-0 z-50 h-screen w-64 bg-[#003D7D] flex flex-col
        transition-transform duration-250
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>

        {/* ── Logo ── */}
        <div className="flex items-center justify-between px-5 pt-6 pb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <span className="text-white text-[18px] font-semibold tracking-tight">AVENIR</span>
          </div>
          <button onClick={onClose} className="lg:hidden text-white/60 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="h-px bg-white/10 mx-5 mb-4" />

        {/* ── Nav ── */}
        <nav className="flex-1 px-3 flex flex-col gap-1">
          {filteredMenu.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) => `
                flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-all group
                ${isActive
                  ? 'bg-white/15 text-white'
                  : 'text-white/65 hover:bg-white/10 hover:text-white'}
              `}
            >
              {({ isActive }) => (
                <>
                  <item.icon size={18} />
                  <span className="flex-1">{item.name}</span>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#F65740]" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* ── Footer: perfil + cerrar sesión ── */}
        <div className="px-3 pb-6 space-y-2">
          <div className="h-px bg-white/10 mb-3" />

          {/* Tarjeta de usuario */}
          <div className="rounded-xl bg-white/8 px-3 py-3 space-y-0.5">
            {/* Avatar inicial + nombre */}
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                <span className="text-white text-sm font-bold">
                  {(usuarioProfile?.nombres?.[0] ?? usuarioProfile?.correo?.[0] ?? '?').toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-white text-xs font-semibold leading-tight truncate" title={displayName}>
                  {displayName}
                </p>
                {usuarioProfile?.correo && usuarioProfile?.nombre_completo && (
                  <p className="text-white/50 text-[10px] truncate">{usuarioProfile.correo}</p>
                )}
              </div>
            </div>

            {/* Cargo + rol */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {usuarioProfile?.cargo && (
                <span className="text-[10px] text-white/70 bg-white/10 px-2 py-0.5 rounded-full">
                  {usuarioProfile.cargo}
                </span>
              )}
              <span className="text-[10px] text-white/70 bg-white/10 px-2 py-0.5 rounded-full">
                {roleLabel}
              </span>
            </div>
          </div>

          {/* Botón cerrar sesión */}
          <button
            onClick={() => setLogoutOpen(true)}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium
              text-white/50 hover:bg-[#F65740]/15 hover:text-[#F65740] transition-all w-full"
          >
            <LogOut size={18} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Modal confirmación logout ── */}
      {logoutOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

            {/* Header */}
            <div className="px-6 pt-6 pb-4 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
                <AlertCircle size={24} className="text-red-500" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">¿Cerrar sesión?</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Se cerrará la sesión de <span className="font-medium text-gray-700">{displayName}</span>.
                </p>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setLogoutOpen(false)}
                className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 h-10 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
              >
                Sí, cerrar sesión
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  )
}
