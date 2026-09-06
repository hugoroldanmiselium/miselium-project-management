import { Menu, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { profile } = useAuth();
  const initials = profile?.name
    ? profile.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  return (
    <header className="header">
      <button className="mobile-menu-btn btn-ghost btn" onClick={onMenuClick} aria-label="Abrir menu">
        <Menu size={18} />
      </button>
      <div className="header-search input-with-icon">
        <Search size={16} />
        <input className="input" placeholder="Buscar..." />
      </div>
      <div className="flex items-center gap-3">
        <span className="text-small text-secondary" style={{ display: 'none' }} />
        <div className="avatar" title={profile?.name}>
          {initials}
        </div>
      </div>
    </header>
  );
}
