import type { CalculationInput, CalculationReportSection, CalculationResult, IndicatorDefinition } from '../types';

interface GenerateCalculationPdfReportParams {
  laboratoryName: string;
  indicator: IndicatorDefinition;
  input: CalculationInput;
  result: CalculationResult;
}

export interface SamplePdfReportItem {
  indicatorName: string;
  result: string;
  uncertainty: string;
  method: string;
  inputRows: Array<{ label: string; value: string; unit?: string }>;
}

interface GenerateSamplePdfReportParams {
  sampleNumber: string;
  date: string;
  specialist: string;
  items: SamplePdfReportItem[];
}

export async function generateCalculationPdfReport({
  laboratoryName,
  indicator,
  input,
  result,
}: GenerateCalculationPdfReportParams) {
  const documentDefinition = createReportDocument({ laboratoryName, indicator, input, result });
  return downloadPdf(documentDefinition, 'lab-calculation-report.pdf');
}

export async function generateSamplePdfReport({
  sampleNumber,
  date,
  specialist,
  items,
}: GenerateSamplePdfReportParams) {
  const documentDefinition = createSampleReportDocument({ sampleNumber, date, specialist, items });
  return downloadPdf(documentDefinition, `sample-report-${sanitizeFileName(sampleNumber)}.pdf`);
}

function createReportDocument({
  laboratoryName,
  indicator,
  input,
  result,
}: GenerateCalculationPdfReportParams) {
  const documentDefinition = {
    pageSize: 'A4',
    pageMargins: [38, 42, 38, 50],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 10,
      color: '#172033',
      lineHeight: 1.18,
    },
    footer: (currentPage: number, pageCount: number) => ({
      margin: [40, 0, 40, 24],
      columns: [
        {
          text: 'Цифровая система автоматизации лабораторных расчетов',
          color: '#5f6f84',
          fontSize: 8,
        },
        {
          text: `${currentPage} / ${pageCount}`,
          alignment: 'right',
          color: '#5f6f84',
          fontSize: 8,
        },
      ],
    }),
    styles: {
      title: {
        fontSize: 20,
        bold: true,
        color: '#0f2f57',
        margin: [0, 0, 0, 4],
      },
      appName: {
        fontSize: 10,
        color: '#1f5f99',
        bold: true,
      },
      appSubtitle: {
        fontSize: 9,
        color: '#5f6f84',
        margin: [0, 3, 0, 0],
      },
      sectionHeader: {
        bold: true,
        color: '#ffffff',
        fillColor: '#0f2f57',
        margin: [0, 12, 0, 0],
      },
      subsectionHeader: {
        fontSize: 11,
        bold: true,
        color: '#0f2f57',
        margin: [0, 10, 0, 5],
      },
      formula: {
        fontSize: 14,
        bold: true,
        color: '#0f2f57',
        alignment: 'center',
        margin: [0, 6, 0, 6],
      },
      result: {
        fontSize: 13,
        bold: true,
        color: '#0f2f57',
      },
      muted: {
        color: '#5f6f84',
      },
    },
    content: [
      {
        stack: [
          { text: result.reportTitle || 'Отчет лабораторного расчета', style: 'title' },
          { text: 'Dynamic Laboratory Calculator', style: 'appName' },
          {
            text: 'Цифровая система автоматизации лабораторных расчетов',
            style: 'appSubtitle',
          },
        ],
        margin: [0, 0, 0, 18],
      },

      sectionTitle('Сведения о расчете'),
      {
        table: {
          widths: ['32%', '*'],
          body: [
            tableRow('Лаборатория', laboratoryName),
            tableRow('Показатель', indicator.name),
            tableRow('Номер образца', input.sampleNumber || 'Не указан'),
            tableRow('Дата', formatDate(input.sampleDate)),
            tableRow('Специалист', input.specialist || 'Не указан'),
            tableRow('ГОСТ / Методика', result.method || 'Не указано'),
          ],
        },
        layout: borderedLayout,
      },

      sectionTitle('Входные данные'),
      {
        table: {
          widths: ['45%', '25%', '*'],
          body: [
            [
              tableHeaderCell('Параметр'),
              tableHeaderCell('Значение'),
              tableHeaderCell('Единица'),
            ],
            ...indicator.fields.map((field) => [
              tableCell(field.label),
              tableCell(formatInputValue(input.values[field.id])),
              tableCell(field.unit || '-'),
            ]),
          ],
        },
        layout: borderedLayout,
      },

      ...createCalculationDetailContent(result),
    ],
  };

  return documentDefinition;
}

function createSampleReportDocument({
  sampleNumber,
  date,
  specialist,
  items,
}: GenerateSamplePdfReportParams) {
  const documentDefinition = {
    pageSize: 'A4',
    pageMargins: [38, 42, 38, 50],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 10,
      color: '#172033',
      lineHeight: 1.18,
    },
    footer: (currentPage: number, pageCount: number) => ({
      margin: [40, 0, 40, 24],
      columns: [
        {
          text: 'Цифровая система автоматизации лабораторных расчетов',
          color: '#5f6f84',
          fontSize: 8,
        },
        {
          text: `${currentPage} / ${pageCount}`,
          alignment: 'right',
          color: '#5f6f84',
          fontSize: 8,
        },
      ],
    }),
    styles: {
      title: {
        fontSize: 20,
        bold: true,
        color: '#0f2f57',
        margin: [0, 0, 0, 4],
      },
      appName: {
        fontSize: 10,
        color: '#1f5f99',
        bold: true,
      },
      appSubtitle: {
        fontSize: 9,
        color: '#5f6f84',
        margin: [0, 3, 0, 0],
      },
      sectionHeader: {
        bold: true,
        color: '#ffffff',
        fillColor: '#0f2f57',
        margin: [0, 12, 0, 0],
      },
      subsectionHeader: {
        fontSize: 11,
        bold: true,
        color: '#0f2f57',
        margin: [0, 10, 0, 5],
      },
      result: {
        fontSize: 12,
        bold: true,
        color: '#0f2f57',
      },
      muted: {
        color: '#5f6f84',
      },
    },
    content: [
      {
        stack: [
          { text: 'Сводный отчет по пробе', style: 'title' },
          { text: 'Dynamic Laboratory Calculator', style: 'appName' },
          {
            text: 'Цифровая система автоматизации лабораторных расчетов',
            style: 'appSubtitle',
          },
        ],
        margin: [0, 0, 0, 18],
      },

      sectionTitle('Сведения о пробе'),
      {
        table: {
          widths: ['32%', '*'],
          body: [
            tableRow('Номер пробы', sampleNumber || 'Не указан'),
            tableRow('Дата формирования', formatDate(date)),
            tableRow('Специалист', specialist || 'Не указан'),
          ],
        },
        layout: borderedLayout,
      },

      sectionTitle('Сводная таблица'),
      {
        table: {
          headerRows: 1,
          widths: ['24%', '25%', '20%', '*'],
          body: [
            ['Показатель', 'Результат', 'Неопределенность', 'Метод'].map(tableHeaderCell),
            ...items.map((item) => [
              tableCell(item.indicatorName),
              tableCell(item.result || 'Не указано'),
              tableCell(item.uncertainty || 'Не указано'),
              tableCell(item.method || 'Не указано'),
            ]),
          ],
        },
        layout: borderedLayout,
        margin: [0, 0, 0, 8],
      },

      ...items.flatMap((item, index) => createSampleAppendixContent(item, index + 1)),
    ],
  };

  return documentDefinition;
}

function createSampleAppendixContent(item: SamplePdfReportItem, sectionNumber: number) {
  const inputRows = item.inputRows.length
    ? item.inputRows
    : [{ label: 'Исходные данные', value: 'Не указаны' }];

  return [
    {
      ...sectionTitle(`Раздел ${sectionNumber}. ${item.indicatorName}`),
      pageBreak: sectionNumber === 1 ? undefined : 'before',
    },
    resultBox(item.result || 'Не указано'),
    { text: 'Основные входные данные', style: 'subsectionHeader' },
    {
      table: {
        widths: ['42%', '30%', '*'],
        body: [
          ['Параметр', 'Значение', 'Единица'].map(tableHeaderCell),
          ...inputRows.map((row) => [tableCell(row.label), tableCell(row.value || 'Не указано'), tableCell(row.unit || '-')]),
        ],
      },
      layout: borderedLayout,
      margin: [0, 4, 0, 8],
    },
    { text: 'Неопределенность', style: 'subsectionHeader' },
    resultBox(item.uncertainty || 'Не указано'),
  ];
}

function sectionTitle(text: string) {
  return {
    table: {
      widths: ['*'],
      body: [[{ text, style: 'sectionHeader', margin: [8, 5, 8, 5] }]],
    },
    layout: 'noBorders',
  };
}

function createCalculationDetailContent(result: CalculationResult) {
  if (result.reportSections?.length) {
    return result.reportSections.flatMap((section, index) => createReportSectionContent(section, index + 1));
  }

  return [
    sectionTitle('Формула'),
    { text: result.formula, style: 'formula' },

    sectionTitle('Расшифровка обозначений'),
    bulletList(result.legend?.length ? result.legend : ['Расшифровка обозначений не указана.']),

    sectionTitle('Подстановка значений'),
    { text: result.substitution || 'Подстановка значений не сформирована.', margin: [0, 8, 0, 0] },

    sectionTitle('Промежуточный расчет'),
    bulletList(result.intermediate.length ? result.intermediate : ['Промежуточный расчет не сформирован.']),

    sectionTitle('Итоговый результат'),
    resultBox(result.finalResult || result.result),

    sectionTitle('Пояснение'),
    { text: result.explanation, margin: [0, 8, 0, 0] },
  ];
}

function createReportSectionContent(section: CalculationReportSection, sectionNumber?: number) {
  const title = sectionNumber ? `${sectionNumber}. ${section.title}` : section.title;

  return [
    sectionTitle(title),
    ...(section.notes?.length ? section.notes.map(explanationBlock) : []),
    ...(section.formula ? [{ text: section.formula, style: 'formula' }] : []),
    ...(section.formulas?.length ? section.formulas.map(formulaBlock) : []),
    ...(section.legend?.length ? [bulletList(section.legend)] : []),
    ...(section.rows?.length ? [sectionRowsTable(section.rows)] : []),
    ...(section.tables?.length ? section.tables.flatMap(sectionDataTable) : []),
    ...(section.items?.length ? [bulletList(section.items)] : []),
    ...(section.result ? [resultBox(section.result)] : []),
    ...(section.explanation ? [{ text: section.explanation, margin: [0, 8, 0, 0] }] : []),
  ];
}

function formulaBlock(text: string) {
  return {
    table: {
      widths: ['*'],
      body: [[{ text, style: 'formula', margin: [10, 8, 10, 8] }]],
    },
    layout: {
      hLineColor: () => '#b8c7d8',
      vLineColor: () => '#b8c7d8',
      hLineWidth: () => 0.8,
      vLineWidth: () => 0.8,
      fillColor: () => '#f7fbff',
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
    margin: [0, 6, 0, 6],
  };
}

function explanationBlock(text: string) {
  return {
    text,
    margin: [0, 6, 0, 8],
    color: '#334155',
    lineHeight: 1.25,
  };
}

function bulletList(items: string[]) {
  return {
    ul: items.map((item) => ({
      text: item,
      margin: [0, 1, 0, 1],
    })),
  };
}

function sectionRowsTable(rows: Array<{ label: string; value: string }>) {
  return {
    table: {
      widths: ['42%', '*'],
      body: rows.map((row) => [tableHeaderCell(row.label), tableCell(row.value)]),
    },
    layout: borderedLayout,
    margin: [0, 8, 0, 0],
  };
}

function sectionDataTable(tableData: NonNullable<CalculationReportSection['tables']>[number]) {
  return [
    ...(tableData.title ? [{ text: tableData.title, style: 'subsectionHeader' }] : []),
    ...(tableData.note ? [explanationBlock(tableData.note)] : []),
    {
      table: {
        headerRows: 1,
        widths: tableData.widths ?? tableData.columns.map(() => '*'),
        body: [
          tableData.columns.map((column) => tableHeaderCell(column)),
          ...tableData.rows.map((row) => row.map((cell) => tableCell(cell))),
        ],
      },
      layout: borderedLayout,
      margin: [0, 6, 0, 8],
    },
  ];
}

function resultBox(text: string) {
  return {
    table: {
      widths: ['*'],
      body: [[{ text, style: 'result', margin: [8, 8, 8, 8] }]],
    },
    layout: borderedLayout,
  };
}

function tableRow(label: string, value: string) {
  return [tableHeaderCell(label), tableCell(value)];
}

function tableHeaderCell(text: string) {
  return {
    text,
    bold: true,
    fillColor: '#f4f7fa',
    color: '#172033',
    margin: [6, 5, 6, 5],
  };
}

function tableCell(text: string) {
  return {
    text,
    margin: [6, 5, 6, 5],
  };
}

const borderedLayout = {
  hLineColor: () => '#d9e2ec',
  vLineColor: () => '#d9e2ec',
  hLineWidth: () => 0.8,
  vLineWidth: () => 0.8,
  paddingLeft: () => 0,
  paddingRight: () => 0,
  paddingTop: () => 0,
  paddingBottom: () => 0,
};

async function downloadPdf(documentDefinition: unknown, fileName: string) {
  const [{ default: pdfMake }, { default: pdfFonts }] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);

  const fontVfs = getFontVirtualFileSystem(pdfFonts);

  if (pdfMake.addVirtualFileSystem) {
    pdfMake.addVirtualFileSystem(fontVfs);
  } else {
    pdfMake.vfs = fontVfs;
  }

  const blob = await createPdfBlob(pdfMake.createPdf(documentDefinition));
  await assertUsablePdfBlob(blob);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function getFontVirtualFileSystem(pdfFonts: Record<string, string> | { pdfMake?: { vfs?: Record<string, string> } }) {
  const possibleFontContainer = pdfFonts as { pdfMake?: { vfs?: Record<string, string> } };

  if (possibleFontContainer.pdfMake?.vfs) {
    return possibleFontContainer.pdfMake.vfs;
  }

  return pdfFonts as Record<string, string>;
}

function createPdfBlob(pdfDocument: { getBlob: (callback: (blob: Blob) => void) => void }) {
  return new Promise<Blob>((resolve, reject) => {
    try {
      pdfDocument.getBlob((blob) => resolve(blob));
    } catch (error) {
      reject(error);
    }
  });
}

async function assertUsablePdfBlob(blob: Blob) {
  if (!blob || blob.size < 1000) {
    throw new Error('PDF_EMPTY_OR_INVALID');
  }

  const signature = await blob.slice(0, 5).text();
  if (signature !== '%PDF-') {
    throw new Error('PDF_INVALID_SIGNATURE');
  }
}

function formatDate(value: string) {
  if (!value) {
    return 'Не указана';
  }

  return new Intl.DateTimeFormat('ru-RU').format(new Date(value));
}

function formatInputValue(value: string | undefined) {
  return value?.trim() ? value : 'Не указано';
}

function sanitizeFileName(value: string) {
  const normalized = value.trim().replace(/[\\/:*?"<>|]+/g, '-');
  return normalized || 'sample';
}
