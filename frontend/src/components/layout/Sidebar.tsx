import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  GitBranch,
  BarChart3,
  BookOpen,
  Rocket,
  Trophy,
  Shield,
  Settings,
  Zap,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { apiClient } from '@/api/client';
import clsx from 'clsx';

const navItems = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/pipelines',   icon: GitBranch,        label: 'Pipelines' },
  { to: '/analytics',   icon: BarChart3,        label: 'Analytics' },
  { to: '/repositories',icon: BookOpen,         label: 'Repositories' },
  { to: '/deployments', icon: Rocket,           label: 'Deployments' },
  { to: '/leaderboard', icon: Trophy,           label: 'Leaderboard' },
];

const adminItems = [
  { to: '/admin', icon: Shield, label: 'Admin' },
];

export const Sidebar = () => {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isAdmin = user?.role === 'ADMIN';
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (e) {}
    logout();
    navigate('/login');
  };

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col bg-dark-800 border-r border-white/[0.06]">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-white/[0.06]">
        <div className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center shadow-glow">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-none">BuildPulse</p>
          <p className="text-[10px] text-brand-400 font-medium tracking-widest uppercase leading-none mt-0.5">Pro</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        <p className="px-3 py-2 text-[10px] font-semibold text-dark-300 uppercase tracking-widest">
          Monitoring
        </p>

        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'text-white bg-brand-600/20 border border-brand-500/30 shadow-glow'
                  : 'text-dark-300 hover:text-white hover:bg-white/5'
              )
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className="pt-3">
              <p className="px-3 py-2 text-[10px] font-semibold text-dark-300 uppercase tracking-widest">
                Administration
              </p>
            </div>
            {adminItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'text-white bg-brand-600/20 border border-brand-500/30 shadow-glow'
                      : 'text-dark-300 hover:text-white hover:bg-white/5'
                  )
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User profile at bottom */}
      <div className="p-3 border-t border-white/[0.06] space-y-1">
        <NavLink
          to="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-dark-300 hover:text-white hover:bg-white/5 transition-all duration-150"
        >
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name} className="w-6 h-6 rounded-full" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white">
              {user?.name?.[0]?.toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white truncate leading-tight">{user?.name}</p>
            <p className="text-[10px] text-brand-400 truncate leading-none mt-0.5 uppercase font-bold tracking-wider">
              {user?.githubLogin || user?.email?.split('@')[0]}
            </p>
            <p className="text-[9px] text-dark-300 truncate leading-none mt-0.5 uppercase tracking-wider">{user?.role}</p>
          </div>
          <Settings className="w-3.5 h-3.5 ml-auto flex-shrink-0 text-dark-300 hover:text-white" />
        </NavLink>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold text-danger-500 hover:text-red-400 hover:bg-danger-500/10 transition-all duration-150"
        >
          <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  );
};
