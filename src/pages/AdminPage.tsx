import { Trash2, UserPlus, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { laboratories } from '../data/laboratories';
import { deleteUser, getUsers, registerSpecialist } from '../storage/authStorage';
import type { AppUser, LaboratoryId } from '../types';

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function AdminPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [laboratoryId, setLaboratoryId] = useState<LaboratoryId>('sanitary');
  const [status, setStatus] = useState('');

  useEffect(() => {
    setUsers(getUsers());
  }, []);

  const specialists = useMemo(() => users.filter((user) => user.role === 'specialist'), [users]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = registerSpecialist({ fullName, username, password, laboratoryId });

    if (!result.user) {
      setStatus(result.error || 'Не удалось зарегистрировать специалиста.');
      return;
    }

    setUsers(getUsers());
    setFullName('');
    setUsername('');
    setPassword('');
    setLaboratoryId('sanitary');
    setStatus('Специалист зарегистрирован.');
  }

  function handleDelete(userId: string) {
    const result = deleteUser(userId);
    if (!result.ok) {
      setStatus(result.error || 'Не удалось удалить пользователя.');
      return;
    }

    setUsers(getUsers());
    setStatus('Пользователь удален.');
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Главная', to: '/' }, { label: 'Панель администратора' }]} />

      <div className="mb-7">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-laboratory-blue">Управление доступом</p>
        <h1 className="text-3xl font-semibold text-laboratory-ink">Панель администратора</h1>
        <p className="mt-2 text-slate-600">Регистрация специалистов и просмотр локальных учетных записей.</p>
      </div>

      {status ? <p className={getStatusClassName(status)}>{status}</p> : null}

      <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
        <section className="rounded border border-laboratory-line bg-white p-5 shadow-soft">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded bg-blue-50 text-laboratory-blue">
              <UserPlus className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-laboratory-ink">Регистрация специалиста</h2>
              <p className="mt-1 text-sm text-slate-600">Новая учетная запись получает роль specialist.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">ФИО специалиста</span>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="focus-ring w-full rounded border border-laboratory-line bg-white px-3 py-2.5 text-laboratory-ink"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">username</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="focus-ring w-full rounded border border-laboratory-line bg-white px-3 py-2.5 text-laboratory-ink"
                autoComplete="off"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="focus-ring w-full rounded border border-laboratory-line bg-white px-3 py-2.5 text-laboratory-ink"
                autoComplete="new-password"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Лаборатория</span>
              <select
                value={laboratoryId}
                onChange={(event) => setLaboratoryId(event.target.value as LaboratoryId)}
                className="focus-ring w-full rounded border border-laboratory-line bg-white px-3 py-2.5 text-laboratory-ink"
              >
                {laboratories.map((laboratory) => (
                  <option key={laboratory.id} value={laboratory.id}>
                    {laboratory.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              className="focus-ring inline-flex items-center justify-center gap-2 rounded bg-laboratory-blue px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-laboratory-navy"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Зарегистрировать специалиста
            </button>
          </form>
        </section>

        <section className="overflow-hidden rounded border border-laboratory-line bg-white shadow-soft">
          <div className="flex items-center gap-3 border-b border-laboratory-line bg-laboratory-panel/70 p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded bg-white text-laboratory-blue shadow-sm">
              <UsersRound className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-laboratory-ink">Зарегистрированные специалисты</h2>
              <p className="mt-1 text-sm text-slate-600">Всего специалистов: {specialists.length}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-laboratory-line text-left text-sm">
              <thead className="bg-laboratory-navy text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">ФИО</th>
                  <th className="px-4 py-3 font-semibold">username</th>
                  <th className="px-4 py-3 font-semibold">Лаборатория</th>
                  <th className="px-4 py-3 font-semibold">Дата регистрации</th>
                  <th className="px-4 py-3 font-semibold">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-laboratory-line">
                {specialists.map((user) => (
                  <tr key={user.id} className="transition hover:bg-blue-50/70">
                    <td className="px-4 py-3 font-medium text-laboratory-ink">{user.fullName}</td>
                    <td className="px-4 py-3 text-slate-700">{user.username}</td>
                    <td className="px-4 py-3 text-slate-700">{user.laboratoryName || 'Не указано'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{dateFormatter.format(new Date(user.createdAt))}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleDelete(user.id)}
                        className="focus-ring inline-flex items-center gap-1.5 rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {specialists.length === 0 ? (
              <div className="p-8 text-center">
                <h3 className="text-xl font-semibold text-laboratory-ink">Специалисты пока не зарегистрированы</h3>
                <p className="mt-2 text-slate-600">Создайте первую учетную запись через форму регистрации.</p>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function getStatusClassName(status: string) {
  const isError = status.includes('Не удалось') || status.includes('Заполните') || status.includes('уже зарегистрирован') || status.includes('Пароль');

  return [
    'mb-4 rounded border px-3 py-2 text-sm',
    isError ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700',
  ].join(' ');
}
