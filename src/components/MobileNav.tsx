import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CalendarCheck, ListChecks, Contact2, MoreHorizontal, Settings, LogOut, Wallet } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Modal } from './Modal';
import { navItems } from './Sidebar';

// Principal items surfaced directly in the bottom nav (max 5, per brief).
// Everything else (Proyectos, Clientes, Equipo, Finanzas, Configuracion)
// lives inside "Mas".
const principal = [
  { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/app/today', label: 'Hoy', icon: CalendarCheck },
  { to: '/app/tasks', label: 'Tareas', icon: ListChecks },
  { to: '/app/crm', label: 'CRM', icon: Contact2 },
];

export function MobileNav() {
  const { signOut, hasFinanceAccess } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();

  const principalTos = new Set(principal.map((i) => i.to));
  const moreItems = navItems.filter((i) => !principalTos.has(i.to));
  const financeItem = hasFinanceAccess ? [{ to: '/app/finanzas', label: 'Finanzas', icon: Wallet }] : [];

  return (
    <>
      <nav className="bottom-nav" aria-label="Navegacion principal">
        {principal.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
          >
            <item.icon size={20} strokeWidth={1.75} />
            {item.label}
          </NavLink>
        ))}
        <button className="bottom-nav-item" onClick={() => setMoreOpen(true)} aria-label="Mas opciones">
          <MoreHorizontal size={20} strokeWidth={1.75} />
          Mas
        </button>
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="Mas">
        <div className="more-sheet-list">
          {[...moreItems, ...financeItem].map((item) => (
            <a
              key={item.to}
              className="more-sheet-link"
              onClick={(e) => {
                e.preventDefault();
                setMoreOpen(false);
                navigate(item.to);
              }}
              href={item.to}
            >
              <item.icon size={18} strokeWidth={1.75} />
              {item.label}
            </a>
          ))}
          <button className="more-sheet-link sidebar-link-btn">
            <Settings size={18} strokeWidth={1.75} />
            Configuracion
          </button>
          <button className="more-sheet-link sidebar-link-btn" onClick={() => signOut()}>
            <LogOut size={18} strokeWidth={1.75} />
            Cerrar sesion
          </button>
        </div>
      </Modal>
    </>
  );
}
