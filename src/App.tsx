import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './api/supabase';
import { useAuthStore } from './store/authStore';

// Components
import { ProtectedRoute } from './components/layout/ProtectedRoute';

// Pages
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { MainLayout } from './components/layout/MainLayout';
import ProyectosPage from './pages/ProyectosPage';
import SolicitudesPage from './pages/SolicitudesPage';

function App() {
  const setSession = useAuthStore((state) => state.setSession);
  const isLoading = useAuthStore((state) => state.isLoading);

  useEffect(() => {
    // 1. Definimos una función asíncrona para inicializar
    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
    };

    initializeAuth();

    // 2. Escuchar cambios de auth (Login, Logout, Token Refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Cambio de Auth detectado:", event);
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [setSession]);

  // Mientras está verificando si hay un token en el navegador, no mostramos nada
  // Esto evita que el ProtectedRoute crea que no hay usuario y te mande al login
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-blue-600 font-semibold animate-pulse">
          Verificando sesión...
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          {/* El MainLayout contiene el Sidebar y el Outlet para las páginas */}
          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/solicitudes" element={<SolicitudesPage />} />
            <Route path="/proveedores" element={<div className="p-4">Sección Proveedores</div>} />
            <Route path="/proyectos" element={<ProyectosPage/>} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;