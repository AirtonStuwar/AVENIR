import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export const ProtectedRoute = () => {
  const { session, isLoading } = useAuthStore();

  // Si todavía está verificando el localStorage, mostramos pantalla en blanco o spinner
  if (isLoading) {
    return <div className="flex h-screen items-center justify-center font-bold">Cargando sesión...</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />; 
};