import { ClipboardList, Home, LogOut, Menu, ShieldCheck } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';

interface AppLayoutProps {
  children: ReactNode;
}

const navigation = [
  { to: '/', label: 'Главная', icon: Home },
  { to: '/history', label: 'История', icon: ClipboardList },
];

export function AppLayout({ children }: AppLayoutProps) {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const visibleNavigation =
    currentUser?.role === 'admin' ? [...navigation, { to: '/admin', label: 'Панель администратора', icon: ShieldCheck }] : navigation;

  return (
    <div className="min-h-screen">
      <header className="bg-laboratory-navy text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <NavLink to="/" className="focus-ring flex min-w-0 items-center gap-3 rounded text-white">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-white p-1.5 shadow-[0_0_22px_rgba(95,166,220,0.45)] ring-1 ring-white/35">
              <img
                src="/logo-new.svg"
                alt=""
                className="h-full w-full object-contain drop-shadow-[0_0_7px_rgba(67,130,183,0.42)]"
                aria-hidden="true"
              />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-semibold leading-tight">Dynamic Laboratory Calculator</span>
              <span className="block text-xs text-blue-100">Цифровая система автоматизации лабораторных расчетов</span>
            </span>
          </NavLink>

          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            <nav className="flex flex-wrap items-center gap-2" aria-label="Основная навигация">
              {visibleNavigation.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      [
                        'focus-ring flex items-center gap-2 rounded px-3 py-2 text-sm font-medium transition',
                        isActive ? 'bg-white text-laboratory-navy' : 'text-blue-50 hover:bg-white/10',
                      ].join(' ')
                    }
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>

            {currentUser ? (
              <div className="flex items-center gap-2 rounded bg-white/10 px-3 py-2">
                <span className="min-w-0 text-sm">
                  <span className="block truncate font-semibold">{currentUser.fullName}</span>
                  <span className="block text-xs text-blue-100">{currentUser.role === 'admin' ? 'Администратор' : 'Специалист'}</span>
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="focus-ring flex h-9 w-9 items-center justify-center rounded bg-white/10 text-white transition hover:bg-white/20"
                  aria-label="Выйти"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ) : null}

            <NavLink
              to="/history"
              className="focus-ring flex h-10 w-10 items-center justify-center rounded bg-white/10 text-white sm:hidden"
              aria-label="Открыть историю"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </NavLink>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
