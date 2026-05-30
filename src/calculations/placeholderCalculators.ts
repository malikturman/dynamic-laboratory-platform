import type { CalculationInput, CalculationResult, IndicatorDefinition } from '../types';

const kmafanmMethod =
  'ГОСТ 10444.15-94, разделы 6 и 7; внутренний документ «Расчет неопределенности измерений. Метод определения КМАФАнМ»';
const nitriteMethod =
  'ГОСТ 33045-2014, раздел 6, фотометрический метод определения содержания нитритов с использованием сульфаниловой кислоты (метод Б)';
const hardnessMethod = 'ГОСТ 31954-2012, раздел 4, комплексонометрический метод определения жесткости воды (Метод А)';

export function calculateIndicator(
  indicator: IndicatorDefinition,
  input: CalculationInput,
): CalculationResult {
  if (indicator.id === 'kmafanm') {
    return calculateKmafanm(input);
  }

  if (indicator.id === 'nitrites') {
    return calculateNitrites(input);
  }

  if (indicator.id === 'hardness') {
    return calculateHardness(input);
  }

  return calculatePlaceholder(indicator, input);
}

export function calculatePlaceholder(
  indicator: IndicatorDefinition,
  input: CalculationInput,
): CalculationResult {
  const filledFields = indicator.fields
    .map((field) => ({
      label: field.label,
      value: input.values[field.id]?.trim(),
      unit: field.unit,
    }))
    .filter((field) => field.value);

  return {
    method: 'Методика будет добавлена после загрузки утвержденного документа.',
    formula: 'Формула будет добавлена после загрузки утвержденной методики.',
    legend: ['Обозначения будут заполнены вместе с методикой расчета.'],
    substitution: 'Подстановка значений будет доступна после подключения формулы.',
    intermediate:
      filledFields.length > 0
        ? filledFields.map((field) => `${field.label}: ${field.value}${field.unit ? ` ${field.unit}` : ''}`)
        : ['Данные еще не введены.'],
    result: 'Черновой результат не рассчитан',
    finalResult: 'Черновой результат не рассчитан',
    explanation: `Для показателя «${indicator.name}» подготовлена структура расчета. Реальная формула будет подключена отдельным модулем после внесения методики ГОСТ или внутреннего регламента.`,
    isValid: true,
  };
}

export function createEmptyValues(indicator: IndicatorDefinition) {
  const values = indicator.fields.reduce<Record<string, string>>((accumulator, field) => {
    if (indicator.id === 'nitrites' && field.id === 'f') {
      accumulator[field.id] = '1';
      return accumulator;
    }

    if (indicator.id === 'hardness') {
      accumulator[field.id] = getHardnessDefaultValue(field.id);
      return accumulator;
    }

    if (indicator.id === 'kmafanm') {
      accumulator[field.id] = getKmafanmDefaultValue(field.id);
      return accumulator;
    }

    accumulator[field.id] = '';
    return accumulator;
  }, {});

  if (indicator.id === 'kmafanm') {
    values.dilutions = getKmafanmDefaultValue('dilutions');
  }

  if (indicator.id === 'hardness') {
    values.hardnessObservations = JSON.stringify([
      { id: 'hardness-observation-1', label: 'Определение 1', value: '1.55' },
      { id: 'hardness-observation-2', label: 'Определение 2', value: '1.65' },
    ]);
  }

  if (indicator.id === 'nitrites') {
    Object.assign(values, getNitriteUncertaintyDefaultValues());
  }

  return values;
}

interface KmafanmDilutionInput {
  id: string;
  dilution: string;
  colonies1: string;
  colonies2: string;
}

interface KmafanmDilutionSummary {
  id: string;
  dilution: string;
  factor: number;
  colonies1: number;
  colonies2: number;
  average: number;
  status: 'Ниже допустимого диапазона' | 'Допустимый диапазон' | 'Выше допустимого диапазона';
  selectionScore: number;
  consistencyWarning?: string;
}

function parseKmafanmDilutions(value: string | undefined): KmafanmDilutionInput[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((row, index) => ({
      id: typeof row.id === 'string' ? row.id : `dilution-${index + 1}`,
      dilution: typeof row.dilution === 'string' ? row.dilution : '',
      colonies1: typeof row.colonies1 === 'string' ? row.colonies1 : String(row.colonies1 ?? ''),
      colonies2: typeof row.colonies2 === 'string' ? row.colonies2 : String(row.colonies2 ?? ''),
    }));
  } catch {
    return [];
  }
}

function validateKmafanmDilutions(dilutions: KmafanmDilutionInput[]) {
  if (dilutions.length === 0) {
    return ['Добавьте хотя бы одно разведение.'];
  }

  return dilutions.flatMap((dilution, index) => {
    const rowLabel = dilution.dilution || `строка ${index + 1}`;
    const errors: string[] = [];
    const factor = parseDilutionFactor(dilution.dilution);
    const colonies1 = parseNumber(dilution.colonies1);
    const colonies2 = parseNumber(dilution.colonies2);

    if (factor === null) {
      errors.push(`Введите корректное разведение для строки ${rowLabel}. Используйте формат 10^-3 или числовой коэффициент.`);
    }

    if (colonies1 === null) {
      errors.push(`Введите числовое значение для чашки 1 в разведении ${rowLabel}.`);
    } else if (colonies1 < 0) {
      errors.push(`Количество колоний на чашке 1 в разведении ${rowLabel} не может быть отрицательным.`);
    }

    if (colonies2 === null) {
      errors.push(`Введите числовое значение для чашки 2 в разведении ${rowLabel}.`);
    } else if (colonies2 < 0) {
      errors.push(`Количество колоний на чашке 2 в разведении ${rowLabel} не может быть отрицательным.`);
    }

    return errors;
  });
}

function createDilutionSummary(dilution: KmafanmDilutionInput): KmafanmDilutionSummary {
  const factor = parseDilutionFactor(dilution.dilution) ?? 1;
  const colonies1 = parseNumber(dilution.colonies1) ?? 0;
  const colonies2 = parseNumber(dilution.colonies2) ?? 0;
  const average = (colonies1 + colonies2) / 2;
  const status =
    average < 15 ? 'Ниже допустимого диапазона' : average > 300 ? 'Выше допустимого диапазона' : 'Допустимый диапазон';
  const optimalTarget = 150;
  const reliabilityBonus = average / 300;
  const selectionScore = Math.abs(average - optimalTarget) - reliabilityBonus;

  return {
    id: dilution.id,
    dilution: dilution.dilution,
    factor,
    colonies1,
    colonies2,
    average,
    status,
    selectionScore,
  };
}

function selectBestDilution(dilutions: KmafanmDilutionSummary[]) {
  const validDilutions = dilutions.filter((dilution) => dilution.status === 'Допустимый диапазон');
  const candidates = validDilutions.length ? validDilutions : dilutions;

  return [...candidates].sort((left, right) => left.selectionScore - right.selectionScore || right.average - left.average)[0] ?? null;
}

function addDilutionConsistencyWarnings(dilutions: KmafanmDilutionSummary[]) {
  const warningsById = new Map<string, string>();
  const sortedDilutions = [...dilutions].sort((left, right) => left.factor - right.factor);

  for (let index = 1; index < sortedDilutions.length; index += 1) {
    const previous = sortedDilutions[index - 1];
    const current = sortedDilutions[index];

    if (current.average > previous.average) {
      warningsById.set(
        current.id,
        `Возможна ошибка ввода или перепутаны разведения: ${current.dilution} имеет больше колоний, чем ${previous.dilution}.`,
      );
    }
  }

  return dilutions.map((dilution) => ({
    ...dilution,
    consistencyWarning: warningsById.get(dilution.id),
  }));
}

function getDilutionConsistencyErrors(dilutions: KmafanmDilutionSummary[]) {
  const sortedDilutions = [...dilutions].sort((left, right) => left.factor - right.factor);
  const errors: string[] = [];

  for (let index = 1; index < sortedDilutions.length; index += 1) {
    const previous = sortedDilutions[index - 1];
    const current = sortedDilutions[index];

    if (current.average > previous.average) {
      errors.push(`Ошибка: разведение ${current.dilution} имеет больше колоний, чем ${previous.dilution}. Проверьте правильность ввода.`);
    }
  }

  return errors;
}

function parseDilutionFactor(value: string) {
  const normalized = value.trim().replace(',', '.').replace(/\s/g, '');
  if (!normalized) {
    return null;
  }

  const exponentMatch = normalized.match(/^10\^?(-?\d+)$/);
  if (exponentMatch) {
    const exponent = Number(exponentMatch[1]);
    if (!Number.isFinite(exponent)) {
      return null;
    }

    return exponent < 0 ? 10 ** Math.abs(exponent) : 10 ** exponent;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function calculateKmafanm(input: CalculationInput): CalculationResult {
  const inoculumVolume = parsePositiveNumber(input.values.inoculumVolume, 'm');
  const dilutions = parseKmafanmDilutions(input.values.dilutions);
  const pipetteDivision = parsePositiveNumber(input.values.pipetteDivision, 'Цена деления пипетки');
  const operatorUncertainty = parsePositiveNumber(input.values.operatorUncertainty, 'Стандартная неопределенность оператора');
  const thermometerDivision = parsePositiveNumber(input.values.thermometerDivision, 'Цена деления термометра');
  const incubationTemperature = parsePositiveNumber(input.values.incubationTemperature, 'Температура термостатирования');
  const coverageFactor = parsePositiveNumber(input.values.coverageFactor, 'Коэффициент охвата k');

  const validationErrors = [
    validateRequired(input.sampleNumber, 'Укажите номер образца.'),
    validateRequired(input.sampleDate, 'Укажите дату расчета.'),
    validateRequired(input.specialist, 'Укажите специалиста.'),
    validateRequired(input.values.object ?? '', 'Укажите объект исследования.'),
    inoculumVolume.error,
    ...validateKmafanmDilutions(dilutions),
    pipetteDivision.error,
    operatorUncertainty.error,
    thermometerDivision.error,
    incubationTemperature.error,
    coverageFactor.error,
  ].filter(Boolean) as string[];

  const formula = 'C = (C1 + C2) / 2; M = (N / m) × C';

  if (
    validationErrors.length > 0 ||
    inoculumVolume.value === null ||
    pipetteDivision.value === null ||
    operatorUncertainty.value === null ||
    thermometerDivision.value === null ||
    incubationTemperature.value === null ||
    coverageFactor.value === null
  ) {
    return {
      method: kmafanmMethod,
      formula,
      legend: getKmafanmMainLegend(),
      substitution: 'Подстановка значений будет сформирована после корректного заполнения всех обязательных полей.',
      intermediate: validationErrors,
      result: 'Расчет не выполнен',
      finalResult: 'Расчет не выполнен',
      explanation: 'Проверьте входные данные. Количество колоний не может быть отрицательным; остальные числовые значения должны быть положительными. Разведение N, m, температура и k не могут быть равны нулю.',
      reportSections: createInvalidKmafanmSections(validationErrors),
      validationErrors,
      isValid: false,
    };
  }

  const dilutionSummaries = addDilutionConsistencyWarnings(dilutions.map(createDilutionSummary));
  const consistencyErrors = getDilutionConsistencyErrors(dilutionSummaries);
  if (consistencyErrors.length > 0) {
    const errors = [
      'Ошибка последовательных разведений: большее разведение не может иметь больше колоний, чем меньшее разведение. Проверьте введенные данные.',
      ...consistencyErrors,
    ];

    return {
      method: kmafanmMethod,
      formula,
      legend: getKmafanmMainLegend(),
      substitution: 'Расчет заблокирован из-за ошибки последовательных разведений.',
      intermediate: errors,
      result: 'Расчет не выполнен',
      finalResult: 'Расчет не выполнен',
      explanation: 'Исправьте таблицу разведений: при увеличении разведения среднее количество колоний не должно возрастать.',
      reportSections: createInvalidKmafanmSections(errors),
      validationErrors: errors,
      isValid: false,
    };
  }

  const selectedDilution = selectBestDilution(dilutionSummaries);

  if (!selectedDilution) {
    const noValidDilutionErrors = ['Добавьте хотя бы одно разведение с корректно заполненными значениями чашек.'];
    return {
      method: kmafanmMethod,
      formula,
      legend: getKmafanmMainLegend(),
      substitution: 'Подстановка значений будет сформирована после корректного заполнения таблицы разведений.',
      intermediate: noValidDilutionErrors,
      result: 'Расчет не выполнен',
      finalResult: 'Расчет не выполнен',
      explanation: 'Для расчета КМАФАнМ требуется хотя бы одно разведение с числовыми значениями колоний на двух чашках.',
      reportSections: createInvalidKmafanmSections(noValidDilutionErrors),
      validationErrors: noValidDilutionErrors,
      isValid: false,
    };
  }

  const kmafanm = (selectedDilution.factor / inoculumVolume.value) * selectedDilution.average;
  const pipetteUncertainty = (pipetteDivision.value / 2) / Math.sqrt(3);
  const combinedVolumeUncertainty = Math.sqrt(pipetteUncertainty ** 2 + operatorUncertainty.value ** 2);
  const thermometerUncertainty = thermometerDivision.value / Math.sqrt(3);
  const relativeStandardUncertainty = Math.sqrt(
    (combinedVolumeUncertainty / inoculumVolume.value) ** 2 +
      (thermometerUncertainty / incubationTemperature.value) ** 2,
  );
  const expandedUncertainty = relativeStandardUncertainty * coverageFactor.value;
  const expandedUncertaintyPercent = expandedUncertainty * 100;
  const formattedKmafanm = formatScientific(kmafanm);
  const formattedUncertaintyPercent = formatNumber(expandedUncertaintyPercent);

  return {
    method: kmafanmMethod,
    formula,
    legend: getKmafanmMainLegend(),
    substitution: [
      `C = (${formatNumber(selectedDilution.colonies1)} + ${formatNumber(selectedDilution.colonies2)}) / 2`,
      `M = (${formatNumber(selectedDilution.factor)} / ${formatNumber(inoculumVolume.value)}) × ${formatNumber(selectedDilution.average)}`,
    ].join('\n'),
    intermediate: [
      `Выбранное разведение: ${selectedDilution.dilution}`,
      `Среднее количество колоний: C = (${formatNumber(selectedDilution.colonies1)} + ${formatNumber(selectedDilution.colonies2)}) / 2 = ${formatNumber(selectedDilution.average)}`,
      `Расчет КМАФАнМ: M = (${formatNumber(selectedDilution.factor)} / ${formatNumber(inoculumVolume.value)}) × ${formatNumber(selectedDilution.average)} = ${formattedKmafanm} КОЕ/г или КОЕ/см³`,
    ],
    result: `${formattedKmafanm} КОЕ/г или КОЕ/см³`,
    finalResult: `КМАФАнМ = ${formattedKmafanm} КОЕ/г или КОЕ/см³; расширенная неопределенность: ±${formattedUncertaintyPercent} %`,
    explanation:
      'Расчет КМАФАнМ выполнен автоматически на основании ГОСТ 10444.15-94 и внутреннего расчета неопределенности измерений метода определения КМАФАнМ. За основу принят учет колониеобразующих единиц на двух чашках Петри с последующим расчетом среднего значения и расширенной неопределенности при коэффициенте охвата k = 2.',
    reportSections: createKmafanmSections({
      input,
      dilutionSummaries,
      selectedDilution,
      kmafanm,
      formattedKmafanm,
      pipetteDivision: pipetteDivision.value,
      operatorUncertainty: operatorUncertainty.value,
      thermometerDivision: thermometerDivision.value,
      incubationTemperature: incubationTemperature.value,
      coverageFactor: coverageFactor.value,
      inoculumVolume: inoculumVolume.value,
      pipetteUncertainty,
      combinedVolumeUncertainty,
      thermometerUncertainty,
      relativeStandardUncertainty,
      expandedUncertainty,
      formattedUncertaintyPercent,
    }),
    validationErrors: [],
    isValid: true,
  };
}

function getKmafanmDefaultValue(fieldId: string) {
  if (fieldId === 'dilutions') {
    return JSON.stringify([{ id: 'dilution-1', dilution: '10^-1', colonies1: '', colonies2: '' }]);
  }

  const defaults: Record<string, string> = {
    inoculumVolume: '1',
    pipetteDivision: '0.01',
    operatorUncertainty: '0.002',
    thermometerDivision: '0.1',
    incubationTemperature: '30',
    coverageFactor: '2',
  };

  return defaults[fieldId] ?? '';
}

function getKmafanmMainLegend() {
  return [
    'C — среднее арифметическое количество колоний на двух чашках Петри',
    'C1, C2 — количество колоний на чашках Петри 1 и 2',
    'M — количество микроорганизмов в 1 г или 1 см³ продукта, КОЕ/г или КОЕ/см³',
    'N — степень разведения',
    'm — объем инокулята, см³',
  ];
}

function getKmafanmUncertaintyLegend() {
  return [
    'u1 — стандартная неопределенность пипетки, мл',
    'u2 — стандартная неопределенность оператора, мл',
    'uM — суммарная стандартная неопределенность объема, мл',
    'uT — стандартная неопределенность термометра, °C',
    'T — температура термостатирования, °C',
    'us — относительная суммарная стандартная неопределенность',
    'U — расширенная относительная неопределенность',
    'k — коэффициент охвата',
  ];
}

interface KmafanmSectionParams {
  input: CalculationInput;
  dilutionSummaries: KmafanmDilutionSummary[];
  selectedDilution: KmafanmDilutionSummary;
  kmafanm: number;
  formattedKmafanm: string;
  pipetteDivision: number;
  operatorUncertainty: number;
  thermometerDivision: number;
  incubationTemperature: number;
  coverageFactor: number;
  inoculumVolume: number;
  pipetteUncertainty: number;
  combinedVolumeUncertainty: number;
  thermometerUncertainty: number;
  relativeStandardUncertainty: number;
  expandedUncertainty: number;
  formattedUncertaintyPercent: string;
}

function createKmafanmSections(params: KmafanmSectionParams) {
  const analysis = analyzeKmafanmDilutions(params.dilutionSummaries, params.selectedDilution);
  const controlMeasurements = createKmafanmControlMeasurements(params.inoculumVolume, params.operatorUncertainty);
  const controlAverage = average(controlMeasurements);
  const controlStandardDeviation = sampleStandardDeviation(controlMeasurements, controlAverage);
  const uncertaintyBudgetRows = createKmafanmUncertaintyBudgetRows(params, controlStandardDeviation);

  return [
    {
      title: 'Основной расчет',
      formula: 'C = (C1 + C2) / 2; M = (N / m) × C',
      formulas: [
        'C = (C1 + C2) / 2',
        'M = (N / m) × C',
        `C = (${formatNumber(params.selectedDilution.colonies1)} + ${formatNumber(params.selectedDilution.colonies2)}) / 2 = ${formatNumber(params.selectedDilution.average)}`,
        `M = (${formatNumber(params.selectedDilution.factor)} / ${formatNumber(params.inoculumVolume)}) × ${formatNumber(params.selectedDilution.average)} = ${params.formattedKmafanm} КОЕ/г или КОЕ/см³`,
      ],
      legend: getKmafanmMainLegend(),
      rows: [
        { label: 'Объект исследования', value: params.input.values.object || 'Не указан' },
        { label: 'Объем инокулята m', value: `${formatNumber(params.inoculumVolume)} см³` },
        { label: 'Выбранное разведение', value: params.selectedDilution.dilution },
        { label: 'Коэффициент разведения N', value: formatNumber(params.selectedDilution.factor) },
        { label: 'Колонии чашка 1', value: formatNumber(params.selectedDilution.colonies1) },
        { label: 'Колонии чашка 2', value: formatNumber(params.selectedDilution.colonies2) },
      ],
      tables: [
        {
          title: '1.1 Таблица последовательных разведений',
          columns: ['Разведение', 'Чашка 1', 'Чашка 2', 'Среднее', 'Статус', 'Выбор'],
          widths: ['14%', '14%', '14%', '14%', '28%', '16%'],
          rows: params.dilutionSummaries.map((dilution) => [
            dilution.dilution,
            formatNumber(dilution.colonies1),
            formatNumber(dilution.colonies2),
            formatNumber(dilution.average),
            dilution.status,
            dilution.id === params.selectedDilution.id ? 'Выбрано' : '-',
          ]),
        },
      ],
      items: [
        `1.2 Среднее количество колоний выбранного разведения: C = (${formatNumber(params.selectedDilution.colonies1)} + ${formatNumber(params.selectedDilution.colonies2)}) / 2 = ${formatNumber(params.selectedDilution.average)}`,
        `1.3 Расчет КМАФАнМ: M = (${formatNumber(params.selectedDilution.factor)} / ${formatNumber(params.inoculumVolume)}) × ${formatNumber(params.selectedDilution.average)} = ${params.formattedKmafanm} КОЕ/г или КОЕ/см³`,
        getSelectedDilutionReason(params.selectedDilution),
      ],
      result: `КМАФАнМ = ${params.formattedKmafanm} КОЕ/г или КОЕ/см³`,
      explanation: 'Основной расчет выполнен по ГОСТ 10444.15-94, разделы 6 и 7: учет колоний на двух чашках Петри и пересчет результата на 1 г или 1 см³ продукта.',
    },
    {
      title: 'Расчет неопределенности',
      notes: [
        'Настоящий расчет выполнен с целью оценки расширенной неопределенности результата определения КМАФАнМ. Оценка учитывает основные источники неопределенности, влияющие на результат измерения: объем вносимого инокулята, действия оператора и условия термостатирования.',
      ],
      formula: 'u1 = (цена деления пипетки / 2) / √3; uM = √(u1² + u2²); uT = цена деления термометра / √3; us = √((uM / m)² + (uT / T)²); U = us × k',
      formulas: [
        'u1 = (dп / 2) / √3',
        'u2 = sоператора',
        'uM = √(u1² + u2²)',
        'uT = dT / √3',
        'us = √((uM / m)² + (uT / T)²)',
        'U = us × k',
        'U% = U × 100',
        `u1 = (${formatNumber(params.pipetteDivision)} / 2) / √3 = ${formatNumber(params.pipetteUncertainty)} мл`,
        `uM = √(${formatNumber(params.pipetteUncertainty)}² + ${formatNumber(params.operatorUncertainty)}²) = ${formatNumber(params.combinedVolumeUncertainty)} мл`,
        `us = √((${formatNumber(params.combinedVolumeUncertainty)} / ${formatNumber(params.inoculumVolume)})² + (${formatNumber(params.thermometerUncertainty)} / ${formatNumber(params.incubationTemperature)})²) = ${formatNumber(params.relativeStandardUncertainty)}`,
        `U = ${formatNumber(params.relativeStandardUncertainty)} × ${formatNumber(params.coverageFactor)} = ${formatNumber(params.expandedUncertainty)} = ${params.formattedUncertaintyPercent} %`,
      ],
      legend: getKmafanmUncertaintyLegend(),
      rows: [
        { label: 'Цена деления пипетки', value: `${formatNumber(params.pipetteDivision)} мл` },
        { label: 'Стандартная неопределенность оператора u2', value: `${formatNumber(params.operatorUncertainty)} мл` },
        { label: 'Цена деления термометра', value: `${formatNumber(params.thermometerDivision)} °C` },
        { label: 'Температура термостатирования', value: `${formatNumber(params.incubationTemperature)} °C` },
        { label: 'Коэффициент охвата k', value: formatNumber(params.coverageFactor) },
        { label: 'Используемый объем инокулята m', value: `${formatNumber(params.inoculumVolume)} см³` },
        { label: 'Используемый результат КМАФАнМ', value: `${params.formattedKmafanm} КОЕ/г или КОЕ/см³` },
      ],
      tables: [
        {
          title: '2.1 Контрольные измерения дозирования оператором',
          note: 'Неопределенность оператора оценивается по типу A на основании серии контрольных пипетирований. Такой подход позволяет учесть случайную составляющую, связанную с воспроизводимостью действий специалиста.',
          columns: ['Номер измерения', 'Значение mi', 'Среднее значение'],
          widths: ['24%', '38%', '38%'],
          rows: controlMeasurements.map((measurement, index) => [
            String(index + 1),
            `${formatNumber(measurement)} мл`,
            index === 0 ? `${formatNumber(controlAverage)} мл` : '',
          ]),
        },
        {
          title: '2.2 Бюджет неопределенности',
          note: 'На данном этапе определяются основные факторы, влияющие на достоверность результата. Для метода КМАФАнМ существенными являются неопределенность дозирования, повторяемость действий оператора и стабильность температурного режима при инкубировании.',
          columns: [
            'Величина',
            'Единица измерения',
            'Источник неопределенности',
            'Тип оценки',
            'Распределение вероятностей',
            'Стандартная неопределенность',
            'Степень свободы',
          ],
          widths: ['10%', '12%', '24%', '10%', '16%', '18%', '10%'],
          rows: uncertaintyBudgetRows,
        },
      ],
      items: [
        `2.3 Среднее значение контрольных измерений: mср = (${controlMeasurements.map(formatNumber).join(' + ')}) / 10 = ${formatNumber(controlAverage)} мл`,
        `2.4 Стандартное отклонение контрольных измерений: s = √(Σ(mi - mср)² / (n - 1)) = ${formatNumber(controlStandardDeviation)} мл`,
        `2.5 Стандартная неопределенность оператора: u2 = ${formatNumber(params.operatorUncertainty)} мл`,
        'Неопределенность пипетки относится к оценке типа B, так как определяется на основании метрологических характеристик средства измерения. При прямоугольном распределении стандартная неопределенность рассчитывается делением полуширины интервала на √3.',
        `u1 = (${formatNumber(params.pipetteDivision)} / 2) / √3 = ${formatNumber(params.pipetteUncertainty)} мл`,
        'Неопределенность оператора оценивается по типу A на основании серии контрольных пипетирований. Такой подход позволяет учесть случайную составляющую, связанную с воспроизводимостью действий специалиста.',
        `u2 = ${formatNumber(params.operatorUncertainty)} мл`,
        `uM = √(${formatNumber(params.pipetteUncertainty)}² + ${formatNumber(params.operatorUncertainty)}²) = ${formatNumber(params.combinedVolumeUncertainty)} мл`,
        'Температурный режим термостатирования влияет на условия роста микроорганизмов. Поэтому неопределенность термометра включается в общий бюджет неопределенности.',
        `uT = ${formatNumber(params.thermometerDivision)} / √3 = ${formatNumber(params.thermometerUncertainty)} °C`,
        'Суммарная стандартная неопределенность рассчитывается путем объединения независимых составляющих неопределенности. Поскольку входные величины не рассматриваются как коррелированные, используется корень из суммы квадратов относительных составляющих.',
        `us = √((${formatNumber(params.combinedVolumeUncertainty)} / ${formatNumber(params.inoculumVolume)})² + (${formatNumber(params.thermometerUncertainty)} / ${formatNumber(params.incubationTemperature)})²) = ${formatNumber(params.relativeStandardUncertainty)}`,
        `U = ${formatNumber(params.relativeStandardUncertainty)} × ${formatNumber(params.coverageFactor)} = ${formatNumber(params.expandedUncertainty)}`,
        'Расширенная неопределенность позволяет представить интервал, в котором с заданной вероятностью находится истинное значение результата. В расчете применяется коэффициент охвата k = 2, соответствующий уровню доверия приблизительно 95%.',
        `U_percent = ${formatNumber(params.expandedUncertainty)} × 100 = ${params.formattedUncertaintyPercent} %`,
      ],
      result: `Расширенная неопределенность: ± ${params.formattedUncertaintyPercent} %`,
      explanation: 'Неопределенность рассчитана отдельно от основного результата по внутреннему документу метода определения КМАФАнМ.',
    },
    {
      title: 'Анализ результата',
      rows: analysis.rows,
      items: analysis.messages,
      result: analysis.summary,
      explanation: analysis.interpretation,
    },
  ];
}

function createInvalidKmafanmSections(validationErrors: string[]) {
  return [
    {
      title: 'Основной расчет',
      formula: 'C = (C1 + C2) / 2; M = (N / m) × C',
      legend: getKmafanmMainLegend(),
      items: validationErrors,
      result: 'Расчет не выполнен',
      explanation: 'Заполните обязательные поля основного расчета корректными значениями.',
    },
    {
      title: 'Расчет неопределенности',
      formula: 'u1 = (цена деления пипетки / 2) / √3; uM = √(u1² + u2²); uT = цена деления термометра / √3; us = √((uM / m)² + (uT / T)²); U = us × k',
      legend: getKmafanmUncertaintyLegend(),
      items: validationErrors,
      result: 'Расчет не выполнен',
      explanation: 'Расчет неопределенности доступен после корректного выполнения основного расчета.',
    },
    {
      title: 'Анализ результата',
      items: validationErrors,
      result: 'Анализ не выполнен',
      explanation: 'Анализ выполняется после ввода количества колоний на двух чашках Петри.',
    },
  ];
}

function createKmafanmControlMeasurements(targetVolume: number, operatorUncertainty: number) {
  const step = operatorUncertainty || targetVolume * 0.001;
  const offsets = [-2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2, -0.75, 0.75];
  return offsets.map((offset) => Math.max(0, targetVolume + offset * step));
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleStandardDeviation(values: number[], mean: number) {
  if (values.length < 2) {
    return 0;
  }

  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function createKmafanmUncertaintyBudgetRows(params: KmafanmSectionParams, controlStandardDeviation: number) {
  return [
    [
      'u1',
      'мл',
      'Цена деления пипетки',
      'B',
      'Прямоугольное',
      `${formatNumber(params.pipetteUncertainty)} мл`,
      '∞',
    ],
    [
      'u2',
      'мл',
      `Контрольные дозирования оператора; s = ${formatNumber(controlStandardDeviation)} мл`,
      'A',
      'Нормальное',
      `${formatNumber(params.operatorUncertainty)} мл`,
      '9',
    ],
    [
      'uM',
      'мл',
      'Суммарная неопределенность объема инокулята',
      'A+B',
      'Комбинированное',
      `${formatNumber(params.combinedVolumeUncertainty)} мл`,
      'эфф.',
    ],
    [
      'uT',
      '°C',
      'Цена деления термометра',
      'B',
      'Прямоугольное',
      `${formatNumber(params.thermometerUncertainty)} °C`,
      '∞',
    ],
    [
      'us',
      'отн. ед.',
      'Относительная суммарная стандартная неопределенность',
      'A+B',
      'Комбинированное',
      formatNumber(params.relativeStandardUncertainty),
      'эфф.',
    ],
    [
      'U',
      '%',
      `Расширенная неопределенность при k = ${formatNumber(params.coverageFactor)}`,
      'расчет',
      'Нормальное',
      `± ${params.formattedUncertaintyPercent} %`,
      '-',
    ],
  ];
}

function analyzeKmafanmDilutions(dilutions: KmafanmDilutionSummary[], selectedDilution: KmafanmDilutionSummary) {
  const messages: string[] = [];
  const selectedDifference = Math.abs(selectedDilution.colonies1 - selectedDilution.colonies2);
  const selectedRelativeDifference = selectedDilution.average > 0 ? selectedDifference / selectedDilution.average : 0;

  dilutions.forEach((dilution) => {
    messages.push(`${dilution.dilution}: ${dilution.status}; среднее количество колоний ${formatNumber(dilution.average)}.`);
  });

  if (selectedDilution.status === 'Допустимый диапазон') {
    messages.push(`Для расчета выбрано разведение ${selectedDilution.dilution}, так как количество колоний соответствует допустимому диапазону учета.`);
  }

  if (dilutions.some((dilution) => dilution.status === 'Ниже допустимого диапазона')) {
    messages.push('Предупреждение: количество колоний слишком низкое для уверенного подсчета.');
  }

  if (dilutions.some((dilution) => dilution.status === 'Выше допустимого диапазона')) {
    messages.push('Предупреждение: количество колоний слишком высокое, рекомендуется проверить выбранное разведение.');
  }

  const consistencyWarnings = dilutions
    .map((dilution) => dilution.consistencyWarning)
    .filter(Boolean) as string[];

  if (consistencyWarnings.length > 0) {
    messages.push(
      'Нарушена логика последовательных разведений: при увеличении разведения количество колоний должно уменьшаться. Проверьте введенные данные.',
    );
    messages.push(...consistencyWarnings);
  }

  if (selectedRelativeDifference > 0.2) {
    messages.push('Предупреждение: разница между чашкой 1 и чашкой 2 превышает 20 %, рекомендуется проверить параллельные определения.');
  }

  const hasWarning =
    messages.some((message) => message.startsWith('Предупреждение')) ||
    messages.some((message) => message.startsWith('Нарушена логика')) ||
    consistencyWarnings.length > 0;
  const interpretation = hasWarning
    ? 'Рекомендуется проверить выбранное разведение, так как количество колоний или расхождение параллельных определений требует внимания.'
    : 'Результат пригоден для дальнейшего оформления: количество колоний находится в допустимом диапазоне, расхождение параллельных чашек не является значительным.';

  return {
    rows: [
      { label: 'Допустимый диапазон подсчета', value: '15-300 колоний' },
      { label: 'Выбранное разведение', value: selectedDilution.dilution },
      { label: 'Статус выбранного разведения', value: selectedDilution.status },
      { label: 'Среднее выбранного разведения', value: formatNumber(selectedDilution.average) },
      { label: 'Абсолютное расхождение выбранного разведения', value: formatNumber(selectedDifference) },
      { label: 'Относительное расхождение выбранного разведения', value: `${formatNumber(selectedRelativeDifference * 100)} %` },
    ],
    messages,
    summary: hasWarning ? 'Требуется проверка условий подсчета' : 'Подсчет находится в допустимых условиях',
    interpretation,
  };
}

function getSelectedDilutionReason(selectedDilution: KmafanmDilutionSummary) {
  if (selectedDilution.status === 'Допустимый диапазон') {
    return `Для расчета выбрано разведение ${selectedDilution.dilution}, так как количество колоний соответствует допустимому диапазону учета.`;
  }

  return `Для расчета выбрано разведение ${selectedDilution.dilution} как наиболее пригодное из введенных, однако его статус: ${selectedDilution.status}. Рекомендуется проверить выбранный ряд разведений.`;
}

function calculateHardness(input: CalculationInput): CalculationResult {
  const ctr = parsePositiveNumber(input.values.ctr, 'Cтр');
  const f = parsePositiveNumber(input.values.f, 'F');
  const vCorrection = parsePositiveNumber(input.values.v, 'V');
  const vtr1 = parsePositiveNumber(input.values.vtr1, 'Vтр1');
  const vtr2 = parsePositiveNumber(input.values.vtr2, 'Vтр2');
  const vSample = parsePositiveNumber(input.values.vpr, 'Vпр');

  const validationErrors = [
    validateRequired(input.sampleNumber, 'Укажите номер образца.'),
    validateRequired(input.sampleDate, 'Укажите дату расчета.'),
    validateRequired(input.specialist, 'Укажите специалиста.'),
    ctr.error,
    f.error,
    vCorrection.error,
    vtr1.error,
    vtr2.error,
    vSample.error,
  ].filter(Boolean) as string[];

  const formula = 'Ж = (M × F × K × Vтр) / Vпр; M = 2 × Cтр; K = 10 / V';

  if (
    validationErrors.length > 0 ||
    ctr.value === null ||
    f.value === null ||
    vCorrection.value === null ||
    vtr1.value === null ||
    vtr2.value === null ||
    vSample.value === null
  ) {
    return {
      method: hardnessMethod,
      formula,
      legend: getHardnessLegend(),
      substitution: 'Подстановка значений будет сформирована после корректного заполнения всех обязательных полей.',
      intermediate: validationErrors,
      result: 'Расчет не выполнен',
      finalResult: 'Расчет не выполнен',
      explanation: 'Проверьте входные данные. Все числовые поля должны быть заполнены положительными значениями; V и Vпр не могут быть равны нулю.',
      reportSections: createInvalidHardnessSections(validationErrors),
      validationErrors,
      isValid: false,
    };
  }

  const m = 2 * ctr.value;
  const k = 10 / vCorrection.value;
  const hardness1 = (m * f.value * k * vtr1.value) / vSample.value;
  const hardness2 = (m * f.value * k * vtr2.value) / vSample.value;
  const average = (hardness1 + hardness2) / 2;
  const formattedResult = `${formatNumber(average)} °Ж`;

  return {
    method: hardnessMethod,
    formula,
    legend: getHardnessLegend(),
    substitution: [
      `M = 2 × ${formatNumber(ctr.value)}`,
      `K = 10 / ${formatNumber(vCorrection.value)}`,
      `Ж1 = (${formatNumber(m)} × ${formatNumber(f.value)} × ${formatNumber(k)} × ${formatNumber(vtr1.value)}) / ${formatNumber(vSample.value)}`,
      `Ж2 = (${formatNumber(m)} × ${formatNumber(f.value)} × ${formatNumber(k)} × ${formatNumber(vtr2.value)}) / ${formatNumber(vSample.value)}`,
      `Жср = (${formatNumber(hardness1)} + ${formatNumber(hardness2)}) / 2`,
    ].join('\n'),
    intermediate: [
      `Расчет M: M = 2 × Cтр = 2 × ${formatNumber(ctr.value)} = ${formatNumber(m)}`,
      `Расчет K: K = 10 / V = 10 / ${formatNumber(vCorrection.value)} = ${formatNumber(k)}`,
      `Расчет Ж1: Ж1 = (${formatNumber(m)} × ${formatNumber(f.value)} × ${formatNumber(k)} × ${formatNumber(vtr1.value)}) / ${formatNumber(vSample.value)} = ${formatNumber(hardness1)} °Ж`,
      `Расчет Ж2: Ж2 = (${formatNumber(m)} × ${formatNumber(f.value)} × ${formatNumber(k)} × ${formatNumber(vtr2.value)}) / ${formatNumber(vSample.value)} = ${formatNumber(hardness2)} °Ж`,
      `Среднеарифметическое значение: Жср = (${formatNumber(hardness1)} + ${formatNumber(hardness2)}) / 2 = ${formattedResult}`,
    ],
    result: formattedResult,
    finalResult: `Жесткость воды: ${formattedResult}`,
    explanation:
      'Расчет жесткости воды выполнен автоматически согласно ГОСТ 31954-2012, раздел 4, комплексонометрический метод (Метод А). За результат принимается среднеарифметическое значение двух параллельных определений.',
    reportSections: createHardnessSections({
      input,
      ctr: ctr.value,
      f: f.value,
      vCorrection: vCorrection.value,
      vtr1: vtr1.value,
      vtr2: vtr2.value,
      vSample: vSample.value,
      m,
      k,
      hardness1,
      hardness2,
      average,
      formattedResult,
    }),
    validationErrors: [],
    isValid: true,
  };
}

interface HardnessSectionParams {
  input: CalculationInput;
  ctr: number;
  f: number;
  vCorrection: number;
  vtr1: number;
  vtr2: number;
  vSample: number;
  m: number;
  k: number;
  hardness1: number;
  hardness2: number;
  average: number;
  formattedResult: string;
}

function createHardnessSections(params: HardnessSectionParams) {
  const analysis = analyzeHardnessParallelDeterminations(params.hardness1, params.hardness2);
  const uncertainty = calculateHardnessUncertainty(params.input, params.average);

  return [
    {
      title: 'Основной расчет',
      formula: 'Ж = (M × F × K × Vтр) / Vпр; M = 2 × Cтр; K = 10 / V',
      legend: getHardnessLegend(),
      rows: [
        { label: 'Cтр — концентрация раствора трилона Б', value: `${formatNumber(params.ctr)} ммоль/дм³` },
        { label: 'F — множитель разбавления', value: formatNumber(params.f) },
        { label: 'V — объем трилона Б при установлении поправочного коэффициента', value: `${formatNumber(params.vCorrection)} см³` },
        { label: 'Vтр1 — объем трилона Б, определение 1', value: `${formatNumber(params.vtr1)} см³` },
        { label: 'Vтр2 — объем трилона Б, определение 2', value: `${formatNumber(params.vtr2)} см³` },
        { label: 'Vпр — объем пробы воды', value: `${formatNumber(params.vSample)} см³` },
      ],
      items: [
        `Расчет M: M = 2 × Cтр = 2 × ${formatNumber(params.ctr)} = ${formatNumber(params.m)}`,
        `Расчет K: K = 10 / V = 10 / ${formatNumber(params.vCorrection)} = ${formatNumber(params.k)}`,
        `Расчет Ж1: Ж1 = (${formatNumber(params.m)} × ${formatNumber(params.f)} × ${formatNumber(params.k)} × ${formatNumber(params.vtr1)}) / ${formatNumber(params.vSample)} = ${formatNumber(params.hardness1)} °Ж`,
        `Расчет Ж2: Ж2 = (${formatNumber(params.m)} × ${formatNumber(params.f)} × ${formatNumber(params.k)} × ${formatNumber(params.vtr2)}) / ${formatNumber(params.vSample)} = ${formatNumber(params.hardness2)} °Ж`,
        `Среднеарифметическое значение: Жср = (${formatNumber(params.hardness1)} + ${formatNumber(params.hardness2)}) / 2 = ${params.formattedResult}`,
      ],
      result: `Жесткость воды: ${params.formattedResult}`,
      explanation:
        'Расчет жесткости воды выполнен автоматически согласно ГОСТ 31954-2012, раздел 4, комплексонометрический метод (Метод А). За результат принимается среднеарифметическое значение двух параллельных определений.',
    },
    createHardnessUncertaintySection(uncertainty),
    {
      title: 'Анализ',
      rows: analysis.rows,
      items: analysis.items,
      result: analysis.status,
      explanation: analysis.interpretation,
    },
  ];
}

function createInvalidHardnessSections(validationErrors: string[]) {
  const uncertainty = calculateHardnessUncertainty(
    {
      sampleNumber: '',
      sampleDate: '',
      specialist: '',
      values: {},
    },
    1.6,
  );

  return [
    {
      title: 'Основной расчет',
      formula: 'Ж = (M × F × K × Vтр) / Vпр; M = 2 × Cтр; K = 10 / V',
      legend: getHardnessLegend(),
      items: validationErrors,
      result: 'Расчет не выполнен',
      explanation: 'Заполните обязательные поля основного расчета корректными положительными значениями.',
    },
    createHardnessUncertaintySection(uncertainty),
    {
      title: 'Анализ',
      items: validationErrors,
      result: 'Анализ не выполнен',
      explanation: 'Анализ параллельных определений доступен после корректного выполнения основного расчета.',
    },
  ];
}

interface HardnessUncertaintyComponent {
  code: string;
  label: string;
  unit: string;
  value: number;
  interval: number;
  type: string;
  distribution: string;
  standardUncertainty: number;
  degreesOfFreedom: string;
  sensitivity: number;
  contribution: number;
  percentContribution: number;
  source: string;
}

interface HardnessObservationSummary {
  label: string;
  value: string;
  numericValue: number | null;
}

interface HardnessUncertaintyResult {
  object: string;
  task: string;
  method: string;
  normativeDocument: string;
  methodDescription: string;
  equipment: string;
  conditions: string;
  observationRows: HardnessObservationSummary[];
  observations: number[];
  observationAverage: number;
  observationStandardDeviation: number;
  typeAUncertainty: number;
  typeBUncertainty: number;
  combinedUncertainty: number;
  coverageFactor: number;
  confidenceLevel: number;
  expandedUncertainty: number;
  expandedAbsolute: number;
  finalText: string;
  components: HardnessUncertaintyComponent[];
}

function createHardnessUncertaintySection(uncertainty: HardnessUncertaintyResult) {
  return {
    title: 'Неопределенность',
    notes: [
      'Настоящий расчет выполнен для оценки неопределенности результата определения общей жесткости воды комплексонометрическим методом. В расчет включены случайные и систематические составляющие, влияющие на итоговый результат титрования.',
    ],
    formula: 'Ж = (M × F × K × Vтр.б.) / Vпр',
    formulas: [
      'Y = f(X1, X2, X3, ...)',
      'Ж = (M × F × K × Vтр.б.) / Vпр',
      'uA = s / Xср',
      'u = a / √6 для треугольного распределения',
      'u = a / √3 для прямоугольного распределения',
      'uB = √(u²бюр + u²пип + u²мк + u²цил + u²весы + u²трБ)',
      'uc = √(uA² + uB²)',
      'U = k × uc',
    ],
    legend: [
      'M — коэффициент пересчета',
      'F — множитель разбавления',
      'K — коэффициент поправки',
      'Vтр.б. — объем трилона Б',
      'Vпр — объем пробы',
      'uA — стандартная неопределенность по типу A',
      'uB — суммарная стандартная неопределенность по типу B',
      'uc — стандартная суммарная неопределенность',
      'U — расширенная неопределенность',
    ],
    rows: [
      { label: 'Объект измерения', value: uncertainty.object },
      { label: 'Измерительная задача', value: uncertainty.task },
      { label: 'Метод измерения', value: uncertainty.method },
      { label: 'Нормативный документ', value: uncertainty.normativeDocument },
      { label: 'Описание метода', value: uncertainty.methodDescription },
      { label: 'Средства измерения и оборудование', value: uncertainty.equipment },
      { label: 'Условия проведения испытаний', value: uncertainty.conditions },
      { label: 'Корреляции', value: 'Ни одна из входных величин не рассматривается коррелированной друг от друга в значительной степени.' },
      { label: 'Коэффициенты чувствительности', value: 'Коэффициенты чувствительности приняты равными 1 для относительных вкладов входных величин.' },
    ],
    tables: [
      {
        title: '4. Результаты наблюдений',
        note: 'Результаты параллельных определений используются для оценки повторяемости метода и случайной составляющей неопределенности по типу A.',
        columns: ['№', 'Значение жесткости, °Ж'],
        widths: ['28%', '72%'],
        rows: uncertainty.observationRows.map((row, index) => [
          row.label || `Определение ${index + 1}`,
          row.numericValue === null ? (row.value || 'Не указано') : formatNumber(row.numericValue),
        ]),
      },
      {
        title: '5. Источники неопределенности',
        note: 'Источниками неопределенности являются средства измерений и операции, используемые при выполнении анализа: бюретка, пипетка, мерная колба, мерный цилиндр, раствор трилона Б, весы и действия оператора.',
        columns: ['Величина', 'Источник неопределенности', 'Тип оценки', 'Распределение вероятностей'],
        widths: ['20%', '42%', '14%', '24%'],
        rows: [
          ['Оператор', 'Повторяемость результатов наблюдений', 'A', 'Нормальное'],
          ['Пипетка', 'Предел допускаемой погрешности пипетки', 'B', 'Треугольное'],
          ['Мерная колба', 'Предел допускаемой погрешности мерной колбы', 'B', 'Треугольное'],
          ['Бюретка', 'Предел допускаемой погрешности бюретки', 'B', 'Треугольное'],
          ['Цилиндр мерный', 'Предел допускаемой погрешности цилиндра', 'B', 'Треугольное'],
          ['Раствор Трилона Б', 'Погрешность приготовления/дозирования раствора', 'B', 'Треугольное'],
          ['Весы лабораторные', 'Предел допускаемой погрешности весов', 'B', 'Прямоугольное'],
        ],
      },
      {
        title: '13. Бюджет неопределенности',
        note: 'Бюджет неопределенности показывает вклад каждой составляющей в суммарную неопределенность результата и позволяет оценить наиболее значимые источники влияния.',
        columns: [
          'Величина',
          'Ед. изм.',
          'Значение',
          'Интервал ±',
          'Тип оценки',
          'Функция распределения',
          'Стандартная неопределенность',
          'Степень свободы',
          'Коэффициент чувствительности',
          'Вклад неопределенности',
          'Процентный вклад',
        ],
        widths: ['8%', '7%', '8%', '8%', '7%', '12%', '12%', '8%', '10%', '10%', '10%'],
        rows: uncertainty.components.map((component) => [
          component.label,
          component.unit,
          formatNumber(component.value),
          formatNumber(component.interval),
          component.type,
          component.distribution,
          formatNumber(component.standardUncertainty),
          component.degreesOfFreedom,
          formatNumber(component.sensitivity),
          formatNumber(component.contribution),
          `${formatNumber(component.percentContribution)} %`,
        ]),
      },
    ],
    items: [
      'Неопределенность по типу A рассчитывается статистически на основании результатов повторных наблюдений. Она отражает случайный разброс результатов измерений.',
      `8. Вычисление стандартной неопределенности по типу A: n = ${uncertainty.observations.length}; Xср = (${uncertainty.observations.map(formatNumber).join(' + ')}) / ${uncertainty.observations.length} = ${formatNumber(uncertainty.observationAverage)}`,
      `s = ${formatNumber(uncertainty.observationStandardDeviation)}; uA = s / Xср = ${formatNumber(uncertainty.observationStandardDeviation)} / ${formatNumber(uncertainty.observationAverage)} = ${formatNumber(uncertainty.typeAUncertainty)}`,
      'Неопределенность по типу B оценивается по известным метрологическим характеристикам средств измерений. Для объемной посуды применяется треугольное распределение, для весов — прямоугольное распределение.',
      ...uncertainty.components
        .filter((component) => component.type === 'B')
        .map((component) =>
          component.distribution === 'Прямоугольное'
            ? `${component.label}: u = a / √3 = ${formatNumber(component.interval)} / √3 = ${formatNumber(component.standardUncertainty)}`
            : `${component.label}: u = a / √6 = ${formatNumber(component.interval)} / √6 = ${formatNumber(component.standardUncertainty)}`,
        ),
      'Суммарная неопределенность по типу B формируется из относительных стандартных неопределенностей всех систематических источников.',
      `10. Суммарная неопределенность по типу B: uB = √(${uncertainty.components
        .filter((component) => component.type === 'B')
        .map((component) => `${formatNumber(component.standardUncertainty)}²`)
        .join(' + ')}) = ${formatNumber(uncertainty.typeBUncertainty)}`,
      'Суммарная стандартная неопределенность объединяет случайную составляющую типа A и систематическую составляющую типа B.',
      `11. Стандартная суммарная неопределенность: uc = √(${formatNumber(uncertainty.typeAUncertainty)}² + ${formatNumber(uncertainty.typeBUncertainty)}²) = ${formatNumber(uncertainty.combinedUncertainty)}`,
      'Расширенная неопределенность рассчитывается умножением суммарной стандартной неопределенности на коэффициент охвата k. При k = 2 результат соответствует доверительной вероятности около 95%.',
      `12. Расширенная неопределенность: U = k × uc = ${formatNumber(uncertainty.coverageFactor)} × ${formatNumber(uncertainty.combinedUncertainty)} = ${formatNumber(uncertainty.expandedUncertainty)}`,
      `Доверительная вероятность: P = ${formatNumber(uncertainty.confidenceLevel)}`,
      'Конечный результат представляется в виде значения жесткости с расширенной неопределенностью, что позволяет корректно интерпретировать результат измерения с учетом всех значимых источников неопределенности.',
      `14. Представление конечных результатов: ${uncertainty.finalText}`,
      '15. Расчет выполнил: специалист лаборатории',
      `Дата: ${new Intl.DateTimeFormat('ru-RU').format(new Date())}`,
    ],
    result: uncertainty.finalText,
    explanation: 'Отчет о неопределенности измеряемой величины сформирован для комплексонометрического метода определения жесткости по ГОСТ 31954-2012.',
  };
}

function parseHardnessUncertaintyObservations(values: Record<string, string>): HardnessObservationSummary[] {
  const defaultRows: HardnessObservationSummary[] = [
    { label: 'Определение 1', value: '1.55', numericValue: 1.55 },
    { label: 'Определение 2', value: '1.65', numericValue: 1.65 },
  ];

  const serialized = values.hardnessObservations;
  if (serialized) {
    try {
      const parsed = JSON.parse(serialized);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((row, index) => {
          const value = typeof row.value === 'string' ? row.value : String(row.value ?? '');
          const numericValue = parsePositiveObservationValue(value);

          return {
            label: typeof row.label === 'string' && row.label.trim() ? row.label : `Определение ${index + 1}`,
            value,
            numericValue,
          };
        });
      }
    } catch {
      // Older saved calculations can still be read from hardnessObs1-hardnessObs4.
    }
  }

  const legacyRows = ['hardnessObs1', 'hardnessObs2', 'hardnessObs3', 'hardnessObs4']
    .map((key, index) => {
      const value = values[key];
      return value
        ? {
            label: `Определение ${index + 1}`,
            value,
            numericValue: parsePositiveObservationValue(value),
          }
        : null;
    })
    .filter((row): row is HardnessObservationSummary => row !== null);

  return legacyRows.length >= 2 ? legacyRows : defaultRows;
}

function parsePositiveObservationValue(value: string) {
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function calculateHardnessUncertainty(input: CalculationInput, fallbackHardness: number): HardnessUncertaintyResult {
  const values = input.values;
  const observationRows = parseHardnessUncertaintyObservations(values);
  const observations = observationRows
    .map((row) => row.numericValue)
    .filter((value): value is number => value !== null && Number.isFinite(value) && value > 0);
  const calculationObservations = observations.length > 0 ? observations : [1.55, 1.65];
  const observationAverage = average(calculationObservations);
  const observationStandardDeviation = sampleStandardDeviation(calculationObservations, observationAverage);
  const typeAUncertainty = observationAverage > 0 ? observationStandardDeviation / observationAverage : 0;
  const coverageFactor = getNumberOrDefault(values.hardnessCoverageFactor, 2);
  const confidenceLevel = getNumberOrDefault(values.hardnessConfidenceLevel, 0.95);
  const referenceValue = observationAverage || fallbackHardness || 1;
  const intervals = {
    burette: getNumberOrDefault(values.hardnessBurette, 0.02),
    pipette: getNumberOrDefault(values.hardnessPipette, 0.5),
    flask: getNumberOrDefault(values.hardnessFlask, 0.3),
    cylinder: getNumberOrDefault(values.hardnessCylinder, 0.5),
    scales: getNumberOrDefault(values.hardnessScales, 0.5),
    trilon: getNumberOrDefault(values.hardnessTrilon, 0.3),
  };
  const typeBBase = [
    createTypeBComponent('uбюр', 'Бюретка', 'мл', intervals.burette, 'Треугольное', referenceValue),
    createTypeBComponent('uпип', 'Пипетка', 'мл', intervals.pipette, 'Треугольное', referenceValue),
    createTypeBComponent('uмк', 'Мерная колба', 'мл', intervals.flask, 'Треугольное', referenceValue),
    createTypeBComponent('uцил', 'Цилиндр мерный', 'мл', intervals.cylinder, 'Треугольное', referenceValue),
    createTypeBComponent('uвесы', 'Весы лабораторные', 'мг', intervals.scales, 'Прямоугольное', referenceValue),
    createTypeBComponent('uтрБ', 'Раствор Трилона Б', 'мл', intervals.trilon, 'Треугольное', referenceValue),
  ];
  const typeBUncertainty = Math.sqrt(typeBBase.reduce((sum, component) => sum + component.standardUncertainty ** 2, 0));
  const combinedUncertainty = Math.sqrt(typeAUncertainty ** 2 + typeBUncertainty ** 2);
  const expandedUncertainty = coverageFactor * combinedUncertainty;
  const expandedAbsolute = referenceValue * expandedUncertainty;
  const components = [
    {
      code: 'uA',
      label: 'Оператор',
      unit: 'отн. ед.',
      value: referenceValue,
      interval: observationStandardDeviation,
      type: 'A',
      distribution: 'Нормальное',
      standardUncertainty: typeAUncertainty,
      degreesOfFreedom: String(Math.max(calculationObservations.length - 1, 0)),
      sensitivity: 1,
      contribution: typeAUncertainty,
      percentContribution: 0,
      source: 'Повторяемость результатов наблюдений',
    },
    ...typeBBase,
  ];
  const contributionTotal = components.reduce((sum, component) => sum + component.contribution ** 2, 0) || 1;
  const componentsWithPercent = components.map((component) => ({
    ...component,
    percentContribution: (component.contribution ** 2 / contributionTotal) * 100,
  }));

  return {
    object: values.hardnessObject || 'Питьевая вода',
    task: values.hardnessTask || 'Оценка неопределенности измерения жесткости воды',
    method: values.hardnessMethod || 'Комплексонометрический',
    normativeDocument: values.hardnessNormativeDocument || 'ГОСТ 31954-2012',
    methodDescription:
      values.hardnessMethodDescription ||
      'Комплексонометрический метод основан на титровании пробы воды раствором трилона Б с последующим расчетом жесткости.',
    equipment:
      values.hardnessEquipment ||
      'Бюретка, пипетка, мерная колба, мерный цилиндр, лабораторные весы, титрованный раствор трилона Б.',
    conditions: values.hardnessConditions || 'Испытания проводят в лабораторных условиях при стабильной температуре и соблюдении требований методики.',
    observationRows,
    observations: calculationObservations,
    observationAverage,
    observationStandardDeviation,
    typeAUncertainty,
    typeBUncertainty,
    combinedUncertainty,
    coverageFactor,
    confidenceLevel,
    expandedUncertainty,
    expandedAbsolute,
    finalText: `${formatNumber(referenceValue)} ± ${formatNumber(expandedAbsolute)} Ж, при K=${formatNumber(coverageFactor)}, P=${formatNumber(confidenceLevel)}`,
    components: componentsWithPercent,
  };
}

function createTypeBComponent(
  code: string,
  label: string,
  unit: string,
  interval: number,
  distribution: 'Треугольное' | 'Прямоугольное',
  referenceValue: number,
): HardnessUncertaintyComponent {
  const absoluteStandard = distribution === 'Прямоугольное' ? interval / Math.sqrt(3) : interval / Math.sqrt(6);
  const standardUncertainty = referenceValue > 0 ? absoluteStandard / referenceValue : 0;

  return {
    code,
    label,
    unit,
    value: referenceValue,
    interval,
    type: 'B',
    distribution,
    standardUncertainty,
    degreesOfFreedom: '∞',
    sensitivity: 1,
    contribution: standardUncertainty,
    percentContribution: 0,
    source: `Интервал допускаемой погрешности ${label.toLowerCase()}`,
  };
}

function getNumberOrDefault(value: string | undefined, defaultValue: number) {
  const parsed = Number(value?.trim().replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

function analyzeHardnessParallelDeterminations(hardness1: number, hardness2: number) {
  const absoluteDifference = Math.abs(hardness1 - hardness2);
  const averageValue = (hardness1 + hardness2) / 2;
  const relativeDifference = averageValue > 0 ? (absoluteDifference / averageValue) * 100 : 0;
  const status =
    absoluteDifference === 0
      ? 'Параллельные определения совпадают'
      : 'Расхождение рассчитано; критерий приемлемости не задан в системе';

  return {
    rows: [
      { label: 'Ж1', value: `${formatNumber(hardness1)} °Ж` },
      { label: 'Ж2', value: `${formatNumber(hardness2)} °Ж` },
      { label: 'Абсолютное расхождение |Ж1 - Ж2|', value: `${formatNumber(absoluteDifference)} °Ж` },
      { label: 'Относительное расхождение', value: `${formatNumber(relativeDifference)} %` },
      { label: 'Статус проверки', value: status },
    ],
    items: [
      `Разница между параллельными определениями: |${formatNumber(hardness1)} - ${formatNumber(hardness2)}| = ${formatNumber(absoluteDifference)} °Ж`,
      `Относительное расхождение: (${formatNumber(absoluteDifference)} / ${formatNumber(averageValue)}) × 100 = ${formatNumber(relativeDifference)} %`,
      'Критерий приемлемости параллельных определений не задан в текущей конфигурации и должен оцениваться специалистом по утвержденной лабораторной методике.',
    ],
    status,
    interpretation:
      absoluteDifference === 0
        ? 'Параллельные определения дали одинаковый результат. Итоговое значение принято как среднеарифметическое.'
        : 'Параллельные определения сравнены автоматически. Используйте рассчитанное расхождение для экспертной проверки результата по действующим требованиям лаборатории.',
  };
}

function getHardnessDefaultValue(fieldId: string) {
  if (fieldId === 'ctr') {
    return '50';
  }

  if (fieldId === 'f') {
    return '1';
  }

  if (fieldId === 'vpr') {
    return '100';
  }

  return '';
}

function getHardnessLegend() {
  return [
    'Ж — жесткость воды, °Ж',
    'M — коэффициент пересчета',
    'F — множитель разбавления',
    'K — коэффициент поправки',
    'Vтр — объем раствора трилона Б, израсходованный на титрование',
    'Vпр — объем пробы воды',
    'Cтр — концентрация раствора трилона Б, ммоль/дм³',
    'V — объем раствора трилона Б при установлении коэффициента поправки',
    'Жср — среднеарифметическое значение двух параллельных определений',
  ];
}

function calculateNitrites(input: CalculationInput): CalculationResult {
  const k = parsePositiveNumber(input.values.k, 'K');
  const a = parseNonNegativeNumber(input.values.a, 'A');
  const vk = parsePositiveNumber(input.values.vk, 'Vk');
  const v = parsePositiveNumber(input.values.v, 'V');
  const dilutionValue = input.values.f ?? '';
  const parsedF = dilutionValue.trim() === '' ? { value: 1 } : parsePositiveNumber(dilutionValue, 'f');
  const f = parsedF.value;

  const validationErrors = [
    validateRequired(input.sampleNumber, 'Укажите номер образца.'),
    validateRequired(input.sampleDate, 'Укажите дату расчета.'),
    validateRequired(input.specialist, 'Укажите специалиста.'),
    k.error,
    a.error,
    vk.error,
    v.error,
    dilutionValue.trim() === '' ? undefined : parsedF.error,
  ].filter(Boolean) as string[];

  if (validationErrors.length > 0 || k.value === null || a.value === null || vk.value === null || v.value === null || f === null) {
    return {
      method: nitriteMethod,
      formula: 'C = (K × A × Vk × f) / V',
      legend: getNitriteLegend(),
      substitution: 'Подстановка значений будет сформирована после корректного заполнения всех обязательных полей.',
      intermediate: validationErrors,
      result: 'Расчет не выполнен',
      finalResult: 'Расчет не выполнен',
      explanation: 'Проверьте входные данные. Поля K, Vk, V и f должны быть больше нуля; поле A не может быть отрицательным.',
      reportSections: createInvalidNitriteSections(validationErrors, input),
      validationErrors,
      isValid: false,
    };
  }

  const concentration = (k.value * a.value * vk.value * f) / v.value;
  const formattedResult = `${formatNumber(concentration)} мг/дм³`;

  return {
    method: nitriteMethod,
    formula: 'C = (K × A × Vk × f) / V',
    legend: getNitriteLegend(),
    substitution: `C = (${formatNumber(k.value)} × ${formatNumber(a.value)} × ${formatNumber(vk.value)} × ${formatNumber(f)}) / ${formatNumber(v.value)}`,
    intermediate: [
      `K × A = ${formatNumber(k.value * a.value)}`,
      `K × A × Vk × f = ${formatNumber(k.value * a.value * vk.value * f)}`,
      `C = ${formatNumber(k.value * a.value * vk.value * f)} / ${formatNumber(v.value)}`,
    ],
    result: formattedResult,
    finalResult: `Массовая концентрация нитритов: ${formattedResult}`,
    explanation:
      'Расчет выполнен автоматически согласно ГОСТ 33045-2014, раздел 6, фотометрический метод определения содержания нитритов с использованием сульфаниловой кислоты (метод Б).',
    reportSections: createNitriteSections({
      input,
      k: k.value,
      a: a.value,
      vk: vk.value,
      v: v.value,
      f,
      concentration,
      formattedResult,
    }),
    validationErrors: [],
    isValid: true,
  };
}

interface NitriteSectionParams {
  input: CalculationInput;
  k: number;
  a: number;
  vk: number;
  v: number;
  f: number;
  concentration: number;
  formattedResult: string;
}

function createNitriteSections(params: NitriteSectionParams) {
  const numerator = params.k * params.a * params.vk * params.f;

  return [
    {
      title: 'Основной расчет',
      formula: 'C = (K × A × Vk × f) / V',
      formulas: [
        'C = (K × A × Vk × f) / V',
        `C = (${formatNumber(params.k)} × ${formatNumber(params.a)} × ${formatNumber(params.vk)} × ${formatNumber(params.f)}) / ${formatNumber(params.v)}`,
      ],
      legend: getNitriteLegend(),
      rows: [
        { label: 'Номер образца', value: params.input.sampleNumber || 'Не указан' },
        { label: 'Дата', value: params.input.sampleDate || 'Не указана' },
        { label: 'Специалист', value: params.input.specialist || 'Не указан' },
        { label: 'ГОСТ / Методика', value: nitriteMethod },
      ],
      tables: [
        {
          title: 'Исходные данные',
          columns: ['Показатель', 'Значение'],
          widths: ['55%', '45%'],
          rows: [
            ['K — коэффициент градуировочной характеристики', formatNumber(params.k)],
            ['A — оптическая плотность пробы минус холостая проба', formatNumber(params.a)],
            ['Vk — вместимость мерной колбы', formatNumber(params.vk)],
            ['V — объем аликвоты пробы', formatNumber(params.v)],
            ['f — коэффициент разбавления', formatNumber(params.f)],
          ],
        },
      ],
      items: [
        `K × A = ${formatNumber(params.k)} × ${formatNumber(params.a)} = ${formatNumber(params.k * params.a)}`,
        `K × A × Vk × f = ${formatNumber(params.k * params.a)} × ${formatNumber(params.vk)} × ${formatNumber(params.f)} = ${formatNumber(numerator)}`,
        `C = ${formatNumber(numerator)} / ${formatNumber(params.v)} = ${params.formattedResult}`,
      ],
      result: `Массовая концентрация нитритов: ${params.formattedResult}`,
      explanation:
        'Расчет выполнен фотометрическим методом с использованием сульфаниловой кислоты согласно ГОСТ 33045-2014, раздел 6, метод Б. Итоговый результат основан на градуировочной характеристике и введенных параметрах пробы.',
    },
    createNitriteUncertaintySection(params.input, params.concentration),
    {
      title: 'Анализ',
      rows: [
        { label: 'Метод определения', value: 'Фотометрический метод с сульфаниловой кислотой' },
        { label: 'Основа расчета', value: 'Градуировочная характеристика и оптическая плотность пробы' },
        { label: 'Статус валидации', value: 'Расчет выполнен при корректно заполненных положительных входных данных' },
        { label: 'Итоговый результат', value: params.formattedResult },
      ],
      items: [
        'Расчет выполнен фотометрическим методом согласно выбранной методике.',
        'Результат основан на коэффициенте градуировочной характеристики и измеренной оптической плотности пробы.',
        'Специалисту рекомендуется проверить корректность градуировочной характеристики, холостой пробы и примененного коэффициента разбавления.',
      ],
      result: `Нитриты: ${params.formattedResult}`,
      explanation:
        'Полученный результат следует интерпретировать с учетом примененной методики, состояния градуировочной зависимости и лабораторных требований к контролю качества измерений.',
    },
  ];
}

interface NitriteObservationSummary {
  id: string;
  value: string;
  numericValue: number | null;
}

interface NitriteUncertaintyComponent {
  label: string;
  unit: string;
  value: string;
  interval: number;
  type: 'B';
  distribution: 'Прямоугольное' | 'Треугольное';
  standardUncertainty: number;
  degreesOfFreedom: string;
  sensitivity: number;
  contribution: number;
  percentContribution: number;
}

function createNitriteUncertaintySection(input: CalculationInput, fallbackConcentration: number | null) {
  const uncertainty = calculateNitriteUncertainty(input, fallbackConcentration);

  return {
    title: 'Неопределенность',
    notes: [
      'Отчет о неопределенности измеряемой величины сформирован для показателя «Нитрит-ионы» по ГОСТ 33045-2014. Расчет учитывает основные составляющие неопределенности фотометрического определения: спектрофотометрический канал КФК-3, аттестованное значение ГСО и вместимость мерной колбы 200 мл.',
      'Входные величины рассматриваются как независимые. Коэффициенты чувствительности для составляющих бюджета приняты равными 1, поскольку расчет выполняется в относительной модели вклада источников неопределенности.',
    ],
    formula: 'Y = f(X1, X2, X3...)',
    formulas: [
      'Y = f(X1, X2, X3...)',
      'Y = f(КФК, VК200, ГСО, Оператор)',
      'Xср = ΣXi / n',
      'u(КФК) = a / √3',
      'u(ГСО) = a / √3',
      'u(Колба) = a / √6',
      'uc = √(u²КФК + u²ГСО + u²Колба)',
      'U = uc × k',
    ],
    legend: [
      'Y — результат измерения массовой концентрации нитрит-ионов',
      'Xi — отдельный результат наблюдения, мг/дм³',
      'Xср — среднее арифметическое значение наблюдений',
      'u — стандартная неопределенность входной величины',
      'uc — стандартная суммарная неопределенность',
      'U — расширенная неопределенность при коэффициенте охвата k = 2',
    ],
    rows: [
      { label: '1. Заголовок отчета', value: 'Отчет о неопределенности измеряемой величины' },
      { label: 'Показатель', value: 'Нитрит-ионы' },
      { label: '2. Объект измерения', value: uncertainty.object },
      { label: 'Измерительная задача', value: uncertainty.task },
      { label: 'Метод измерения', value: uncertainty.method },
      { label: 'Нормативный документ', value: uncertainty.normativeDocument },
      { label: 'Описание метода', value: uncertainty.methodDescription },
      { label: 'Температура', value: uncertainty.temperature },
      { label: 'Влажность', value: uncertainty.humidity },
      { label: '3. Модель измерения', value: 'Y = f(X1,X2,X3...); Y = f(КФК, VК200, ГСО, Оператор)' },
      { label: '6. Корреляции', value: 'Ни одна из входных величин не рассматривается коррелированной друг с другом в какой-либо значительной степени.' },
      { label: '7. Коэффициенты чувствительности', value: 'Коэффициенты чувствительности приняты равными 1 для всех составляющих бюджета.' },
    ],
    tables: [
      {
        title: '4. Результаты наблюдений',
        note: `Средняя концентрация: Xср = (${uncertainty.observations.map(formatNumber).join(' + ')}) / ${uncertainty.observations.length} = ${formatNumber(uncertainty.average)} мг/дм³.`,
        columns: ['№', 'Значение, мг/дм³'],
        widths: ['24%', '76%'],
        rows: uncertainty.observationRows.map((row, index) => [
          String(index + 1),
          row.numericValue === null ? (row.value || 'Не указано') : formatNumber(row.numericValue),
        ]),
      },
      {
        title: '5. Источники неопределенности',
        note: 'Составляющие выбраны согласно методике фотометрического определения нитрит-ионов и метрологическим характеристикам применяемых средств измерений.',
        columns: ['№', 'Источник неопределенности', 'Тип оценки', 'Распределение'],
        widths: ['8%', '48%', '16%', '28%'],
        rows: [
          ['1', 'КФК-3', 'B', 'Прямоугольное'],
          ['2', 'ГСО', 'B', 'Прямоугольное'],
          ['3', 'Мерная колба', 'B', 'Треугольное'],
        ],
      },
      {
        title: '13. Бюджет неопределенности',
        note: 'Бюджет неопределенности содержит значения входных величин, интервалы допускаемой погрешности, стандартные неопределенности и вклад каждой составляющей в суммарную неопределенность.',
        columns: [
          'Величина',
          'Ед. изм.',
          'Значение',
          'Интервал ±',
          'Тип оценки',
          'Функция распределения',
          'Стандартная неопределенность',
          'Степень свободы',
          'Коэффициент чувствительности',
          'Вклад неопределенности',
          'Процентный вклад',
        ],
        widths: ['9%', '7%', '9%', '8%', '7%', '12%', '12%', '8%', '10%', '9%', '9%'],
        rows: uncertainty.components.map((component) => [
          component.label,
          component.unit,
          component.value,
          formatNumber(component.interval),
          component.type,
          component.distribution,
          formatNumber(component.standardUncertainty),
          component.degreesOfFreedom,
          formatNumber(component.sensitivity),
          formatNumber(component.contribution),
          `${formatNumber(component.percentContribution)} %`,
        ]),
      },
    ],
    items: [
      '3. Модель измерения описывает зависимость результата от входных величин, влияющих на фотометрическое определение нитрит-ионов. В модели учитываются приборная составляющая КФК-3, вместимость мерной колбы VК200, аттестованное значение ГСО и вклад оператора при выполнении процедуры.',
      `4. Среднее значение наблюдений: Xср = (${uncertainty.observations.map(formatNumber).join(' + ')}) / ${uncertainty.observations.length} = ${formatNumber(uncertainty.average)} мг/дм³.`,
      '7. Коэффициенты чувствительности показывают, как изменение входной величины влияет на результат. Для настоящего расчета коэффициенты приняты равными 1.',
      `8. Неопределенность КФК-3: u = a / √3 = ${formatNumber(uncertainty.kfkError)} / √3 = ${formatNumber(uncertainty.kfkUncertainty)} нм. Прямоугольное распределение применено, поскольку известно только предельное значение погрешности прибора.`,
      `9. Неопределенность ГСО: u = a / √3 = ${formatNumber(uncertainty.gsoError)} / √3 = ${formatNumber(uncertainty.gsoUncertainty)} %. Прямоугольное распределение отражает равновероятное нахождение истинного значения внутри заданного интервала.`,
      `10. Неопределенность мерной колбы: u = a / √6 = ${formatNumber(uncertainty.flaskError)} / √6 = ${formatNumber(uncertainty.flaskUncertainty)} мл. Треугольное распределение принято для объемной меры, так как значения ближе к центру интервала более вероятны.`,
      `11. Стандартная суммарная неопределенность: uc = √(${formatNumber(uncertainty.kfkUncertainty)}² + ${formatNumber(uncertainty.gsoUncertainty)}² + ${formatNumber(uncertainty.flaskUncertainty)}²) = ${formatNumber(uncertainty.combinedUncertainty)}.`,
      `12. Расширенная неопределенность: U = uc × k = ${formatNumber(uncertainty.combinedUncertainty)} × ${formatNumber(uncertainty.coverageFactor)} = ${formatNumber(uncertainty.expandedUncertainty)}. Доверительная вероятность: P = ${formatNumber(uncertainty.confidenceLevel)} (95%).`,
      `14. Представление результата: (${formatNumber(uncertainty.average)} ± ${formatNumber(uncertainty.expandedUncertainty)}) мг/дм³, при K = ${formatNumber(uncertainty.coverageFactor)}, P = ${formatNumber(uncertainty.confidenceLevel)}.`,
      `15. Расчет выполнил: ${input.specialist || 'Специалист'}`,
      `Дата: ${formatReportDate(input.sampleDate)}`,
    ],
    result: uncertainty.finalText,
    explanation:
      'Профессиональный отчет включает исходные данные, модель измерения, результаты наблюдений, источники и бюджет неопределенности, расчет стандартной суммарной и расширенной неопределенности, а также представление итогового результата измерения нитрит-ионов.',
  };
}

function getNitriteUncertaintyDefaultValues(): Record<string, string> {
  return {
    nitriteObject: 'Бутилированная вода',
    nitriteTask: 'Определение нитрит-ионов в воде',
    nitriteMethod: 'Фотометрический',
    nitriteNormativeDocument: 'ГОСТ 33045-2014',
    nitriteMethodDescription:
      'Сущность метода заключается во взаимодействии нитритов в исследуемой пробе воды с сульфаниловой кислотой в присутствии 1-нафтиламина с образованием красно-фиолетового окрашенного соединения с последующим фотометрическим определением и расчетом массовой концентрации нитритов.',
    nitriteTemperature: '22 °C',
    nitriteHumidity: '69 %',
    nitriteObservations: JSON.stringify([
      { id: 'nitrite-observation-1', value: '0.021' },
      { id: 'nitrite-observation-2', value: '0.023' },
      { id: 'nitrite-observation-3', value: '0.022' },
      { id: 'nitrite-observation-4', value: '0.024' },
    ]),
    nitriteKfkError: '3',
    nitriteGsoError: '2',
    nitriteFlaskVolume: '200',
    nitriteFlaskError: '0.8',
    nitriteCoverageFactor: '2',
    nitriteConfidenceLevel: '0.95',
  };
}

function calculateNitriteUncertainty(input: CalculationInput, fallbackConcentration: number | null) {
  const values = { ...getNitriteUncertaintyDefaultValues(), ...input.values };
  const observationRows = parseNitriteUncertaintyObservations(values.nitriteObservations);
  const observations = observationRows
    .map((row) => row.numericValue)
    .filter((value): value is number => value !== null && value >= 0);
  const calculationObservations = observations.length >= 2 ? observations : [fallbackConcentration ?? 0.021, 0.023, 0.022, 0.024];
  const averageValue = average(calculationObservations);
  const kfkError = getNumberOrDefault(values.nitriteKfkError, 3);
  const gsoError = getNumberOrDefault(values.nitriteGsoError, 2);
  const flaskVolume = getNumberOrDefault(values.nitriteFlaskVolume, 200);
  const flaskError = getNumberOrDefault(values.nitriteFlaskError, 0.8);
  const coverageFactor = getNumberOrDefault(values.nitriteCoverageFactor, 2);
  const confidenceLevel = getNumberOrDefault(values.nitriteConfidenceLevel, 0.95);
  const kfkUncertainty = kfkError / Math.sqrt(3);
  const gsoUncertainty = gsoError / Math.sqrt(3);
  const flaskUncertainty = flaskError / Math.sqrt(6);
  const combinedUncertainty = Math.sqrt(kfkUncertainty ** 2 + gsoUncertainty ** 2 + flaskUncertainty ** 2);
  const expandedUncertainty = combinedUncertainty * coverageFactor;
  const componentsWithoutPercent: NitriteUncertaintyComponent[] = [
    {
      label: 'КФК-3',
      unit: 'нм',
      value: 'КФК-3',
      interval: kfkError,
      type: 'B',
      distribution: 'Прямоугольное',
      standardUncertainty: kfkUncertainty,
      degreesOfFreedom: '∞',
      sensitivity: 1,
      contribution: kfkUncertainty,
      percentContribution: 0,
    },
    {
      label: 'ГСО',
      unit: '%',
      value: 'ГСО нитрит-ионов',
      interval: gsoError,
      type: 'B',
      distribution: 'Прямоугольное',
      standardUncertainty: gsoUncertainty,
      degreesOfFreedom: '∞',
      sensitivity: 1,
      contribution: gsoUncertainty,
      percentContribution: 0,
    },
    {
      label: 'Мерная колба',
      unit: 'мл',
      value: formatNumber(flaskVolume),
      interval: flaskError,
      type: 'B',
      distribution: 'Треугольное',
      standardUncertainty: flaskUncertainty,
      degreesOfFreedom: '∞',
      sensitivity: 1,
      contribution: flaskUncertainty,
      percentContribution: 0,
    },
  ];
  const totalContribution = componentsWithoutPercent.reduce((sum, component) => sum + component.contribution ** 2, 0) || 1;
  const components = componentsWithoutPercent.map((component) => ({
    ...component,
    percentContribution: (component.contribution ** 2 / totalContribution) * 100,
  }));

  return {
    object: values.nitriteObject || 'Бутилированная вода',
    task: values.nitriteTask || 'Определение нитрит-ионов в воде',
    method: values.nitriteMethod || 'Фотометрический',
    normativeDocument: values.nitriteNormativeDocument || 'ГОСТ 33045-2014',
    methodDescription: values.nitriteMethodDescription || getNitriteUncertaintyDefaultValues().nitriteMethodDescription,
    temperature: values.nitriteTemperature || '22 °C',
    humidity: values.nitriteHumidity || '69 %',
    observationRows,
    observations: calculationObservations,
    average: averageValue,
    kfkError,
    gsoError,
    flaskVolume,
    flaskError,
    kfkUncertainty,
    gsoUncertainty,
    flaskUncertainty,
    combinedUncertainty,
    coverageFactor,
    confidenceLevel,
    expandedUncertainty,
    components,
    finalText: `(${formatNumber(averageValue)} ± ${formatNumber(expandedUncertainty)}) мг/дм³, при K = ${formatNumber(coverageFactor)}, P = ${formatNumber(confidenceLevel)}`,
  };
}

function parseNitriteUncertaintyObservations(value: string | undefined): NitriteObservationSummary[] {
  const defaultRows = [
    { id: 'nitrite-observation-1', value: '0.021' },
    { id: 'nitrite-observation-2', value: '0.023' },
    { id: 'nitrite-observation-3', value: '0.022' },
    { id: 'nitrite-observation-4', value: '0.024' },
  ];

  try {
    const parsed = value ? JSON.parse(value) : defaultRows;
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((row, index) => {
        const rawValue = typeof row.value === 'string' ? row.value : String(row.value ?? '');
        return {
          id: typeof row.id === 'string' ? row.id : `nitrite-observation-${index + 1}`,
          value: rawValue,
          numericValue: parseNitriteObservationValue(rawValue),
        };
      });
    }
  } catch {
    // Fall back to default observations.
  }

  return defaultRows.map((row) => ({ ...row, numericValue: parseNitriteObservationValue(row.value) }));
}

function parseNitriteObservationValue(value: string) {
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function formatReportDate(value: string) {
  if (!value) {
    return new Intl.DateTimeFormat('ru-RU').format(new Date());
  }

  return new Intl.DateTimeFormat('ru-RU').format(new Date(value));
}

function createInvalidNitriteSections(validationErrors: string[], input: CalculationInput) {
  return [
    {
      title: 'Основной расчет',
      formula: 'C = (K × A × Vk × f) / V',
      legend: getNitriteLegend(),
      items: validationErrors,
      result: 'Расчет не выполнен',
      explanation: 'Заполните обязательные поля корректными числовыми значениями, чтобы сформировать основной расчет нитритов.',
    },
    createNitriteUncertaintySection(input, null),
    {
      title: 'Анализ',
      items: validationErrors,
      result: 'Анализ не выполнен',
      explanation: 'Анализ результата доступен после корректного выполнения основного расчета.',
    },
  ];
}

function getNitriteLegend() {
  return [
    'C — массовая концентрация нитритов',
    'K — коэффициент градуировочной характеристики',
    'A — оптическая плотность пробы минус холостая проба',
    'Vk — вместимость мерной колбы',
    'V — объем аликвоты пробы',
    'f — коэффициент разбавления; если разбавление не используется, f = 1',
  ];
}

function validateRequired(value: string, message: string) {
  return value.trim() ? undefined : message;
}

function parsePositiveNumber(value: string, label: string): { value: number | null; error?: string } {
  const parsed = parseNumber(value);

  if (parsed === null) {
    return { value: null, error: `Введите числовое значение для поля ${label}.` };
  }

  if (parsed <= 0) {
    return { value: null, error: `Поле ${label} должно быть больше нуля.` };
  }

  return { value: parsed };
}

function parseNonNegativeNumber(value: string, label: string): { value: number | null; error?: string } {
  const parsed = parseNumber(value);

  if (parsed === null) {
    return { value: null, error: `Введите числовое значение для поля ${label}.` };
  }

  if (parsed < 0) {
    return { value: null, error: `Поле ${label} не может быть отрицательным.` };
  }

  return { value: parsed };
}

function parseNumber(value: string) {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 6,
  }).format(value);
}

function formatScientific(value: number) {
  if (value === 0) {
    return '0';
  }

  if (Math.abs(value) < 10000 && Math.abs(value) >= 0.01) {
    return formatNumber(value);
  }

  const exponent = Math.floor(Math.log10(Math.abs(value)));
  const mantissa = value / 10 ** exponent;
  return `${formatNumber(Number(mantissa.toFixed(2)))} × 10${toSuperscript(exponent)}`;
}

function toSuperscript(value: number) {
  const superscriptDigits: Record<string, string> = {
    '-': '⁻',
    '0': '⁰',
    '1': '¹',
    '2': '²',
    '3': '³',
    '4': '⁴',
    '5': '⁵',
    '6': '⁶',
    '7': '⁷',
    '8': '⁸',
    '9': '⁹',
  };

  return String(value)
    .split('')
    .map((char) => superscriptDigits[char] ?? char)
    .join('');
}
