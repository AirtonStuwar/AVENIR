import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, Users, Briefcase, LogOut, X } from 'lucide-react';
import { supabase } from '../../api/supabase';
import { useAuthStore } from '../../store/authStore';

// 🎯 CONFIGURACIÓN CENTRAL DE MENÚ + ROLES
const menuItems = [
  { name: 'Dashboard',   path: '/dashboard',   icon: LayoutDashboard },
  { name: 'Solicitudes', path: '/solicitudes', icon: FileText, roles: [1, 2, 3, 4 , 5 ] },
  { name: 'Proveedores', path: '/proveedores', icon: Users, roles: [1, 2, 5] },
  { name: 'Proyectos',   path: '/proyectos',   icon: Briefcase, roles: [1, 5] }, // 🔒 SOLO GERENCIA
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const userRole = useAuthStore((state) => state.userRole);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // 🔥 FILTRADO POR ROLES
  const filteredMenu = menuItems.filter((item) => {
    if (!item.roles) return true;
    if (userRole === null) return false;
    return item.roles.includes(userRole);
  });

  return (
    <>
      {/* Overlay móvil */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed top-0 left-0 z-50 h-screen w-64 bg-[#003D7D] flex flex-col
        transition-transform duration-250
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        
        {/* LOGO */}
        <div className="flex items-center justify-between px-5 pt-6 pb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <span className="text-white text-[18px] font-semibold tracking-tight">
              AVENIR
            </span>
          </div>

          <button
            onClick={onClose}
            className="lg:hidden text-white/60 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="h-px bg-white/10 mx-5 mb-4" />

        {/* NAV */}
        <nav className="flex-1 px-3 flex flex-col gap-1">
          {filteredMenu.map((item) => (
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
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#F65740]" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* FOOTER */}
        <div className="px-3 pb-6">
          <div className="h-px bg-white/10 mb-3" />
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium
              text-white/50 hover:bg-[#F65740]/15 hover:text-[#F65740] transition-all w-full"
          >
            <LogOut size={18} />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
};