import { LogIn, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
  const { currentUser, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (currentUser) {
    return <Navigate to="/" replace />;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const result = login(username, password);
    if (!result.ok) {
      setError(result.error || 'Не удалось выполнить вход.');
      return;
    }

    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/';
    navigate(from, { replace: true });
  }

  return (
    <main className="min-h-screen bg-laboratory-panel px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center">
        <section className="grid w-full overflow-hidden rounded border border-laboratory-line bg-white shadow-soft lg:grid-cols-[0.95fr_1.05fr]">
          <div className="bg-laboratory-navy p-8 text-white sm:p-10">
            <div className="mb-8 flex items-center gap-3">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-white p-1.5 shadow-[0_0_22px_rgba(95,166,220,0.45)] ring-1 ring-white/35">
                <img src="/logo-new.svg" alt="" className="h-full w-full object-contain" aria-hidden="true" />
              </span>
              <div>
                <h1 className="text-xl font-semibold">Dynamic Laboratory Calculator</h1>
                <p className="mt-1 text-sm text-blue-100">Цифровая система автоматизации лабораторных расчетов</p>
              </div>
            </div>
            <div className="mt-10">
              <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-100">Защищенный доступ</p>
              <h2 className="text-3xl font-semibold">Вход в лабораторную систему</h2>
              <p className="mt-4 leading-7 text-blue-50">
                Авторизуйтесь, чтобы создавать расчеты, сохранять историю и формировать отчеты по вашим правам доступа.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-8 sm:p-10">
            <div className="mb-7 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded bg-blue-50 text-laboratory-blue">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-2xl font-semibold text-laboratory-ink">Авторизация</h2>
                <p className="mt-1 text-sm text-slate-600">Введите учетные данные пользователя.</p>
              </div>
            </div>

            <div className="grid gap-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">username</span>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="focus-ring w-full rounded border border-laboratory-line bg-white px-3 py-2.5 text-laboratory-ink"
                  autoComplete="username"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="focus-ring w-full rounded border border-laboratory-line bg-white px-3 py-2.5 text-laboratory-ink"
                  autoComplete="current-password"
                />
              </label>
            </div>

            {error ? <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

            <button
              type="submit"
              className="focus-ring mt-6 inline-flex w-full items-center justify-center gap-2 rounded bg-laboratory-blue px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-laboratory-navy"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Войти
            </button>

            <div className="mt-5 rounded border border-laboratory-line bg-laboratory-panel px-3 py-2 text-sm text-slate-600">
              Администратор по умолчанию: <span className="font-semibold text-laboratory-ink">admin</span> /{' '}
              <span className="font-semibold text-laboratory-ink">admin123</span>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
