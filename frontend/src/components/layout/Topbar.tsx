import { Bell, Search, Moon, Sun } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useState } from 'react';

export const Topbar = () => {
  const user = useAuthStore((s) => s.user);
  const [darkMode, setDarkMode] = useState(true);

  const toggleDark = () => {
    document.documentElement.classList.toggle('dark');
    setDarkMode((d) => !d);
  };

  return (
    <header className="h-16 flex-shrink-0 flex items-center justify-between px-6 border-b border-white/[0.06] bg-dark-800/50 backdrop-blur-sm">
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-300" />
        <input
          type="text"
          placeholder="Search pipelines, repos..."
          className="w-full bg-dark-700/50 border border-white/[0.08] rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-dark-300 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30 transition-all"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-dark-300 bg-dark-600 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 ml-4">
        {/* Dark mode toggle */}
        <button
          onClick={toggleDark}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-dark-300 hover:text-white hover:bg-white/5 transition-all"
          title="Toggle dark mode"
        >
          {darkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>

        {/* Notifications */}
        <button className="relative w-8 h-8 flex items-center justify-center rounded-lg text-dark-300 hover:text-white hover:bg-white/5 transition-all">
          <Bell className="w-4 h-4" />
          {/* Unread indicator */}
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-danger-500 rounded-full" />
        </button>

        {/* Live indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success-500/10 border border-success-500/20 ml-1">
          <span className="live-dot" />
          <span className="text-xs text-success-500 font-medium">Live</span>
        </div>
      </div>
    </header>
  );
};
