import { Menu, Bell } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const routeNames: Record<string, string> = {
  '/dashboard':  'Dashboard',
  '/solicitudes': 'Solicitudes',
  '/proveedores': 'Proveedores',
  '/proyectos':   'Proyectos',
};

interface TopbarProps {
  onMenuClick: () => void;
  notificationCount?: number;
}

export const Topbar = ({ onMenuClick, notificationCount = 3 }: TopbarProps) => {
  const { pathname } = useLocation();
  const title = routeNames[pathname] ?? 'AVENIR';

  return (
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

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-[#003D7D] flex items-center justify-center
          text-white text-xs font-medium cursor-pointer select-none">
          AV
        </div>
      </div>
    </header>
  );
};