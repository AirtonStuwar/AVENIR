import { useState } from 'react'
import { Menu, Bell } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import UserProfileModal from './UserProfileModal'

const routeNames: Record<string, string> = {
  '/dashboard':   'Dashboard',
  '/solicitudes': 'Solicitudes',
  '/proveedores': 'Proveedores',
  '/proyectos':   'Proyectos',
}

/** Genera iniciales a partir del nombre completo o correo */
function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return parts[0].slice(0, 2).toUpperCase()
  }
  if (email) return email.slice(0, 2).toUpperCase()
  return 'AV'
}

interface TopbarProps {
  onMenuClick: () => void
  notificationCount?: number
}

export const Topbar = ({ onMenuClick, notificationCount = 0 }: TopbarProps) => {
  const { pathname }      = useLocation()
  const title             = routeNames[pathname] ?? 'AVENIR'
  const { usuarioProfile, user } = useAuthStore()
  const [profileOpen, setProfileOpen] = useState(false)

  const initials = getInitials(usuarioProfile?.nombre_completo, user?.email)

  return (
    <>
      <header className="h-[60px] bg-white border-b border-slate-200 flex items-center
        px-4 lg:px-6 gap-3 sticky top-0 z-30">

        {/* Hamburger — solo móvil */}
        <button
          onClick={onMenuClick}
          className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg
            text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <Menu size={18} />
        </button>

        {/* Título de la página */}
        <span className="flex-1 text-[15px] font-medium text-slate-800">{title}</span>

        {/* Acciones derecha */}
        <div className="flex items-center gap-2">

          {/* Notificaciones */}
          <button className="relative w-9 h-9 flex items-center justify-center rounded-lg
            text-slate-500 hover:bg-slate-100 transition-colors">
            <Bell size={18} />
            {notificationCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full
                bg-[#F65740] border-2 border-white" />
            )}
          </button>

          {/* Avatar — abre modal de perfil */}
          <button
            onClick={() => setProfileOpen(true)}
            title="Mi perfil"
            className="w-8 h-8 rounded-full bg-[#003D7D] flex items-center justify-center
              text-white text-xs font-semibold hover:bg-[#002D5C] transition-colors select-none"
          >
            {initials}
          </button>
        </div>
      </header>

      <UserProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  )
}
