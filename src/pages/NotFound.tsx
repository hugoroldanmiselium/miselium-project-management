import { Link } from 'react-router-dom';
import { NotFoundState } from '../components/States';

export function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <NotFoundState label="Pagina no encontrada" />
      <Link to="/app/dashboard" className="btn btn-secondary">
        Volver al dashboard
      </Link>
    </div>
  );
}
