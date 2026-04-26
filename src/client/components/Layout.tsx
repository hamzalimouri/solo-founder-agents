import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, MessageSquare, Bot, FileText,
  Settings, LogOut, Zap,
} from 'lucide-react';
import { clearToken } from '../api.js';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  { to: '/agents', label: 'Agents', icon: Bot },
  { to: '/drafts', label: 'Drafts', icon: FileText },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  const logout = () => {
    clearToken();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-[#0a0a0b] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-[#141416] border-r border-[#2a2a2e] flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-[#2a2a2e]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#6366f1] rounded-lg flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-white">Solo Founder HQ</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-[#1c1c20] text-white font-medium'
                    : 'text-[#a1a1aa] hover:text-white hover:bg-[#1c1c20]'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-[#2a2a2e]">
          <button
            onClick={logout}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[#a1a1aa] hover:text-white hover:bg-[#1c1c20] transition-colors w-full"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
