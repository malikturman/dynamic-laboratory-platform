import { ArrowLeft, BrainCircuit, Sparkles } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { getDevelopmentModule } from '../data/developmentModules';

export function DevelopmentModulePage() {
  const { moduleId } = useParams();
  const module = getDevelopmentModule(moduleId);

  if (!module) {
    return <Navigate to="/" replace />;
  }

  const Icon = module.icon;

  return (
    <div className="space-y-6">
      <Link
        to="/"
        className="focus-ring inline-flex items-center gap-2 rounded border border-laboratory-line bg-white px-4 py-2.5 text-sm font-semibold text-laboratory-blue transition hover:bg-laboratory-panel"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Вернуться на главную
      </Link>

      <section className="relative overflow-hidden rounded border border-laboratory-line bg-white shadow-soft">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-laboratory-blue via-sky-400 to-cyan-300" />
        <div className="grid gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center lg:px-10 lg:py-12">
          <div>
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700 ring-1 ring-amber-100">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                В разработке
              </span>
            </div>
            <h1 className="text-3xl font-semibold tracking-normal text-laboratory-ink sm:text-5xl">{module.title}</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">{module.description}</p>
            <p className="mt-5 max-w-3xl rounded border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-laboratory-navy">
              Данный модуль находится в стадии разработки и будет доступен в следующих версиях системы.
            </p>
          </div>

          <div className="relative min-h-64 overflow-hidden rounded border border-laboratory-line bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-6">
            <div className="absolute right-6 top-6 flex h-16 w-16 items-center justify-center rounded bg-white text-laboratory-blue shadow-soft ring-1 ring-blue-100">
              <Icon className="h-8 w-8" aria-hidden="true" />
            </div>
            <div className="absolute bottom-6 left-6 right-6">
              <div className="mb-4 flex h-24 w-24 items-center justify-center rounded bg-laboratory-blue text-white shadow-[0_0_34px_rgba(31,95,153,0.24)]">
                <BrainCircuit className="h-12 w-12" aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <div className="h-2 w-3/4 rounded bg-laboratory-blue/20" />
                <div className="h-2 w-1/2 rounded bg-cyan-400/30" />
                <div className="h-2 w-2/3 rounded bg-slate-300/60" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
