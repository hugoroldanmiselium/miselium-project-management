import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Menu, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { EmptyState } from './States';

function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleClickNotification(n: (typeof notifications)[number]) {
    await markRead(n);
    setOpen(false);
    if (n.link) navigate(n.link);
  }

  return (
    <div className="notif-bell-wrap" ref={wrapRef}>
      <button className="btn btn-ghost notif-bell-btn" onClick={() => setOpen((o) => !o)} aria-label="Notificaciones">
        <Bell size={18} />
        {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>
      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <span>Notificaciones</span>
            {unreadCount > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={markAllRead}>
                Marcar todas
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <EmptyState title="Sin notificaciones" />
          ) : (
            notifications.map((n) => (
              <button key={n.id} className={`notif-item ${!n.read ? 'unread' : ''}`} onClick={() => handleClickNotification(n)}>
                <div>{n.message}</div>
                <div className="notif-item-meta">{new Date(n.created_at).toLocaleString('es-MX')}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

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
        <NotificationBell />
        <div className="avatar" title={profile?.name}>
          {initials}
        </div>
      </div>
    </header>
  );
}
