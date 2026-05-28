import { CheckCircle2, Download, Info, RotateCcw, Save, Sigma, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { calculateIndicator, createEmptyValues } from '../calculations/placeholderCalculators';
import { getIndicator, getLaboratory } from '../data/laboratories';
import { generateCalculationPdfReport } from '../pdf/reportPdf';
import { saveCalculation } from '../storage/historyStorage';
import type { CalculationInput, CalculationResult, IndicatorDefinition, SavedCalculation } from '../types';

type KmafanmTab = 'main' | 'uncertainty' | 'analysis';
type HardnessTab = 'main' | 'uncertainty' | 'analysis';
type NitriteTab = 'main' | 'uncertainty' | 'analysis';

const kmafanmTabs: Array<{ id: KmafanmTab; label: string; reportTitle: string }> = [
  { id: 'main', label: 'Основной расчет', reportTitle: 'Основной расчет' },
  { id: 'uncertainty', label: 'Неопределенность', reportTitle: 'Расчет неопределенности' },
  { id: 'analysis', label: 'Анализ', reportTitle: 'Анализ результата' },
];

const kmafanmFieldGroups: Record<KmafanmTab, string[]> = {
  main: ['object', 'inoculumVolume'],
  uncertainty: ['pipetteDivision', 'operatorUncertainty', 'thermometerDivision', 'incubationTemperature', 'coverageFactor'],
  analysis: [],
};

const hardnessTabs: Array<{ id: HardnessTab; label: string; reportTitle: string }> = [
  { id: 'main', label: 'Основной расчет', reportTitle: 'Основной расчет' },
  { id: 'uncertainty', label: 'Неопределенность', reportTitle: 'Неопределенность' },
  { id: 'analysis', label: 'Анализ', reportTitle: 'Анализ' },
];

const hardnessFieldGroups: Record<HardnessTab, string[]> = {
  main: ['ctr', 'f', 'v', 'vtr1', 'vtr2', 'vpr'],
  uncertainty: [],
  analysis: [],
};

const nitriteTabs: Array<{ id: NitriteTab; label: string; reportTitle: string }> = [
  { id: 'main', label: 'Основной расчет', reportTitle: 'Основной расчет' },
  { id: 'uncertainty', label: 'Неопределенность', reportTitle: 'Неопределенность' },
  { id: 'analysis', label: 'Анализ', reportTitle: 'Анализ' },
];

const nitriteFieldGroups: Record<NitriteTab, string[]> = {
  main: ['k', 'a', 'vk', 'v', 'f'],
  uncertainty: [],
  analysis: [],
};

interface KmafanmDilutionRow {
  id: string;
  dilution: string;
  colonies1: string;
  colonies2: string;
}

interface HardnessObservationRow {
  id: string;
  label: string;
  value: string;
}

export function CalculationPage() {
  const { labId, indicatorId } = useParams();
  const { currentUser } = useAuth();
  const laboratory = getLaboratory(labId);
  const indicator = getIndicator(labId, indicatorId);

  const initialValues = useMemo(() => (indicator ? createEmptyValues(indicator) : {}), [indicator]);
  const [sampleNumber, setSampleNumber] = useState('');
  const [sampleDate, setSampleDate] = useState(getTodayDate());
  const [specialist, setSpecialist] = useState(currentUser?.role === 'specialist' ? currentUser.fullName : '');
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [status, setStatus] = useState('');
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [activeKmafanmTab, setActiveKmafanmTab] = useState<KmafanmTab>('main');
  const [activeHardnessTab, setActiveHardnessTab] = useState<HardnessTab>('main');
  const [activeNitriteTab, setActiveNitriteTab] = useState<NitriteTab>('main');
  /*
   * TODO(sample-reports): add "create/select sample" UI before indicator input.
   * Saving should attach the calculation to selected sampleId and then update
   * the future sample page without changing the indicator calculation function.
   */

  useEffect(() => {
    if (!indicator) {
      return;
    }

    setSampleNumber('');
    setSampleDate(getTodayDate());
    setSpecialist(currentUser?.role === 'specialist' ? currentUser.fullName : '');
    setValues(initialValues);
    setResult(null);
    setStatus('');
    setIsPdfGenerating(false);
    setActiveKmafanmTab('main');
    setActiveHardnessTab('main');
    setActiveNitriteTab('main');
  }, [indicator, initialValues, currentUser]);

  useEffect(() => {
    if (indicator?.id !== 'hardness' || activeHardnessTab !== 'uncertainty') {
      return;
    }

    setResult(
      calculateIndicator(indicator, {
        sampleNumber,
        sampleDate,
        specialist,
        values,
      }),
    );
  }, [indicator, activeHardnessTab, sampleNumber, sampleDate, specialist, values]);

  if (!laboratory || !indicator) {
    return <Navigate to="/" replace />;
  }

  const activeLaboratory = laboratory;
  const activeIndicator = indicator;
  const isKmafanm = activeIndicator.id === 'kmafanm';
  const isHardness = activeIndicator.id === 'hardness';
  const isNitrites = activeIndicator.id === 'nitrites';
  const visibleFields = isKmafanm
    ? activeIndicator.fields.filter((field) => kmafanmFieldGroups[activeKmafanmTab].includes(field.id))
    : isHardness
      ? activeIndicator.fields.filter((field) => hardnessFieldGroups[activeHardnessTab].includes(field.id))
      : isNitrites
        ? activeIndicator.fields.filter((field) => nitriteFieldGroups[activeNitriteTab].includes(field.id))
        : activeIndicator.fields;

  const input: CalculationInput = {
    sampleNumber,
    sampleDate,
    specialist,
    values,
  };

  const kmafanmDilutions = isKmafanm ? parseKmafanmDilutions(values.dilutions) : [];
  const kmafanmConsistencyErrors = isKmafanm ? getDilutionConsistencyErrors(kmafanmDilutions) : [];
  const isKmafanmBlocked = kmafanmConsistencyErrors.length > 0;

  function handleKmafanmDilutionChange(rowId: string, field: keyof Omit<KmafanmDilutionRow, 'id'>, value: string) {
    const nextRows = kmafanmDilutions.map((row) => (row.id === rowId ? { ...row, [field]: value } : row));
    setValues((current) => ({ ...current, dilutions: JSON.stringify(nextRows) }));
  }

  function handleAddKmafanmDilution() {
    const nextExponent = kmafanmDilutions.length + 1;
    const nextRows = [
      ...kmafanmDilutions,
      {
        id: createKmafanmDilutionId(),
        dilution: `10^-${nextExponent}`,
        colonies1: '',
        colonies2: '',
      },
    ];
    setValues((current) => ({ ...current, dilutions: JSON.stringify(nextRows) }));
  }

  function handleRemoveKmafanmDilution(rowId: string) {
    const nextRows = kmafanmDilutions.filter((row) => row.id !== rowId);
    setValues((current) => ({ ...current, dilutions: JSON.stringify(nextRows.length ? nextRows : createDefaultKmafanmDilutions()) }));
  }

  function handleCalculate(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (isKmafanmBlocked) {
      setStatus('Ошибка последовательных разведений: большее разведение не может иметь больше колоний, чем меньшее разведение. Проверьте введенные данные.');
      setResult(null);
      return;
    }

    const nextResult = calculateIndicator(activeIndicator, input);
    setResult(nextResult);
    setStatus(nextResult.isValid === false ? 'Проверьте данные в форме.' : 'Расчет выполнен.');
  }

  function handleClear() {
    setSampleNumber('');
    setSampleDate(getTodayDate());
    setSpecialist(currentUser?.role === 'specialist' ? currentUser.fullName : '');
    setValues(createEmptyValues(activeIndicator));
    setResult(null);
    setStatus('Форма очищена.');
    setIsPdfGenerating(false);
    setActiveKmafanmTab('main');
    setActiveHardnessTab('main');
    setActiveNitriteTab('main');
  }

  function handleSave() {
    if (isKmafanmBlocked) {
      setStatus('Расчет не сохранен: исправьте ошибку последовательных разведений.');
      return;
    }

    const nextResult = result ?? calculateIndicator(activeIndicator, input);

    const canSaveHardnessUncertainty =
      isHardness && activeHardnessTab === 'uncertainty' && nextResult.reportSections?.some((section) => section.title === 'Неопределенность');

    if (nextResult.isValid === false && !canSaveHardnessUncertainty) {
      setResult(nextResult);
      setStatus('Расчет не сохранен: исправьте ошибки в форме.');
      return;
    }

    const savedCalculation: SavedCalculation = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      userId: currentUser?.id,
      specialistName: currentUser?.fullName || specialist || 'Не указан',
      username: currentUser?.username,
      laboratoryId: activeLaboratory.id,
      laboratoryName: activeLaboratory.name,
      indicatorId: activeIndicator.id,
      indicatorName: activeIndicator.name,
      sampleNumber: sampleNumber || 'Не указан',
      specialist: specialist || 'Не указан',
      result:
        canSaveHardnessUncertainty
          ? (nextResult.reportSections?.find((section) => section.title === 'Неопределенность')?.result ?? nextResult.result)
          : nextResult.result,
      input,
      details: nextResult,
    };

    saveCalculation(savedCalculation);
    setResult(nextResult);
    setStatus('Расчет сохранен в историю.');
  }

  async function handleDownloadPdf() {
    if (isKmafanmBlocked) {
      setStatus('PDF не сформирован: исправьте ошибку последовательных разведений.');
      return;
    }

    const nextResult = result ?? calculateIndicator(activeIndicator, input);
    setResult(nextResult);

    const canDownloadHardnessUncertainty =
      isHardness && activeHardnessTab === 'uncertainty' && nextResult.reportSections?.some((section) => section.title === 'Неопределенность');

    if (nextResult.isValid === false && !canDownloadHardnessUncertainty) {
      setStatus('PDF не сформирован: исправьте ошибки в форме.');
      return;
    }

    setIsPdfGenerating(true);
    setStatus('Формирование PDF...');

    try {
      const pdfPayload = isKmafanm
        ? createKmafanmPdfReportPayload(activeIndicator, nextResult, activeKmafanmTab)
        : isHardness
          ? createHardnessPdfReportPayload(activeIndicator, nextResult, activeHardnessTab)
          : isNitrites
            ? createNitritePdfReportPayload(activeIndicator, nextResult, activeNitriteTab)
            : { indicator: activeIndicator, result: nextResult };

      await generateCalculationPdfReport({
        laboratoryName: activeLaboratory.name,
        indicator: pdfPayload.indicator,
        input,
        result: pdfPayload.result,
      });
      setStatus('PDF сформирован и загружен.');
    } catch {
      setStatus('Не удалось сформировать PDF. Пустой отчет не был загружен.');
    } finally {
      setIsPdfGenerating(false);
    }
  }

  const visibleResult = result ?? {
    method: 'Нажмите «Рассчитать», чтобы сформировать методический блок.',
    formula: 'Нажмите «Рассчитать», чтобы сформировать черновой блок расчета.',
    legend: ['Расшифровка обозначений появится после расчета.'],
    substitution: 'Подстановка значений появится после расчета.',
    intermediate: ['Промежуточные расчеты появятся после ввода данных.'],
    result: 'Нет результата',
    finalResult: 'Нет результата',
    explanation: 'В минимальной версии используются заглушки. Реальные формулы будут добавляться отдельными модулями.',
  };
  const isPdfDownloadDisabled = isPdfGenerating || isKmafanmBlocked || (isNitrites && activeNitriteTab === 'uncertainty');
  const pdfButtonLabel = getPdfButtonLabel({
    isPdfGenerating,
    isHardness,
    isNitrites,
    activeHardnessTab,
    activeNitriteTab,
  });

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Главная', to: '/' },
          { label: activeLaboratory.name, to: `/laboratories/${activeLaboratory.id}` },
          { label: activeIndicator.name },
        ]}
      />

      <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-laboratory-blue">Расчет показателя</p>
          <h1 className="text-3xl font-semibold text-laboratory-ink">{activeIndicator.name}</h1>
          <p className="mt-2 text-slate-600">{activeLaboratory.name}</p>
        </div>
        <Link
          to="/history"
          className="focus-ring inline-flex items-center justify-center rounded border border-laboratory-line bg-white px-4 py-2.5 text-sm font-semibold text-laboratory-blue hover:bg-laboratory-panel"
        >
          История расчетов
        </Link>
      </div>

      <div
        className={[
          'grid gap-6',
          isKmafanm
            ? 'lg:grid-cols-2'
            : 'lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]',
        ].join(' ')}
      >
        <form onSubmit={handleCalculate} className="min-w-0 rounded border border-laboratory-line bg-white p-5 shadow-soft">
          <h2 className="mb-5 text-xl font-semibold text-laboratory-ink">Входные данные</h2>

          <div className="grid gap-4">
            {isKmafanm ? (
              <div className="grid grid-cols-3 gap-2 rounded border border-laboratory-line bg-laboratory-panel p-1">
                {kmafanmTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveKmafanmTab(tab.id)}
                    className={[
                      'focus-ring rounded px-2 py-2 text-sm font-semibold transition',
                      activeKmafanmTab === tab.id ? 'bg-laboratory-blue text-white shadow-sm' : 'text-laboratory-ink hover:bg-white',
                    ].join(' ')}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            ) : null}

            {isHardness ? (
              <div className="grid grid-cols-3 gap-2 rounded border border-laboratory-line bg-laboratory-panel p-1">
                {hardnessTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveHardnessTab(tab.id)}
                    className={[
                      'focus-ring rounded px-2 py-2 text-sm font-semibold transition',
                      activeHardnessTab === tab.id ? 'bg-laboratory-blue text-white shadow-sm' : 'text-laboratory-ink hover:bg-white',
                    ].join(' ')}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            ) : null}

            {isNitrites ? (
              <div className="grid grid-cols-3 gap-2 rounded border border-laboratory-line bg-laboratory-panel p-1">
                {nitriteTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveNitriteTab(tab.id)}
                    className={[
                      'focus-ring rounded px-2 py-2 text-sm font-semibold transition',
                      activeNitriteTab === tab.id ? 'bg-laboratory-blue text-white shadow-sm' : 'text-laboratory-ink hover:bg-white',
                    ].join(' ')}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            ) : null}

            {((!isKmafanm && !isHardness && !isNitrites) ||
              (isKmafanm && activeKmafanmTab === 'main') ||
              (isHardness && activeHardnessTab === 'main') ||
              (isNitrites && activeNitriteTab === 'main')) ? (
              <>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Номер образца</span>
                  <input
                    value={sampleNumber}
                    onChange={(event) => setSampleNumber(event.target.value)}
                    className="focus-ring w-full rounded border border-laboratory-line bg-white px-3 py-2.5 text-laboratory-ink"
                    placeholder="Например, Б-2026-001"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Дата</span>
                  <input
                    type="date"
                    value={sampleDate}
                    onChange={(event) => setSampleDate(event.target.value)}
                    className="focus-ring w-full rounded border border-laboratory-line bg-white px-3 py-2.5 text-laboratory-ink"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Специалист</span>
                  <input
                    value={specialist}
                    onChange={(event) => setSpecialist(event.target.value)}
                    className="focus-ring w-full rounded border border-laboratory-line bg-white px-3 py-2.5 text-laboratory-ink"
                    placeholder="ФИО специалиста"
                  />
                </label>
              </>
            ) : null}

            {isKmafanm && activeKmafanmTab === 'analysis' ? (
              <div className="rounded border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-laboratory-navy">
                Анализ использует количество колоний из вкладки «Основной расчет». Нажмите «Рассчитать», чтобы увидеть
                предупреждения и интерпретацию результата.
              </div>
            ) : null}

            {isKmafanm && activeKmafanmTab === 'uncertainty' ? (
              <div className="space-y-2 rounded border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-laboratory-navy">
                <p>
                  Настоящий расчет выполнен с целью оценки расширенной неопределенности результата определения КМАФАнМ.
                  Оценка учитывает основные источники неопределенности, влияющие на результат измерения: объем вносимого
                  инокулята, действия оператора и условия термостатирования.
                </p>
                <p>
                  На данном этапе определяются основные факторы, влияющие на достоверность результата: неопределенность
                  дозирования, повторяемость действий оператора и стабильность температурного режима при инкубировании.
                </p>
              </div>
            ) : null}

            {isHardness && activeHardnessTab === 'uncertainty' ? (
              <HardnessUncertaintyForm values={values} onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))} />
            ) : null}

            {isHardness && activeHardnessTab === 'analysis' ? (
              <div className="rounded border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-laboratory-navy">
                Анализ сравнивает два параллельных определения Ж1 и Ж2. Нажмите «Рассчитать», чтобы увидеть расхождение,
                статус проверки данных и краткую интерпретацию.
              </div>
            ) : null}

            {isNitrites && activeNitriteTab === 'uncertainty' ? (
              <section className="space-y-4 rounded border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-base font-semibold text-amber-950">Неопределенность измерений</h3>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
                    В разработке
                  </span>
                </div>
                <p>
                  Для реализации расчета неопределенности измерений по показателю ‘Нитриты’ необходимо загрузить утвержденную методику оценки неопределенности или официальный расчет неопределенности для данного метода.
                </p>
                <button
                  type="button"
                  disabled
                  className="inline-flex cursor-not-allowed items-center justify-center rounded border border-amber-200 bg-white px-4 py-2.5 text-sm font-semibold text-amber-500 opacity-70"
                >
                  Скачать отчет неопределенности
                </button>
                <p className="text-xs font-medium text-amber-800">
                  Модуль расчета неопределенности будет реализован после добавления утвержденной методики.
                </p>
              </section>
            ) : null}

            {isNitrites && activeNitriteTab === 'analysis' ? (
              <div className="rounded border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-laboratory-navy">
                Анализ использует результат основного фотометрического расчета. Нажмите «Рассчитать», чтобы сформировать интерпретацию, статус валидации и общий отчет по показателю.
              </div>
            ) : null}

            {visibleFields.map((field) => (
              <label key={field.id} className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  {field.label}
                  {field.required ? <span className="text-red-600"> *</span> : null}
                </span>
                <div className="flex">
                  <input
                    type={field.type}
                    value={values[field.id] ?? ''}
                    onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))}
                    className={[
                      'focus-ring w-full border border-laboratory-line bg-white px-3 py-2.5 text-laboratory-ink',
                      field.unit ? 'rounded-l' : 'rounded',
                    ].join(' ')}
                    placeholder={field.placeholder}
                    step={field.type === 'number' ? 'any' : undefined}
                  />
                  {field.unit ? (
                    <span className="-ml-px inline-flex min-w-14 items-center justify-center rounded-r border border-laboratory-line bg-laboratory-panel px-3 text-sm text-slate-600">
                      {field.unit}
                    </span>
                  ) : null}
                </div>
              </label>
            ))}

            {isKmafanm && activeKmafanmTab === 'main' ? (
              <KmafanmDilutionTable
                rows={kmafanmDilutions}
                onChange={handleKmafanmDilutionChange}
                onAdd={handleAddKmafanmDilution}
                onRemove={handleRemoveKmafanmDilution}
              />
            ) : null}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="submit"
              disabled={isKmafanmBlocked}
              className="focus-ring inline-flex items-center justify-center gap-2 rounded bg-laboratory-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-laboratory-navy disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sigma className="h-4 w-4" aria-hidden="true" />
              Рассчитать
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="focus-ring inline-flex items-center justify-center gap-2 rounded border border-laboratory-line bg-white px-4 py-2.5 text-sm font-semibold text-laboratory-ink hover:bg-laboratory-panel"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Очистить
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isKmafanmBlocked}
              className="focus-ring inline-flex items-center justify-center gap-2 rounded border border-laboratory-blue bg-white px-4 py-2.5 text-sm font-semibold text-laboratory-blue hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              Сохранить расчет
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isPdfDownloadDisabled}
              className="focus-ring inline-flex items-center justify-center gap-2 rounded border border-laboratory-line bg-laboratory-panel px-4 py-2.5 text-sm font-semibold text-laboratory-ink hover:bg-white disabled:cursor-wait disabled:opacity-70"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {pdfButtonLabel}
            </button>
          </div>

          {status ? (
            <p className={getStatusClassName(status)}>
              <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
              {status}
            </p>
          ) : null}
        </form>

        <aside className="min-w-0 rounded border border-laboratory-line bg-white p-5 shadow-soft">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-laboratory-blue">Расчетный блок</p>
              <h2 className="mt-1 text-xl font-semibold text-laboratory-ink">Результат расчета</h2>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded bg-blue-50 text-laboratory-blue">
              <Sigma className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>

          {isKmafanmBlocked ? (
            <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
              <p className="font-semibold">
                Ошибка последовательных разведений: большее разведение не может иметь больше колоний, чем меньшее
                разведение. Проверьте введенные данные.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {kmafanmConsistencyErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {isKmafanm ? (
            <KmafanmResultPanel result={visibleResult} activeTab={activeKmafanmTab} onChangeTab={setActiveKmafanmTab} />
          ) : isHardness ? (
            <HardnessResultPanel result={visibleResult} activeTab={activeHardnessTab} onChangeTab={setActiveHardnessTab} />
          ) : isNitrites ? (
            <NitriteResultPanel result={visibleResult} activeTab={activeNitriteTab} onChangeTab={setActiveNitriteTab} />
          ) : (
            <div className="space-y-4">
              <ResultBlock title="ГОСТ / Методика">
                <p>{visibleResult.method}</p>
              </ResultBlock>

              <ResultBlock title="Формула">
                <p className="rounded border border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50 px-3 py-4 text-center font-serif text-xl font-semibold text-laboratory-navy">
                  {visibleResult.formula}
                </p>
              </ResultBlock>

              <ResultBlock title="Расшифровка обозначений">
                <ul className="space-y-1">
                  {visibleResult.legend?.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              </ResultBlock>

              <ResultBlock title="Подстановка значений">
                <p>{visibleResult.substitution}</p>
              </ResultBlock>

              <ResultBlock title="Промежуточный расчет">
                <ul className="space-y-1">
                  {visibleResult.intermediate.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              </ResultBlock>

              <section className="rounded border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-laboratory-blue">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Итоговый результат
                </div>
                <p className="text-xl font-semibold text-laboratory-navy">
                  {visibleResult.finalResult ?? visibleResult.result}
                </p>
              </section>

              <ResultBlock title="Пояснение">
                <p>{visibleResult.explanation}</p>
              </ResultBlock>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

interface ResultBlockProps {
  title: string;
  children: ReactNode;
}

interface KmafanmDilutionTableProps {
  rows: KmafanmDilutionRow[];
  onChange: (rowId: string, field: keyof Omit<KmafanmDilutionRow, 'id'>, value: string) => void;
  onAdd: () => void;
  onRemove: (rowId: string) => void;
}

function KmafanmDilutionTable({ rows, onChange, onAdd, onRemove }: KmafanmDilutionTableProps) {
  const selectedRowId = getSelectedUiDilutionId(rows);
  const invalidRowIds = getInvalidUiDilutionIds(rows);

  return (
    <section className="min-w-0 rounded border border-laboratory-line bg-laboratory-panel/60 p-3 shadow-sm sm:p-4">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-laboratory-ink">Динамическая таблица разведений</h3>
          <p className="mt-1 text-sm text-slate-600">Добавляйте столько разведений, сколько требуется для учета колоний.</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="focus-ring inline-flex w-full items-center justify-center whitespace-nowrap rounded bg-laboratory-blue px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-laboratory-navy xl:w-auto xl:min-w-52"
        >
          + Добавить разведение
        </button>
      </div>

      <div className="w-full max-w-full overflow-x-auto rounded border border-laboratory-line bg-white">
        <table className="min-w-[520px] table-fixed text-left text-xs">
          <thead className="bg-laboratory-navy text-white">
            <tr>
              <th className="w-24 px-2 py-2 font-semibold">Разведение</th>
              <th className="w-20 px-2 py-2 font-semibold">Чашка 1</th>
              <th className="w-20 px-2 py-2 font-semibold">Чашка 2</th>
              <th className="w-16 px-2 py-2 font-semibold">Среднее</th>
              <th className="px-2.5 py-2 font-semibold">Статус</th>
              <th className="w-14 px-2 py-2 text-center font-semibold">Удалить</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-laboratory-line bg-white">
            {rows.map((row) => {
              const summary = getDilutionUiSummary(row);
              const isInvalid = invalidRowIds.has(row.id);
              return (
                <tr
                  key={row.id}
                  className={[
                    'transition hover:bg-blue-50/70',
                    row.id === selectedRowId ? 'bg-blue-50 ring-1 ring-inset ring-laboratory-blue/30' : '',
                    isInvalid ? 'bg-red-50 ring-1 ring-inset ring-red-300' : '',
                  ].join(' ')}
                >
                  <td className="px-2 py-2">
                    <input
                      value={row.dilution}
                      onChange={(event) => onChange(row.id, 'dilution', event.target.value)}
                      className="focus-ring w-full rounded border border-laboratory-line bg-white px-2 py-2 text-sm text-laboratory-ink"
                      placeholder="10^-3"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={row.colonies1}
                      onChange={(event) => onChange(row.id, 'colonies1', event.target.value)}
                      className="focus-ring w-full rounded border border-laboratory-line bg-white px-2 py-2 text-sm text-laboratory-ink"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={row.colonies2}
                      onChange={(event) => onChange(row.id, 'colonies2', event.target.value)}
                      className="focus-ring w-full rounded border border-laboratory-line bg-white px-2 py-2 text-sm text-laboratory-ink"
                    />
                  </td>
                  <td className="px-2 py-2 font-semibold text-laboratory-navy">{summary.average}</td>
                  <td className="px-2.5 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={summary.className}>{summary.status}</span>
                      {row.id === selectedRowId ? (
                        <span className="rounded bg-laboratory-blue px-2 py-1 text-xs font-semibold text-white">Выбрано</span>
                      ) : null}
                      {isInvalid ? (
                        <span
                          className="rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-700"
                          title="Ошибка последовательных разведений"
                        >
                          ! Ошибка
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      type="button"
                      title="Удалить разведение"
                      aria-label="Удалить разведение"
                      onClick={() => onRemove(row.id)}
                      disabled={rows.length <= 1}
                      className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface KmafanmResultPanelProps {
  result: CalculationResult;
  activeTab: KmafanmTab;
  onChangeTab: (tab: KmafanmTab) => void;
}

function KmafanmResultPanel({ result, activeTab, onChangeTab }: KmafanmResultPanelProps) {
  const activeTabDefinition = kmafanmTabs.find((tab) => tab.id === activeTab) ?? kmafanmTabs[0];
  const activeSection = result.reportSections?.find((section) => section.title === activeTabDefinition.reportTitle);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 rounded border border-laboratory-line bg-laboratory-panel p-1">
        {kmafanmTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChangeTab(tab.id)}
            className={[
              'focus-ring rounded px-2 py-2 text-sm font-semibold transition',
              activeTab === tab.id ? 'bg-laboratory-blue text-white shadow-sm' : 'text-laboratory-ink hover:bg-white',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <ResultBlock title="ГОСТ / Методика">
        <p>{result.method}</p>
      </ResultBlock>

      {activeSection ? (
        <>
          {activeSection.formula ? (
            <>
              {activeSection.notes?.length ? <ExplanationNotes notes={activeSection.notes} /> : null}
            </>
          ) : null}

          {activeSection.formula ? (
            <ResultBlock title="Формула">
              <p className="rounded border border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50 px-3 py-4 text-center font-serif text-lg font-semibold text-laboratory-navy">
                {activeSection.formula}
              </p>
            </ResultBlock>
          ) : null}

          {activeSection.legend?.length ? (
            <ResultBlock title="Расшифровка обозначений">
              <ul className="space-y-1">
                {activeSection.legend.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            </ResultBlock>
          ) : null}

          {activeSection.rows?.length ? (
            <ResultBlock title={activeTab === 'uncertainty' ? 'Бюджет неопределенности' : 'Данные раздела'}>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <tbody>
                    {activeSection.rows.map((row) => (
                      <tr key={row.label}>
                        <th className="border border-laboratory-line bg-white px-3 py-2 font-semibold text-laboratory-ink">
                          {row.label}
                        </th>
                        <td className="border border-laboratory-line bg-white px-3 py-2">{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ResultBlock>
          ) : null}

          {activeSection.tables?.length ? (
            <ReportTables tables={activeSection.tables} />
          ) : null}

          {activeSection.items?.length ? (
            <ResultBlock
              title={
                activeTab === 'main'
                  ? 'Основные шаги'
                  : activeTab === 'uncertainty'
                    ? 'Расчет неопределенности'
                    : 'Предупреждения и интерпретация'
              }
            >
              <ul className="space-y-1">
                {activeSection.items.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            </ResultBlock>
          ) : null}

          {activeSection.result ? (
            <section className="rounded border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-laboratory-blue">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Итоговый результат
              </div>
              <p className="text-xl font-semibold text-laboratory-navy">{activeSection.result}</p>
            </section>
          ) : null}

          {activeSection.explanation ? (
            <ResultBlock title="Пояснение">
              <p>{activeSection.explanation}</p>
            </ResultBlock>
          ) : null}
        </>
      ) : (
        <ResultBlock title={activeTabDefinition.label}>
          <p>Нажмите «Рассчитать», чтобы сформировать данные раздела.</p>
        </ResultBlock>
      )}
    </div>
  );
}

interface HardnessResultPanelProps {
  result: CalculationResult;
  activeTab: HardnessTab;
  onChangeTab: (tab: HardnessTab) => void;
}

interface NitriteResultPanelProps {
  result: CalculationResult;
  activeTab: NitriteTab;
  onChangeTab: (tab: NitriteTab) => void;
}

function NitriteResultPanel({ result, activeTab, onChangeTab }: NitriteResultPanelProps) {
  const activeTabDefinition = nitriteTabs.find((tab) => tab.id === activeTab) ?? nitriteTabs[0];
  const activeSection = result.reportSections?.find((section) => section.title === activeTabDefinition.reportTitle);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 rounded border border-laboratory-line bg-laboratory-panel p-1">
        {nitriteTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChangeTab(tab.id)}
            className={[
              'focus-ring rounded px-2 py-2 text-sm font-semibold transition',
              activeTab === tab.id ? 'bg-laboratory-blue text-white shadow-sm' : 'text-laboratory-ink hover:bg-white',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <ResultBlock title="ГОСТ / Методика">
        <p>{result.method}</p>
      </ResultBlock>

      {activeSection ? (
        <ReportSectionView section={activeSection} activeTab={activeTab} />
      ) : (
        <ResultBlock title={activeTabDefinition.label}>
          <p>Нажмите «Рассчитать», чтобы сформировать данные раздела.</p>
        </ResultBlock>
      )}
    </div>
  );
}

interface HardnessUncertaintyFormProps {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

const hardnessUncertaintyDefaults: Record<string, string> = {
  hardnessObject: 'Питьевая вода',
  hardnessTask: 'Оценка неопределенности измерения жесткости воды',
  hardnessMethod: 'Комплексонометрический',
  hardnessNormativeDocument: 'ГОСТ 31954-2012',
  hardnessMethodDescription:
    'Комплексонометрический метод основан на титровании пробы воды раствором трилона Б с последующим расчетом жесткости.',
  hardnessEquipment: 'Бюретка, пипетка, мерная колба, мерный цилиндр, лабораторные весы, титрованный раствор трилона Б.',
  hardnessConditions: 'Испытания проводят в лабораторных условиях при стабильной температуре и соблюдении требований методики.',
  hardnessObs1: '1.55',
  hardnessObs2: '1.65',
  hardnessObs3: '1.50',
  hardnessObs4: '1.70',
  hardnessObservations: JSON.stringify([
    { id: 'hardness-observation-1', label: 'Определение 1', value: '1.55' },
    { id: 'hardness-observation-2', label: 'Определение 2', value: '1.65' },
  ]),
  hardnessBurette: '0.02',
  hardnessPipette: '0.5',
  hardnessFlask: '0.3',
  hardnessCylinder: '0.5',
  hardnessScales: '0.5',
  hardnessTrilon: '0.3',
  hardnessCoverageFactor: '2',
  hardnessConfidenceLevel: '0.95',
};

function createDefaultHardnessObservations(): HardnessObservationRow[] {
  return [
    { id: 'hardness-observation-1', label: 'Определение 1', value: '1.55' },
    { id: 'hardness-observation-2', label: 'Определение 2', value: '1.65' },
  ];
}

function parseHardnessObservationRows(values: Record<string, string>): HardnessObservationRow[] {
  const serialized = values.hardnessObservations;

  if (serialized) {
    try {
      const parsed = JSON.parse(serialized);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((row, index) => ({
          id: typeof row.id === 'string' ? row.id : `hardness-observation-${index + 1}`,
          label: typeof row.label === 'string' && row.label.trim() ? row.label : `Определение ${index + 1}`,
          value: typeof row.value === 'string' ? row.value : String(row.value ?? ''),
        }));
      }
    } catch {
      // Older saved forms used hardnessObs1-hardnessObs4 fields.
    }
  }

  return createDefaultHardnessObservations();
}

function createHardnessObservationId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `hardness-observation-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getHardnessObservationValidation(value: string) {
  if (!value.trim()) {
    return 'Заполните значение жесткости.';
  }

  const parsed = Number(value.trim().replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 'Значение должно быть положительным числом.';
  }

  return '';
}

function HardnessUncertaintyForm({ values, onChange }: HardnessUncertaintyFormProps) {
  const textFields = [
    ['hardnessObject', 'Объект измерения'],
    ['hardnessTask', 'Измерительная задача'],
    ['hardnessMethod', 'Метод измерения'],
    ['hardnessNormativeDocument', 'Нормативный документ'],
    ['hardnessMethodDescription', 'Описание метода'],
    ['hardnessEquipment', 'Средства измерения и оборудование'],
    ['hardnessConditions', 'Условия проведения испытаний'],
  ];
  const observationRows = parseHardnessObservationRows(values);
  const canDeleteObservation = observationRows.length > 2;
  const uncertaintyFields = [
    ['hardnessBurette', 'Бюретка ±', 'мл'],
    ['hardnessPipette', 'Пипетка ±', 'мл'],
    ['hardnessFlask', 'Мерная колба ±', 'мл'],
    ['hardnessCylinder', 'Цилиндр ±', 'мл'],
    ['hardnessScales', 'Весы ±', 'мг'],
    ['hardnessTrilon', 'Трилон Б ±', 'мл'],
    ['hardnessCoverageFactor', 'Коэффициент охвата k', ''],
    ['hardnessConfidenceLevel', 'Доверительная вероятность P', ''],
  ];

  function updateObservationRows(nextRows: HardnessObservationRow[]) {
    onChange('hardnessObservations', JSON.stringify(nextRows));
  }

  function handleObservationChange(rowId: string, value: string) {
    updateObservationRows(observationRows.map((row) => (row.id === rowId ? { ...row, value } : row)));
  }

  function handleAddObservation() {
    updateObservationRows([
      ...observationRows,
      {
        id: createHardnessObservationId(),
        label: `Определение ${observationRows.length + 1}`,
        value: '',
      },
    ]);
  }

  function handleRemoveObservation(rowId: string) {
    if (!canDeleteObservation) {
      return;
    }

    const nextRows = observationRows
      .filter((row) => row.id !== rowId)
      .map((row, index) => ({ ...row, label: `Определение ${index + 1}` }));
    updateObservationRows(nextRows);
  }

  return (
    <section className="space-y-5 rounded border border-laboratory-line bg-laboratory-panel/60 p-4">
      <div>
        <h3 className="text-base font-semibold text-laboratory-ink">Отчет о неопределенности измеряемой величины</h3>
        <p className="mt-1 text-sm text-slate-600">Комплексонометрический метод по ГОСТ 31954-2012. Поля пересчитываются автоматически при изменении.</p>
      </div>

      <div>
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-laboratory-blue">1. Исходные данные</h4>
        <div className="grid gap-3">
          {textFields.map(([key, label]) => (
            <label key={key} className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
              <input
                value={values[key] ?? hardnessUncertaintyDefaults[key]}
                onChange={(event) => onChange(key, event.target.value)}
                className="focus-ring w-full rounded border border-laboratory-line bg-white px-3 py-2.5 text-laboratory-ink"
              />
            </label>
          ))}
        </div>
      </div>

      <div>
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-laboratory-blue">4. Результаты наблюдений</h4>
        <div className="overflow-hidden rounded border border-laboratory-line bg-white shadow-sm">
          <div className="grid grid-cols-[76px_minmax(0,1fr)_90px] items-center gap-3 border-b border-laboratory-line bg-laboratory-panel px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <span>№</span>
            <span>Значение жесткости, °Ж</span>
            <span className="text-center">Удалить</span>
          </div>
          <div className="divide-y divide-laboratory-line">
            {observationRows.map((row, index) => {
              const validation = getHardnessObservationValidation(row.value);

              return (
                <div key={row.id} className="grid grid-cols-[76px_minmax(0,1fr)_90px] items-start gap-3 px-3 py-3">
                  <div className="pt-2 text-sm font-semibold text-laboratory-ink">{index + 1}</div>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-slate-500">{row.label}</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={row.value}
                      onChange={(event) => handleObservationChange(row.id, event.target.value)}
                      className={[
                        'focus-ring w-full rounded border bg-white px-3 py-2.5 text-laboratory-ink',
                        validation ? 'border-red-300 bg-red-50/40' : 'border-laboratory-line',
                      ].join(' ')}
                    />
                    {validation ? <p className="mt-1 text-xs font-medium text-red-600">{validation}</p> : null}
                  </label>
                  <div className="flex justify-center pt-7">
                    <button
                      type="button"
                      title="Удалить определение"
                      aria-label="Удалить определение"
                      disabled={!canDeleteObservation}
                      onClick={() => handleRemoveObservation(row.id)}
                      className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded border border-laboratory-line text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-laboratory-line disabled:hover:bg-transparent disabled:hover:text-slate-500"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <button
          type="button"
          onClick={handleAddObservation}
          className="focus-ring mt-3 inline-flex w-full items-center justify-center rounded border border-laboratory-blue px-4 py-2.5 text-sm font-semibold text-laboratory-blue transition hover:bg-blue-50 sm:w-auto"
        >
          + Добавить параллельное определение
        </button>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Для расчета Xср, стандартного отклонения и неопределенности типа A используются все заполненные положительные значения.
        </p>
      </div>

      <div>
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-laboratory-blue">9. Входные интервалы неопределенности по типу B</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          {uncertaintyFields.map(([key, label, unit]) => (
            <label key={key} className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
              <div className="flex">
                <input
                  type="number"
                  step="any"
                  value={values[key] ?? hardnessUncertaintyDefaults[key]}
                  onChange={(event) => onChange(key, event.target.value)}
                  className={['focus-ring w-full border border-laboratory-line bg-white px-3 py-2.5 text-laboratory-ink', unit ? 'rounded-l' : 'rounded'].join(' ')}
                />
                {unit ? (
                  <span className="-ml-px inline-flex min-w-14 items-center justify-center rounded-r border border-laboratory-line bg-laboratory-panel px-3 text-sm text-slate-600">
                    {unit}
                  </span>
                ) : null}
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="rounded border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-laboratory-navy">
        Ни одна из входных величин не рассматривается коррелированной друг от друга в значительной степени. Коэффициенты
        чувствительности применяются к относительным вкладам входных величин.
      </div>
    </section>
  );
}

function HardnessResultPanel({ result, activeTab, onChangeTab }: HardnessResultPanelProps) {
  const activeTabDefinition = hardnessTabs.find((tab) => tab.id === activeTab) ?? hardnessTabs[0];
  const activeSection = result.reportSections?.find((section) => section.title === activeTabDefinition.reportTitle);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 rounded border border-laboratory-line bg-laboratory-panel p-1">
        {hardnessTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChangeTab(tab.id)}
            className={[
              'focus-ring rounded px-2 py-2 text-sm font-semibold transition',
              activeTab === tab.id ? 'bg-laboratory-blue text-white shadow-sm' : 'text-laboratory-ink hover:bg-white',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <ResultBlock title="ГОСТ / Методика">
        <p>{result.method}</p>
      </ResultBlock>

      {activeTab === 'uncertainty' && !activeSection ? (
        <section className="rounded border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          <h3 className="mb-2 font-semibold">Раздел в разработке</h3>
          <p>
            Для реализации расчета неопределенности измерений по показателю ‘Жесткость’ необходимо загрузить утвержденный
            расчет неопределенности или методику оценки неопределенности для данного метода.
          </p>
          <p className="mt-2">Расчет неопределенности будет добавлен после внесения утвержденной методики.</p>
        </section>
      ) : null}

      {activeSection ? (
        <ReportSectionView section={activeSection} activeTab={activeTab} />
      ) : activeTab !== 'uncertainty' ? (
        <ResultBlock title={activeTabDefinition.label}>
          <p>Нажмите «Рассчитать», чтобы сформировать данные раздела.</p>
        </ResultBlock>
      ) : null}
    </div>
  );
}

function ReportSectionView({
  section,
  activeTab,
}: {
  section: NonNullable<CalculationResult['reportSections']>[number];
  activeTab: 'main' | 'uncertainty' | 'analysis';
}) {
  return (
    <>
      {section.formula ? (
        <>
          {section.notes?.length ? <ExplanationNotes notes={section.notes} /> : null}
        </>
      ) : null}

      {section.formula ? (
        <ResultBlock title="Формула">
          <p className="rounded border border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50 px-3 py-4 text-center font-serif text-lg font-semibold text-laboratory-navy">
            {section.formula}
          </p>
        </ResultBlock>
      ) : null}

      {section.formulas?.length ? (
        <ResultBlock title="Математические формулы">
          <div className="space-y-2">
            {section.formulas.map((formula, index) => (
              <p
                key={`${formula}-${index}`}
                className="rounded border border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50 px-3 py-3 text-center font-serif text-base font-semibold text-laboratory-navy"
              >
                {formula}
              </p>
            ))}
          </div>
        </ResultBlock>
      ) : null}

      {section.legend?.length ? (
        <ResultBlock title="Расшифровка обозначений">
          <ul className="space-y-1">
            {section.legend.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        </ResultBlock>
      ) : null}

      {section.rows?.length ? (
        <ResultBlock title={activeTab === 'analysis' ? 'Данные анализа' : 'Данные раздела'}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <tbody>
                {section.rows.map((row) => (
                  <tr key={row.label}>
                    <th className="border border-laboratory-line bg-white px-3 py-2 font-semibold text-laboratory-ink">
                      {row.label}
                    </th>
                    <td className="border border-laboratory-line bg-white px-3 py-2">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ResultBlock>
      ) : null}

      {section.tables?.length ? (
        <ReportTables tables={section.tables} />
      ) : null}

      {section.items?.length ? (
        <ResultBlock title={activeTab === 'analysis' ? 'Интерпретация' : 'Расчетные шаги'}>
          <ul className="space-y-1">
            {section.items.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        </ResultBlock>
      ) : null}

      {section.result ? (
        <section className="rounded border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-laboratory-blue">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Итоговый результат
          </div>
          <p className="text-xl font-semibold text-laboratory-navy">{section.result}</p>
        </section>
      ) : null}

      {section.explanation ? (
        <ResultBlock title="Пояснение">
          <p>{section.explanation}</p>
        </ResultBlock>
      ) : null}
    </>
  );
}

function ExplanationNotes({ notes }: { notes: string[] }) {
  return (
    <div className="space-y-2">
      {notes.map((note) => (
        <p key={note} className="rounded border border-blue-100 bg-blue-50 px-3 py-2 text-sm leading-6 text-laboratory-navy">
          {note}
        </p>
      ))}
    </div>
  );
}

function ReportTables({ tables }: { tables: NonNullable<CalculationResult['reportSections']>[number]['tables'] }) {
  if (!tables?.length) {
    return null;
  }

  return (
    <ResultBlock title="Таблицы раздела">
      <div className="space-y-4">
        {tables.map((table) => (
          <div key={table.title ?? table.columns.join('-')} className="overflow-x-auto">
            {table.title ? <h4 className="mb-2 font-semibold text-laboratory-ink">{table.title}</h4> : null}
            {table.note ? (
              <p className="mb-3 rounded border border-blue-100 bg-blue-50 px-3 py-2 text-sm leading-6 text-laboratory-navy">{table.note}</p>
            ) : null}
            <table className="min-w-full text-left text-xs">
              <thead className="bg-laboratory-navy text-white">
                <tr>
                  {table.columns.map((column) => (
                    <th key={column} className="border border-laboratory-line px-2 py-2 font-semibold">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, rowIndex) => (
                  <tr key={`${table.title}-${rowIndex}`}>
                    {row.map((cell, cellIndex) => (
                      <td key={`${table.title}-${rowIndex}-${cellIndex}`} className="border border-laboratory-line bg-white px-2 py-2">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </ResultBlock>
  );
}

function ResultBlock({ title, children }: ResultBlockProps) {
  return (
    <section className="rounded border border-laboratory-line bg-laboratory-panel/60 p-4 transition hover:bg-white">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-laboratory-blue">{title}</h3>
      <div className="text-sm leading-6 text-slate-700">{children}</div>
    </section>
  );
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function createDefaultKmafanmDilutions(): KmafanmDilutionRow[] {
  return [{ id: 'dilution-1', dilution: '10^-1', colonies1: '', colonies2: '' }];
}

function createKmafanmPdfReportPayload(
  indicator: IndicatorDefinition,
  result: CalculationResult,
  activeTab: KmafanmTab,
) {
  if (activeTab === 'analysis' || !result.reportSections?.length) {
    return { indicator, result };
  }

  const activeTabDefinition = kmafanmTabs.find((tab) => tab.id === activeTab) ?? kmafanmTabs[0];
  const activeSection = result.reportSections.find((section) => section.title === activeTabDefinition.reportTitle);

  if (!activeSection) {
    return { indicator, result };
  }

  const filteredFields = indicator.fields.filter((field) => kmafanmFieldGroups[activeTab].includes(field.id));
  const filteredIndicator = {
    ...indicator,
    name: `${indicator.name} — ${activeTabDefinition.label}`,
    fields: filteredFields,
  };
  const filteredResult: CalculationResult = {
    ...result,
    formula: activeSection.formula ?? result.formula,
    legend: activeSection.legend ?? result.legend,
    intermediate: activeSection.items ?? result.intermediate,
    result: activeSection.result ?? result.result,
    finalResult: activeSection.result ?? result.finalResult,
    explanation: activeSection.explanation ?? result.explanation,
    reportSections: [activeSection],
  };

  return { indicator: filteredIndicator, result: filteredResult };
}

function createHardnessPdfReportPayload(
  indicator: IndicatorDefinition,
  result: CalculationResult,
  activeTab: HardnessTab,
) {
  if (activeTab === 'analysis' || !result.reportSections?.length) {
    return { indicator, result };
  }

  const activeTabDefinition = hardnessTabs.find((tab) => tab.id === activeTab) ?? hardnessTabs[0];
  const activeSection = result.reportSections.find((section) => section.title === activeTabDefinition.reportTitle);

  if (!activeSection) {
    return { indicator, result };
  }

  const filteredFields = indicator.fields.filter((field) => hardnessFieldGroups[activeTab].includes(field.id));
  const filteredIndicator = {
    ...indicator,
    name: `${indicator.name} — ${activeTabDefinition.label}`,
    fields: filteredFields,
  };
  const filteredResult: CalculationResult = {
    ...result,
    reportTitle: activeTab === 'uncertainty' ? 'Отчет о неопределенности измеряемой величины' : 'Отчет лабораторного расчета',
    formula: activeSection.formula ?? result.formula,
    legend: activeSection.legend ?? result.legend,
    intermediate: activeSection.items ?? result.intermediate,
    result: activeSection.result ?? result.result,
    finalResult: activeSection.result ?? result.finalResult,
    explanation: activeSection.explanation ?? result.explanation,
    reportSections: [activeSection],
  };

  return { indicator: filteredIndicator, result: filteredResult };
}

function createNitritePdfReportPayload(
  indicator: IndicatorDefinition,
  result: CalculationResult,
  activeTab: NitriteTab,
) {
  if (activeTab === 'analysis' || !result.reportSections?.length) {
    return { indicator, result };
  }

  const activeTabDefinition = nitriteTabs.find((tab) => tab.id === activeTab) ?? nitriteTabs[0];
  const activeSection = result.reportSections.find((section) => section.title === activeTabDefinition.reportTitle);

  if (!activeSection) {
    return { indicator, result };
  }

  const filteredFields = indicator.fields.filter((field) => nitriteFieldGroups[activeTab].includes(field.id));
  const filteredIndicator = {
    ...indicator,
    name: `${indicator.name} — ${activeTabDefinition.label}`,
    fields: filteredFields,
  };
  const filteredResult: CalculationResult = {
    ...result,
    formula: activeSection.formula ?? result.formula,
    legend: activeSection.legend ?? result.legend,
    intermediate: activeSection.items ?? result.intermediate,
    result: activeSection.result ?? result.result,
    finalResult: activeSection.result ?? result.finalResult,
    explanation: activeSection.explanation ?? result.explanation,
    reportSections: [activeSection],
  };

  return { indicator: filteredIndicator, result: filteredResult };
}

function getPdfButtonLabel({
  isPdfGenerating,
  isHardness,
  isNitrites,
  activeHardnessTab,
  activeNitriteTab,
}: {
  isPdfGenerating: boolean;
  isHardness: boolean;
  isNitrites: boolean;
  activeHardnessTab: HardnessTab;
  activeNitriteTab: NitriteTab;
}) {
  if (isPdfGenerating) {
    return 'Формирование PDF...';
  }

  if (isNitrites) {
    if (activeNitriteTab === 'main') {
      return 'Скачать основной отчет';
    }

    if (activeNitriteTab === 'uncertainty') {
      return 'Скачать отчет неопределенности';
    }

    return 'Скачать общий отчет';
  }

  if (!isHardness) {
    return 'Скачать PDF';
  }

  if (activeHardnessTab === 'main') {
    return 'Скачать основной отчет';
  }

  if (activeHardnessTab === 'uncertainty') {
    return 'Скачать отчет неопределенности';
  }

  return 'Скачать общий отчет';
}

function createKmafanmDilutionId() {
  return globalThis.crypto?.randomUUID?.() ?? `dilution-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseKmafanmDilutions(value: string | undefined): KmafanmDilutionRow[] {
  if (!value) {
    return createDefaultKmafanmDilutions();
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return createDefaultKmafanmDilutions();
    }

    return parsed.map((row, index) => ({
      id: typeof row.id === 'string' ? row.id : `dilution-${index + 1}`,
      dilution: typeof row.dilution === 'string' ? row.dilution : '',
      colonies1: typeof row.colonies1 === 'string' ? row.colonies1 : String(row.colonies1 ?? ''),
      colonies2: typeof row.colonies2 === 'string' ? row.colonies2 : String(row.colonies2 ?? ''),
    }));
  } catch {
    return createDefaultKmafanmDilutions();
  }
}

function getDilutionUiSummary(row: KmafanmDilutionRow) {
  const c1 = parseUiNumber(row.colonies1);
  const c2 = parseUiNumber(row.colonies2);

  if (c1 === null || c2 === null) {
    return {
      average: '-',
      status: 'Заполните чашки',
      className: 'rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600',
    };
  }

  const average = (c1 + c2) / 2;
  const status =
    average < 15 ? 'Ниже допустимого диапазона' : average > 300 ? 'Выше допустимого диапазона' : 'Допустимый диапазон';
  const className =
    average < 15 || average > 300
      ? 'rounded bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700'
      : 'rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700';

  return { average: new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(average), status, className };
}

function getSelectedUiDilutionId(rows: KmafanmDilutionRow[]) {
  const summaries = rows
    .map((row) => {
      const c1 = parseUiNumber(row.colonies1);
      const c2 = parseUiNumber(row.colonies2);
      if (c1 === null || c2 === null) {
        return null;
      }

      const average = (c1 + c2) / 2;
      const status =
        average < 15 ? 'Ниже допустимого диапазона' : average > 300 ? 'Выше допустимого диапазона' : 'Допустимый диапазон';
      const score = Math.abs(average - 150) - average / 300;
      return { id: row.id, average, status, score };
    })
    .filter(Boolean) as Array<{ id: string; average: number; status: string; score: number }>;

  const valid = summaries.filter((summary) => summary.status === 'Допустимый диапазон');
  const candidates = valid.length ? valid : summaries;
  return [...candidates].sort((left, right) => left.score - right.score || right.average - left.average)[0]?.id ?? null;
}

function getInvalidUiDilutionIds(rows: KmafanmDilutionRow[]) {
  return new Set(getDilutionConsistencyBreaks(rows).map((item) => item.currentId));
}

function getDilutionConsistencyErrors(rows: KmafanmDilutionRow[]) {
  return getDilutionConsistencyBreaks(rows).map(
    (item) =>
      `Ошибка: разведение ${item.currentDilution} имеет больше колоний, чем ${item.previousDilution}. Проверьте правильность ввода.`,
  );
}

function getDilutionConsistencyBreaks(rows: KmafanmDilutionRow[]) {
  const completeRows = rows
    .map((row) => {
      const c1 = parseUiNumber(row.colonies1);
      const c2 = parseUiNumber(row.colonies2);
      const factor = parseUiDilutionFactor(row.dilution);
      if (c1 === null || c2 === null || factor === null) {
        return null;
      }

      return {
        id: row.id,
        dilution: row.dilution,
        factor,
        average: (c1 + c2) / 2,
      };
    })
    .filter(Boolean) as Array<{ id: string; dilution: string; factor: number; average: number }>;

  const sortedRows = [...completeRows].sort((left, right) => left.factor - right.factor);
  const breaks: Array<{ currentId: string; currentDilution: string; previousDilution: string }> = [];

  for (let index = 1; index < sortedRows.length; index += 1) {
    if (sortedRows[index].average > sortedRows[index - 1].average) {
      breaks.push({
        currentId: sortedRows[index].id,
        currentDilution: sortedRows[index].dilution,
        previousDilution: sortedRows[index - 1].dilution,
      });
    }
  }

  return breaks;
}

function parseUiNumber(value: string) {
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseUiDilutionFactor(value: string) {
  const normalized = value.trim().replace(',', '.').replace(/\s/g, '');
  const exponentMatch = normalized.match(/^10\^?(-?\d+)$/);
  if (exponentMatch) {
    const exponent = Number(exponentMatch[1]);
    return Number.isFinite(exponent) ? (exponent < 0 ? 10 ** Math.abs(exponent) : 10 ** exponent) : null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getStatusClassName(status: string) {
  const isError = status.includes('не') || status.includes('Проверьте');
  const isSuccess = status.includes('сохранен') || status.includes('выполнен') || status.includes('сформирован');

  return [
    'mt-4 flex items-start gap-2 rounded border px-3 py-2 text-sm',
    isError
      ? 'border-red-200 bg-red-50 text-red-700'
      : isSuccess
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-blue-100 bg-blue-50 text-laboratory-navy',
  ].join(' ');
}
