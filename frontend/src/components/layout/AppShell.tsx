import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

/**
 * AppShell — The authenticated layout wrapper.
 *
 * Structure:
 *   ┌──────────┬────────────────────────┐
 *   │          │    Topbar              │
 *   │ Sidebar  ├────────────────────────┤
 *   │          │    <Outlet />          │
 *   │          │  (page content)        │
 *   └──────────┴────────────────────────┘
 *
 * React Router's <Outlet /> renders the matched child route here.
 */
export const AppShell = () => {
  return (
    <div className="flex h-screen bg-dark-900 overflow-hidden">
      {/* Sidebar — fixed left panel */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-screen-2xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
