import { useEffect, useState } from 'react';
import { supabase } from '../api/supabase';
import { useAuthStore } from '../store/authStore';

export const DashboardPage = () => {
  const user = useAuthStore((state) => state.user);
  const userRole = useAuthStore((state) => state.userRole);
  const isLoading = useAuthStore((state) => state.isLoading);
  const [proyectos, setProyectos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Función para cargar proyectos
  const cargarProyectos = async () => {
    setCargando(true);
    try {
      // Verificar sesión actual antes de la consulta
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Sesión activa:', !!session);
      console.log('Token:', session?.access_token);
      
      if (!session) {
        console.error('No hay sesión activa');
        return;
      }

      const { data, error } = await supabase
        .from('proyectos')
        .select('*')
        .limit(10);
      
      if (error) {
        console.error('Error al cargar proyectos:', error);
      } else {
        console.log('Proyectos cargados:', data);
        setProyectos(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    // Verificar la sesión al cargar el componente
    const verificarSesion = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Dashboard - Sesión:', session?.user?.email);
      console.log('Dashboard - User ID:', session?.user?.id);
      
      if (session) {
        await cargarProyectos();
      }
    };
    
    verificarSesion();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

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
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
        <div>
          <p className="text-lg">
            Hola, <span className="font-semibold">{user?.email}</span>
          </p>
          <p className="text-md mt-2">
            Rol: <span className={`font-semibold ${
              userRole === 1 ? 'text-green-600' : 'text-gray-600'
            }`}>
              {userRole === 1 ? 'Gerencia ✅' : 'Sin rol asignado ❌'}
            </span>
          </p>
        </div>

        {/* Mostrar proyectos */}
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-4">Proyectos</h2>
          {cargando ? (
            <p>Cargando proyectos...</p>
          ) : proyectos.length > 0 ? (
            <div className="space-y-2">
              {proyectos.map((proyecto) => (
                <div key={proyecto.id} className="p-3 bg-gray-50 rounded">
                  <p className="font-medium">{proyecto.nombre}</p>
                  <p className="text-sm text-gray-600">{proyecto.descripcion}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No hay proyectos para mostrar</p>
          )}
        </div>
      </div>
    </div>
  );
};