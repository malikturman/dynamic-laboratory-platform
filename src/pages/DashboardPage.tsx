import {
  Activity,
  ArrowRight,
  ClipboardCheck,
  FileText,
  FlaskConical,
  Microscope,
  Sparkles,
  TimerReset,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { developmentModules } from '../data/developmentModules';
import { laboratories } from '../data/laboratories';
import { getUsers } from '../storage/authStorage';
import { getSavedCalculations } from '../storage/historyStorage';
import type { AppUser, LaboratoryId, SavedCalculation } from '../types';

const laboratoryIcons: Record<LaboratoryId, typeof Microscope> = {
  bacteriology: Microscope,
  sanitary: FlaskConical,
};

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function DashboardPage() {
  const { currentUser } = useAuth();
  const [history, setHistory] = useState<SavedCalculation[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);

  useEffect(() => {
    const savedHistory = getSavedCalculations();
    setHistory(currentUser?.role === 'admin' ? savedHistory : savedHistory.filter((item) => item.userId === currentUser?.id));
    setUsers(getUsers());
  }, [currentUser]);

  const activeMethodsCount = useMemo(
    () => laboratories.reduce((total, laboratory) => total + laboratory.indicators.length, 0),
    [],
  );
  const latestReports = useMemo(() => sortByDateDesc(history).slice(0, currentUser?.role === 'admin' ? 10 : 5), [history, currentUser]);
  const lastCalculation = latestReports[0];
  const specialistsCount = users.filter((user) => user.role === 'specialist').length;
  const calculationsByLaboratory = useMemo(() => {
    const counts = new Map<string, number>();
    laboratories.forEach((laboratory) => counts.set(laboratory.name, 0));
    history.forEach((item) => counts.set(item.laboratoryName, (counts.get(item.laboratoryName) ?? 0) + 1));
    return Array.from(counts.entries()).map(([label, value]) => ({ label, value }));
  }, [history]);
  const calculationsBySpecialist = useMemo(() => {
    const counts = new Map<string, number>();
    history.forEach((item) => {
      const label = item.specialistName || item.specialist || item.username || 'Специалист не указан';
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label, 'ru-RU'));
  }, [history]);

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded border border-laboratory-line bg-white shadow-soft">
        <div className="relative px-5 py-8 sm:px-8 lg:px-10">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-laboratory-blue via-sky-400 to-cyan-300" />
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
            <div className="max-w-4xl">
              <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-laboratory-blue">
                Лабораторная платформа
              </p>
              <h1 className="text-3xl font-semibold tracking-normal text-laboratory-ink sm:text-5xl">
                Dynamic Laboratory Calculator
              </h1>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                Цифровая система автоматизации лабораторных расчетов
              </p>
            </div>
            <div className="rounded border border-laboratory-line bg-laboratory-panel p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded bg-white text-laboratory-blue shadow-sm">
                  <Activity className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-500">{isAdmin ? 'Административный обзор' : 'Рабочая область'}</p>
                  <p className="text-lg font-semibold text-laboratory-ink">{isAdmin ? 'Контроль расчетов' : 'Мои расчеты'}</p>
                </div>
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded bg-white">
                <div className="h-full w-2/3 rounded bg-gradient-to-r from-laboratory-blue to-cyan-400" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="statistics-title">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 id="statistics-title" className="text-2xl font-semibold text-laboratory-ink">
            {isAdmin ? 'Статистика администратора' : 'Моя статистика'}
          </h2>
          <Link
            to="/history"
            className="focus-ring rounded px-3 py-2 text-sm font-medium text-laboratory-blue hover:text-laboratory-navy"
          >
            История расчетов
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <StatisticCard
            icon={ClipboardCheck}
            label={isAdmin ? 'Всего расчетов' : 'Мои расчеты'}
            value={String(history.length)}
            caption={isAdmin ? 'Все сохраненные расчеты' : 'Сохранено в моей истории'}
          />
          {isAdmin ? (
            <StatisticCard
              icon={UsersRound}
              label="Зарегистрированные специалисты"
              value={String(specialistsCount)}
              caption="Пользователи с ролью specialist"
            />
          ) : (
            <StatisticCard
              icon={FileText}
              label="Мои последние отчеты"
              value={String(latestReports.length)}
              caption="Доступны для просмотра и PDF"
            />
          )}
          <StatisticCard
            icon={TimerReset}
            label={isAdmin ? 'Последний расчет' : 'Мой последний расчет'}
            value={lastCalculation ? lastCalculation.indicatorName : 'Нет данных'}
            caption={lastCalculation ? dateFormatter.format(new Date(lastCalculation.date)) : 'История пока пуста'}
          />
        </div>
      </section>

      {isAdmin ? (
        <section aria-labelledby="admin-dashboard-title">
          <h2 id="admin-dashboard-title" className="sr-only">
            Административные показатели
          </h2>
          <div className="grid gap-5 lg:grid-cols-2">
            <MetricListCard title="Расчеты по лабораториям" icon={FlaskConical} items={calculationsByLaboratory} emptyText="Расчеты пока не сохранены." />
            <MetricListCard
              title="Расчеты по специалистам"
              icon={UserRoundCheck}
              items={calculationsBySpecialist}
              emptyText="Нет расчетов, привязанных к специалистам."
            />
          </div>
        </section>
      ) : null}

      <LatestReportsSection reports={latestReports} isAdmin={isAdmin} />

      <section aria-labelledby="laboratories-title">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 id="laboratories-title" className="text-2xl font-semibold text-laboratory-ink">
            Лаборатории
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {laboratories.map((laboratory) => {
            const Icon = laboratoryIcons[laboratory.id];
            return (
              <article
                key={laboratory.id}
                className="group relative overflow-hidden rounded border border-laboratory-line bg-white p-5 shadow-soft transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-laboratory-blue via-sky-400 to-cyan-300" />
                <div className="mb-5 flex items-start gap-4">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-gradient-to-br from-blue-50 to-cyan-50 text-laboratory-blue ring-1 ring-blue-100 transition group-hover:scale-105">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-xl font-semibold text-laboratory-ink">{laboratory.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{laboratory.description}</p>
                  </div>
                </div>
                <div className="mb-5 flex flex-wrap gap-2">
                  {laboratory.indicators.map((indicator) => (
                    <span
                      key={indicator.id}
                      className="rounded bg-laboratory-panel px-2.5 py-1 text-xs font-medium text-laboratory-blue"
                    >
                      {indicator.name}
                    </span>
                  ))}
                </div>
                <Link
                  to={`/laboratories/${laboratory.id}`}
                  className="focus-ring inline-flex items-center gap-2 rounded bg-laboratory-blue px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-laboratory-navy"
                >
                  Открыть лабораторию
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </article>
            );
          })}

          {developmentModules.map((module) => {
            const Icon = module.icon;
            return (
              <article
                key={module.id}
                className="group relative overflow-hidden rounded border border-laboratory-line bg-white p-5 shadow-soft transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-400 via-laboratory-blue to-cyan-300" />
                <div className="mb-5 flex items-start gap-4">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-gradient-to-br from-blue-50 to-slate-100 text-laboratory-blue ring-1 ring-blue-100 transition group-hover:scale-105 group-hover:shadow-[0_0_24px_rgba(31,95,153,0.18)]">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-semibold text-laboratory-ink">{module.title}</h3>
                      <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-100">
                        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                        В разработке
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-slate-600">{module.description}</p>
                  </div>
                </div>
                <Link
                  to={`/modules/${module.id}`}
                  className="focus-ring inline-flex items-center gap-2 rounded border border-laboratory-blue bg-white px-4 py-2.5 text-sm font-semibold text-laboratory-blue transition hover:bg-blue-50"
                >
                  Открыть модуль
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

interface StatisticCardProps {
  icon: typeof Activity;
  label: string;
  value: string;
  caption: string;
}

function StatisticCard({ icon: Icon, label, value, caption }: StatisticCardProps) {
  return (
    <article className="rounded border border-laboratory-line bg-white p-5 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-laboratory-ink">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{caption}</p>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-blue-50 text-laboratory-blue">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}

interface MetricListCardProps {
  title: string;
  icon: typeof Activity;
  items: Array<{ label: string; value: number }>;
  emptyText: string;
}

function MetricListCard({ title, icon: Icon, items, emptyText }: MetricListCardProps) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <section className="rounded border border-laboratory-line bg-white p-5 shadow-soft">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded bg-blue-50 text-laboratory-blue">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <h3 className="text-xl font-semibold text-laboratory-ink">{title}</h3>
      </div>

      {items.length > 0 ? (
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.label}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-slate-700">{item.label}</span>
                <span className="font-semibold text-laboratory-navy">{item.value}</span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-laboratory-panel">
                <div
                  className="h-full rounded bg-gradient-to-r from-laboratory-blue to-cyan-400"
                  style={{ width: `${Math.max(5, (item.value / maxValue) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded border border-laboratory-line bg-laboratory-panel px-3 py-2 text-sm text-slate-600">{emptyText}</p>
      )}
    </section>
  );
}

function LatestReportsSection({ reports, isAdmin }: { reports: SavedCalculation[]; isAdmin: boolean }) {
  return (
    <section className="overflow-hidden rounded border border-laboratory-line bg-white shadow-soft" aria-labelledby="latest-reports-title">
      <div className="flex flex-col gap-2 border-b border-laboratory-line bg-laboratory-panel/70 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-laboratory-blue">
            {isAdmin ? 'Последние 10 отчетов' : 'Мои последние отчеты'}
          </p>
          <h2 id="latest-reports-title" className="text-xl font-semibold text-laboratory-ink">
            Журнал отчетов
          </h2>
        </div>
        <Link to="/history" className="focus-ring rounded px-3 py-2 text-sm font-medium text-laboratory-blue hover:text-laboratory-navy">
          Открыть историю
        </Link>
      </div>

      {reports.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-laboratory-line text-left text-sm">
            <thead className="bg-laboratory-navy text-white">
              <tr>
                <th className="px-4 py-3 font-semibold">Дата</th>
                <th className="px-4 py-3 font-semibold">Лаборатория</th>
                <th className="px-4 py-3 font-semibold">Показатель</th>
                <th className="px-4 py-3 font-semibold">Специалист</th>
                <th className="px-4 py-3 font-semibold">Результат</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-laboratory-line">
              {reports.map((report) => (
                <tr key={report.id} className="transition hover:bg-blue-50/70">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{dateFormatter.format(new Date(report.date))}</td>
                  <td className="px-4 py-3 text-slate-700">{report.laboratoryName}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-blue-50 px-2.5 py-1 font-medium text-laboratory-blue">{report.indicatorName}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{report.specialistName || report.specialist || 'Не указан'}</td>
                  <td className="px-4 py-3 font-semibold text-laboratory-navy">{report.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-8 text-center">
          <h3 className="text-xl font-semibold text-laboratory-ink">Отчеты пока не сохранены</h3>
          <p className="mt-2 text-slate-600">После сохранения расчета он появится в этом списке.</p>
        </div>
      )}
    </section>
  );
}

function sortByDateDesc(history: SavedCalculation[]) {
  return [...history].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
}
