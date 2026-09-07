import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { MobileNav } from '../components/MobileNav';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-col">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <div className="page-content">
          <Outlet />
        </div>
        <MobileNav />
      </div>
    </div>
  );
}
