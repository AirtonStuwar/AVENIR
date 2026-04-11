import { supabase } from '../api/supabase';
import { useAuthStore } from '../store/authStore';

export const DashboardPage = () => {
  const user = useAuthStore((state) => state.user);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Panel de Control</h1>
        <button 
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Cerrar Sesión
        </button>
      </div>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <p className="text-lg">Hola, <span className="font-semibold">{user?.email}</span></p>
        <p className="text-slate-500">Has ingresado correctamente a la aplicación.</p>
      </div>
    </div>
  );
};