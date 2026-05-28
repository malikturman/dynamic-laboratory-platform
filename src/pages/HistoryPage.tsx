import { Download, Eye, Filter, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { getIndicator } from '../data/laboratories';
import { generateCalculationPdfReport } from '../pdf/reportPdf';
import { clearSavedCalculations, getSavedCalculations } from '../storage/historyStorage';
import type { IndicatorDefinition, SavedCalculation } from '../types';

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function HistoryPage() {
  const { currentUser } = useAuth();
  const [history, setHistory] = useState<SavedCalculation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [laboratoryFilter, setLaboratoryFilter] = useState('all');
  const [selectedReport, setSelectedReport] = useState<SavedCalculation | null>(null);
  const [status, setStatus] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    setHistory(getVisibleHistory(currentUser));
  }, [currentUser]);

  const laboratoryOptions = useMemo(
    () => Array.from(new Set(history.map((item) => item.laboratoryName))).filter(Boolean),
    [history],
  );

  const filteredHistory = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase('ru-RU');

    return history.filter((item) => {
      const matchesLaboratory = laboratoryFilter === 'all' || item.laboratoryName === laboratoryFilter;
      const searchableText = [
        item.laboratoryName,
        item.indicatorName,
        item.sampleNumber,
        item.specialist,
        item.result,
      ]
        .join(' ')
        .toLocaleLowerCase('ru-RU');

      return matchesLaboratory && (!normalizedQuery || searchableText.includes(normalizedQuery));
    });
  }, [history, laboratoryFilter, searchQuery]);

  function handleClearHistory() {
    if (currentUser?.role !== 'admin') {
      setStatus('Очистка всей истории доступна только администратору.');
      return;
    }

    clearSavedCalculations();
    setHistory(getVisibleHistory(currentUser));
    setSelectedReport(null);
    setStatus('');
  }

  async function handleDownloadReport(item: SavedCalculation) {
    if (!hasFullReportData(item)) {
      setStatus('Недостаточно данных для формирования полного отчета');
      return;
    }

    const indicator = getReportIndicator(item);
    if (!indicator) {
      setStatus('Недостаточно данных для формирования полного отчета');
      return;
    }

    setDownloadingId(item.id);
    setStatus('Формирование PDF...');

    try {
      await generateCalculationPdfReport({
        laboratoryName: item.laboratoryName,
        indicator,
        input: item.input,
        result: item.details,
      });
      setStatus('PDF сформирован и загружен.');
    } catch {
      setStatus('Не удалось сформировать PDF. Пустой отчет не был загружен.');
    } finally {
      setDownloadingId(null);
    }
  }

  function handleViewReport(item: SavedCalculation) {
    if (!hasFullReportData(item)) {
      setStatus('Недостаточно данных для формирования полного отчета');
      return;
    }

    setSelectedReport(item);
    setStatus('');
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Главная', to: '/' }, { label: 'История' }]} />

      <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-laboratory-blue">Локальное хранилище</p>
          <h1 className="text-3xl font-semibold text-laboratory-ink">История расчетов</h1>
          <p className="mt-2 text-slate-600">Сохраненные расчеты доступны только в текущем браузере.</p>
        </div>
        {currentUser?.role === 'admin' ? (
          <button
            type="button"
            onClick={handleClearHistory}
            disabled={history.length === 0}
            className="focus-ring inline-flex items-center justify-center gap-2 rounded border border-laboratory-line bg-white px-4 py-2.5 text-sm font-semibold text-laboratory-ink hover:bg-laboratory-panel disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Очистить историю
          </button>
        ) : null}
      </div>

      {status ? <p className={getStatusClassName(status)}>{status}</p> : null}

      <section className="overflow-hidden rounded border border-laboratory-line bg-white shadow-soft">
        <div className="border-b border-laboratory-line bg-laboratory-panel/70 p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
            <label className="relative block">
              <span className="sr-only">Поиск по истории</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="focus-ring w-full rounded border border-laboratory-line bg-white py-2.5 pl-10 pr-3 text-sm text-laboratory-ink shadow-sm"
                placeholder="Поиск по образцу, специалисту, показателю"
              />
            </label>
            <label className="relative block">
              <span className="sr-only">Фильтр по лаборатории</span>
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                value={laboratoryFilter}
                onChange={(event) => setLaboratoryFilter(event.target.value)}
                className="focus-ring w-full appearance-none rounded border border-laboratory-line bg-white py-2.5 pl-10 pr-3 text-sm text-laboratory-ink shadow-sm"
              >
                <option value="all">Все лаборатории</option>
                {laboratoryOptions.map((laboratoryName) => (
                  <option key={laboratoryName} value={laboratoryName}>
                    {laboratoryName}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Показано записей: {filteredHistory.length} из {history.length}
          </p>
        </div>

        {history.length > 0 ? (
          <div className="max-h-[620px] overflow-auto">
            <table className="min-w-full divide-y divide-laboratory-line text-left text-sm">
              <thead className="sticky top-0 z-10 bg-laboratory-navy text-white shadow-sm">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Дата
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Лаборатория
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Показатель
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Номер образца
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Специалист
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Результат
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-laboratory-line">
                {filteredHistory.map((item) => (
                  <tr key={item.id} className="transition hover:bg-blue-50/70">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{dateFormatter.format(new Date(item.date))}</td>
                    <td className="px-4 py-3 text-slate-700">{item.laboratoryName}</td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-blue-50 px-2.5 py-1 font-medium text-laboratory-blue">
                        {item.indicatorName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{item.sampleNumber}</td>
                    <td className="px-4 py-3 text-slate-700">{item.specialist}</td>
                    <td className="px-4 py-3 font-semibold text-laboratory-navy">{item.result}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleViewReport(item)}
                          className="focus-ring inline-flex items-center gap-1.5 rounded border border-laboratory-line bg-white px-3 py-1.5 text-xs font-semibold text-laboratory-ink transition hover:bg-laboratory-panel"
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          Посмотреть отчет
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadReport(item)}
                          disabled={downloadingId === item.id}
                          className="focus-ring inline-flex items-center gap-1.5 rounded bg-laboratory-blue px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-laboratory-navy disabled:cursor-wait disabled:opacity-70"
                        >
                          <Download className="h-3.5 w-3.5" aria-hidden="true" />
                          {downloadingId === item.id ? 'Формирование...' : 'Скачать PDF'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredHistory.length === 0 ? (
              <div className="p-8 text-center">
                <h2 className="text-xl font-semibold text-laboratory-ink">Ничего не найдено</h2>
                <p className="mt-2 text-slate-600">Измените поисковый запрос или фильтр лаборатории.</p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="p-8 text-center">
            <h2 className="text-xl font-semibold text-laboratory-ink">Сохраненных расчетов пока нет</h2>
            <p className="mt-2 text-slate-600">После сохранения расчета запись появится в этой таблице.</p>
          </div>
        )}
      </section>

      {selectedReport ? (
        <ReportPreviewModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onDownload={() => handleDownloadReport(selectedReport)}
          isDownloading={downloadingId === selectedReport.id}
        />
      ) : null}
    </div>
  );
}

interface ReportPreviewModalProps {
  report: SavedCalculation;
  onClose: () => void;
  onDownload: () => void;
  isDownloading: boolean;
}

function ReportPreviewModal({ report, onClose, onDownload, isDownloading }: ReportPreviewModalProps) {
  const indicator = getReportIndicator(report);
  const details = report.details;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
      <section className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded border border-laboratory-line bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-laboratory-line bg-laboratory-navy px-5 py-4 text-white">
          <div>
            <p className="text-sm font-medium text-blue-100">Название отчета</p>
            <h2 className="mt-1 text-2xl font-semibold">Отчет лабораторного расчета</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring flex h-9 w-9 items-center justify-center rounded bg-white/10 text-white hover:bg-white/20"
            aria-label="Закрыть отчет"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[calc(90vh-80px)] overflow-y-auto p-5">
          <div className="mb-5 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onDownload}
              disabled={isDownloading}
              className="focus-ring inline-flex items-center gap-2 rounded bg-laboratory-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-laboratory-navy disabled:cursor-wait disabled:opacity-70"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {isDownloading ? 'Формирование...' : 'Скачать PDF'}
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <PreviewField label="Лаборатория" value={report.laboratoryName} />
            <PreviewField label="Показатель" value={report.indicatorName} />
            <PreviewField label="Номер образца" value={report.sampleNumber} />
            <PreviewField label="Дата" value={formatReportDate(report)} />
            <PreviewField label="Специалист" value={report.specialist} />
            <PreviewField label="ГОСТ / Методика" value={details.method || 'Не указано'} />
          </div>

          <PreviewSection title="Исходные данные">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-laboratory-panel text-laboratory-ink">
                  <tr>
                    <th className="border border-laboratory-line px-3 py-2">Параметр</th>
                    <th className="border border-laboratory-line px-3 py-2">Значение</th>
                    <th className="border border-laboratory-line px-3 py-2">Единица</th>
                  </tr>
                </thead>
                <tbody>
                  {indicator?.fields.map((field) => (
                    <tr key={field.id}>
                      <td className="border border-laboratory-line px-3 py-2">{field.label}</td>
                      <td className="border border-laboratory-line px-3 py-2">
                        {report.input.values[field.id] || 'Не указано'}
                      </td>
                      <td className="border border-laboratory-line px-3 py-2">{field.unit || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PreviewSection>

          <PreviewSection title="Формула">
            <p className="rounded border border-blue-100 bg-blue-50 px-4 py-3 text-center font-serif text-lg font-semibold text-laboratory-navy">
              {details.formula}
            </p>
          </PreviewSection>

          <PreviewSection title="Расшифровка обозначений">
            <PreviewList items={details.legend} />
          </PreviewSection>

          <PreviewSection title="Подстановка значений">
            <p>{details.substitution || 'Не указано'}</p>
          </PreviewSection>

          <PreviewSection title="Промежуточный расчет">
            <PreviewList items={details.intermediate} />
          </PreviewSection>

          <PreviewSection title="Итоговый результат">
            <p className="rounded border border-blue-200 bg-gradient-to-br from-blue-50 to-white px-4 py-3 text-lg font-semibold text-laboratory-navy">
              {details.finalResult || details.result}
            </p>
          </PreviewSection>

          <PreviewSection title="Пояснение">
            <p>{details.explanation}</p>
          </PreviewSection>
        </div>
      </section>
    </div>
  );
}

interface PreviewFieldProps {
  label: string;
  value: string;
}

function PreviewField({ label, value }: PreviewFieldProps) {
  return (
    <div className="rounded border border-laboratory-line bg-laboratory-panel/60 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-laboratory-blue">{label}</p>
      <p className="mt-1 text-sm text-laboratory-ink">{value || 'Не указано'}</p>
    </div>
  );
}

interface PreviewSectionProps {
  title: string;
  children: ReactNode;
}

function PreviewSection({ title, children }: PreviewSectionProps) {
  return (
    <section className="mt-5 rounded border border-laboratory-line bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-laboratory-blue">{title}</h3>
      <div className="text-sm leading-6 text-slate-700">{children}</div>
    </section>
  );
}

function PreviewList({ items }: { items: string[] | undefined }) {
  if (!items?.length) {
    return <p>Не указано</p>;
  }

  return (
    <ul className="space-y-1">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}

function hasFullReportData(item: SavedCalculation) {
  return Boolean(
    item.laboratoryName &&
      item.indicatorName &&
      item.sampleNumber &&
      item.specialist &&
      item.input?.sampleDate &&
      item.input?.values &&
      item.details?.method &&
      item.details?.formula &&
      item.details?.legend?.length &&
      item.details?.substitution &&
      item.details?.intermediate?.length &&
      (item.details?.finalResult || item.details?.result) &&
      item.details?.explanation,
  );
}

function getVisibleHistory(currentUser: ReturnType<typeof useAuth>['currentUser']) {
  const history = getSavedCalculations();

  if (currentUser?.role === 'admin') {
    return history;
  }

  if (!currentUser) {
    return [];
  }

  return history.filter((item) => item.userId === currentUser.id);
}

function getReportIndicator(item: SavedCalculation): IndicatorDefinition | null {
  const definition = getIndicator(item.laboratoryId, item.indicatorId);
  if (definition) {
    return definition;
  }

  if (!item.input?.values) {
    return null;
  }

  return {
    id: item.indicatorId,
    name: item.indicatorName,
    shortDescription: '',
    fields: Object.keys(item.input.values).map((fieldId) => ({
      id: fieldId,
      label: fieldId,
      type: 'text',
    })),
  };
}

function formatReportDate(item: SavedCalculation) {
  if (item.input?.sampleDate) {
    return new Intl.DateTimeFormat('ru-RU').format(new Date(item.input.sampleDate));
  }

  return dateFormatter.format(new Date(item.date));
}

function getStatusClassName(status: string) {
  const isError = status.includes('Недостаточно') || status.includes('Не удалось') || status.includes('доступна только администратору');
  const isSuccess = status.includes('сформирован');

  return [
    'mb-4 rounded border px-3 py-2 text-sm',
    isError
      ? 'border-red-200 bg-red-50 text-red-700'
      : isSuccess
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-blue-100 bg-blue-50 text-laboratory-navy',
  ].join(' ');
}
