import { ArrowRight, Calculator } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { SectionHeader } from '../components/SectionHeader';
import { getLaboratory } from '../data/laboratories';

export function LaboratoryPage() {
  const { labId } = useParams();
  const laboratory = getLaboratory(labId);

  if (!laboratory) {
    return <Navigate to="/" replace />;
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Главная', to: '/' }, { label: laboratory.name }]} />
      <SectionHeader title={laboratory.name} description={laboratory.description} />

      <section aria-labelledby="indicators-title">
        <h2 id="indicators-title" className="mb-5 text-2xl font-semibold text-laboratory-ink">
          Показатели
        </h2>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {laboratory.indicators.map((indicator) => (
            <article key={indicator.id} className="rounded border border-laboratory-line bg-laboratory-panel p-5">
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded bg-white text-laboratory-blue ring-1 ring-laboratory-line">
                <Calculator className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="text-xl font-semibold text-laboratory-ink">{indicator.name}</h3>
              <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{indicator.shortDescription}</p>
              <Link
                to={`/laboratories/${laboratory.id}/indicators/${indicator.id}`}
                className="focus-ring mt-5 inline-flex items-center gap-2 rounded bg-laboratory-blue px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-laboratory-navy"
              >
                Открыть расчет
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
