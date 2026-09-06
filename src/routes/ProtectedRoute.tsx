import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState } from '../components/States';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingState label="Verificando sesion..." />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
