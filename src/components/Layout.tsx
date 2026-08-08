import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Package,
  ReceiptText,
  FileBarChart,
  Wallet,
  Settings as SettingsIcon,
  Building2,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import { clsx } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/billing', label: 'Billing', icon: ReceiptText },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
  { to: '/payments', label: 'Payments', icon: Wallet },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export default function Layout() {
  const loc = useLocation();
  const nav = useNavigate();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [loc.pathname]);

  async function handleLogout() {
    await logout();
    nav('/login', { replace: true });
  }

  return (
    <div className="min-h-screen flex bg-slate-50 relative">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar - desktop fixed, mobile drawer */}
      <aside
        className={clsx(
          'fixed lg:static inset-y-0 left-0 z-50 w-72 lg:w-64 shrink-0 min-h-screen bg-white border-r border-slate-200 flex flex-col no-print transition-transform',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center text-white">
              <Building2 size={20} />
            </div>
            <div>
              <div className="font-bold text-slate-900 leading-tight">PS Enterprises</div>
              <div className="text-[11px] text-slate-500">Wholesale ERP</div>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden w-9 h-9 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center"
            aria-label="Close menu"
          >
            <X size={18}/>
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map((n) => {
            const active = loc.pathname === n.to || (n.to !== '/' && loc.pathname.startsWith(n.to));
            const Icon = n.icon;
            return (
              <NavLink
                key={n.to}
                to={n.to}
                className={clsx(
                  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                  active
                    ? 'bg-brand-50 text-brand-700 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                )}
              >
                <Icon
                  size={18}
                  className={clsx(active ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600')}
                />
                {n.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-100 space-y-2">
          {user?.email && (
            <div className="px-2 text-[11px] text-slate-500 truncate" title={user.email}>
              {user.email}
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-700 transition"
          >
            <LogOut size={16} />
            Logout
          </button>
          <div className="px-2 text-[10px] text-slate-400">
            © {new Date().getFullYear()} PS Enterprises
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-w-full lg:min-w-0">
        <header className="h-16 bg-white/80 backdrop-blur border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 no-print gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden w-10 h-10 rounded-lg hover:bg-slate-100 text-slate-600 flex items-center justify-center shrink-0"
              aria-label="Open menu"
            >
              <Menu size={20}/>
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                {pageTitle(loc.pathname)}
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate hidden sm:block">{subtitle(loc.pathname)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <NavLink
              to="/billing"
              className="inline-flex items-center gap-1.5 sm:gap-2 bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-800 text-white text-xs sm:text-sm font-semibold px-3 sm:px-4 py-2 rounded-lg shadow-pop transition-shadow"
            >
              <ReceiptText size={14}/>
              <span className="hidden sm:inline">New Bill</span>
              <span className="sm:hidden">Bill</span>
            </NavLink>
          </div>
        </header>
        <main className="flex-1 p-3 sm:p-4 md:p-6 animate-fadeIn">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function pageTitle(path: string): string {
  if (path === '/') return 'Dashboard';
  if (path.startsWith('/customers')) return 'Customers';
  if (path.startsWith('/products')) return 'Products';
  if (path.startsWith('/billing')) return 'New Bill';
  if (path.startsWith('/invoices')) return 'Invoice Details';
  if (path.startsWith('/reports')) return 'Reports & Invoices';
  if (path.startsWith('/payments')) return 'Payments';
  if (path.startsWith('/settings')) return 'Business Settings';
  return '';
}

function subtitle(path: string): string {
  if (path === '/') return 'Overview of today\'s business activity';
  if (path.startsWith('/customers')) return 'Manage your customer directory';
  if (path.startsWith('/products')) return 'Stock, pricing & inventory';
  if (path.startsWith('/billing')) return 'Create & share a new invoice';
  if (path.startsWith('/invoices')) return 'Share, collect payment & track status';
  if (path.startsWith('/reports')) return 'Sales, invoices & summaries';
  if (path.startsWith('/payments')) return 'Track receivables & history';
  if (path.startsWith('/settings')) return 'Business profile, UPI ID & preferences';
  return '';
}
