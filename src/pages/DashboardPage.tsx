import { useEffect, useState } from 'react';
import { supabase } from '../api/supabase';
import { useAuthStore } from '../store/authStore';

export const DashboardPage = () => {
  const user = useAuthStore((state) => state.user);
  const userRole = useAuthStore((state) => state.userRole);
  const isLoading = useAuthStore((state) => state.isLoading);

  const [proyectos, setProyectos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);

  // 🎯 ROLES
  const esGerencia = userRole === 1;
  const esAdmin = userRole === 2;
  const esContabilidad = userRole === 3;


  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // 🔥 CARGAR PROYECTOS SOLO GERENCIA
  const cargarProyectos = async () => {
    setCargando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

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
        setProyectos(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session && esGerencia) {
        await cargarProyectos();
      }
    };

    init();
  }, [esGerencia]);

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
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Panel de Control</h1>
        <button 
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Cerrar Sesión
        </button>
      </div>

      {/* PERFIL */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">

        <p className="text-lg">
          Hola, <span className="font-semibold">{user?.email}</span>
        </p>

        <p className="text-md">
          Rol:{" "}
          <span className="font-semibold">
            {esGerencia && <span className="text-green-600">Gerencia ✅</span>}
            {esAdmin && <span className="text-blue-600">Administración 📋</span>}
            {esContabilidad && <span className="text-purple-600">Contabilidad 💰</span>}
            {!userRole && <span className="text-gray-500">Sin rol ❌</span>}
          </span>
        </p>

        {/* 🔥 DASHBOARD POR ROL */}

        {/* 🟢 GERENCIA */}
        {esGerencia && (
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
              <p className="text-gray-500">No hay proyectos disponibles</p>
            )}
          </div>
        )}

        {/* 🔵 ADMINISTRACIÓN */}
        {esAdmin && (
          <div className="mt-6">
            <h2 className="text-xl font-semibold">Panel de Administración</h2>
            <p className="text-gray-600 mt-2">
              Puedes gestionar solicitudes y validar información.
            </p>
          </div>
        )}

        {/* 🟣 CONTABILIDAD */}
        {esContabilidad && (
          <div className="mt-6">
            <h2 className="text-xl font-semibold">Panel de Contabilidad</h2>
            <p className="text-gray-600 mt-2">
              Aquí podrás ejecutar pagos y revisar movimientos financieros.
            </p>
          </div>
        )}

        {/* ⚪ OTROS */}
        {!esGerencia && !esAdmin && !esContabilidad && (
          <div className="mt-6">
            <p className="text-gray-500">
              No tienes permisos asignados aún.
            </p>
          </div>
        )}

      </div>
    </div>
  );
};