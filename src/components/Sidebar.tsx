import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarCheck,
  FolderKanban,
  ListChecks,
  Users,
  UsersRound,
  Wallet,
  Contact2,
  Settings,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const navItems = [
  { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/app/today', label: 'Hoy', icon: CalendarCheck },
  { to: '/app/projects', label: 'Proyectos', icon: FolderKanban },
  { to: '/app/tasks', label: 'Tareas', icon: ListChecks },
  { to: '/app/clients', label: 'Clientes', icon: Users },
  { to: '/app/crm', label: 'CRM', icon: Contact2 },
  { to: '/app/team', label: 'Equipo', icon: UsersRound },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { signOut, hasFinanceAccess } = useAuth();
  const items = hasFinanceAccess
    ? [...navItems, { to: '/app/finanzas', label: 'Finanzas', icon: Wallet }]
    : navItems;

  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="wordmark">Miselium</div>
          <div className="wordmark-sub">Operations</div>
        </div>
        <nav className="sidebar-nav">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <item.icon size={17} strokeWidth={1.75} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <div className="sidebar-footer">
          <button className="sidebar-link sidebar-link-btn">
            <Settings size={17} strokeWidth={1.75} />
            Configuracion
          </button>
          <button className="sidebar-link sidebar-link-btn" onClick={() => signOut()}>
            <LogOut size={17} strokeWidth={1.75} />
            Cerrar sesion
          </button>
        </div>
      </aside>
    </>
  );
}
