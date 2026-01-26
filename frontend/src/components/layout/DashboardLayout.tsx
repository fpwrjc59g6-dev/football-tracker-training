import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import {
  LayoutDashboard,
  Video,
  Users,
  UserCircle,
  Target,
  Brain,
  Settings,
  LogOut,
  ChevronRight,
  Activity,
} from 'lucide-react';
import clsx from 'clsx';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Matches', href: '/matches', icon: Video },
  { name: 'Teams', href: '/teams', icon: Users },
  { name: 'Players', href: '/players', icon: UserCircle },
  { name: 'Accuracy', href: '/accuracy', icon: Target },
  { name: 'Training', href: '/training', icon: Brain },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function DashboardLayout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();

  // Get current page title
  const currentPage = navigation.find((item) => location.pathname.startsWith(item.href));
  const pageTitle = currentPage?.name || 'Dashboard';

  return (
    <div className="min-h-screen bg-surface-950">
      {/* Sidebar */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="p-6 border-b border-surface-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-white">Football Tracker</h1>
              <p className="text-xs text-surface-500">AI Training Platform</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href ||
              (item.href !== '/dashboard' && location.pathname.startsWith(item.href));

            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={clsx(
                  isActive ? 'sidebar-link-active' : 'sidebar-link'
                )}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.name}</span>
                {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
              </NavLink>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-surface-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-surface-700 flex items-center justify-center">
              <span className="text-sm font-medium text-white">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.full_name || user?.username}
              </p>
              <p className="text-xs text-surface-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-400 hover:text-white hover:bg-surface-800 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="pl-64">
        {/* Header */}
        <header className="sticky top-0 z-40 h-16 bg-surface-900/80 backdrop-blur-sm border-b border-surface-800 flex items-center px-6">
          <h2 className="text-lg font-semibold text-white">{pageTitle}</h2>
        </header>

        {/* Page content */}
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
