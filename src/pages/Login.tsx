import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Input } from '../components/Input';
import { Button } from '../components/Button';

export function Login() {
  const { signIn, session, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && session) {
    return <Navigate to="/app/dashboard" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError('Ingresa tu correo y contrasena.');
      return;
    }
    setSubmitting(true);
    const { error: signInError } = await signIn(email, password);
    setSubmitting(false);
    if (signInError) {
      setError('Credenciales invalidas. Verifica tu correo y contrasena.');
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg)',
        padding: 'var(--space-4)',
      }}
    >
      <div className="card card-padded" style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ marginBottom: 'var(--space-8)', textAlign: 'center' }}>
          <div className="wordmark">Miselium</div>
          <div className="wordmark-sub">Operations</div>
        </div>
        <h2 style={{ marginBottom: 4 }}>Iniciar sesion</h2>
        <p className="text-secondary text-small mb-6">Accede a tu panel de operaciones.</p>
        <form onSubmit={handleSubmit}>
          <Input
            label="Correo electronico"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@miselium.com"
            autoComplete="email"
            required
          />
          <Input
            label="Contrasena"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="********"
            autoComplete="current-password"
            required
          />
          {error && (
            <div className="field-error mb-4" role="alert">
              {error}
            </div>
          )}
          <Button type="submit" variant="primary" full loading={submitting}>
            Entrar
          </Button>
        </form>
        <div className="mt-6 text-small text-muted" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-4)' }}>
          Demo: admin@miselium.com / dev1@miselium.com — contrasena Miselium2026!
        </div>
      </div>
    </div>
  );
}
