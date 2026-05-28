# Sample-based combined reports

Status: planned, not implemented.

## Goal

Move from one report per calculation to a sample-centered workflow where one sample can contain several indicator calculations.

Example:

- Sample ID: `СГ-001`
- Laboratory: `Санитарно-гигиеническая лаборатория`
- Indicators: `Жесткость`, `Нитриты`

## Proposed data model

```ts
interface LaboratorySample {
  id: string;
  sampleId: string;
  laboratoryId: LaboratoryId;
  laboratoryName: string;
  date: string;
  specialist: string;
  userId?: string;
  specialistName?: string;
  username?: string;
  calculations: SavedCalculation[];
  createdAt: string;
  updatedAt: string;
}
```

Keep `SavedCalculation` as the source for existing single-calculation history and PDF reports. Add `sampleId?: string` later only when the sample workflow is implemented.

## Storage plan

- Add `src/storage/sampleStorage.ts`.
- Use a new localStorage key, for example `dynamic-laboratory-calculator:samples`.
- Store sample records separately from the current calculation history.
- When saving a calculation with a selected sample, keep saving the standalone calculation and also append or replace it inside the sample `calculations[]`.
- Preserve role-based access:
  - admin reads all samples;
  - specialist reads only samples where `sample.userId === currentUser.id`.

## UI plan

1. Add sample selection before the calculation form:
   - create new sample;
   - select existing sample from the same laboratory;
   - show selected sample metadata near the breadcrumb or form header.
2. Add sample page `/samples/:sampleId`:
   - sample information;
   - completed indicators list;
   - button `Добавить показатель`;
   - button `Сформировать общий отчет`.
3. Keep the current calculation page usable for standalone calculations.

## Combined PDF plan

Add a new PDF function, separate from `generateCalculationPdfReport`:

```ts
generateSamplePdfReport(sample: LaboratorySample)
```

The combined PDF should include:

- sample number;
- laboratory;
- date;
- specialist;
- table of all indicators;
- result for each indicator;
- ГОСТ / Методика for each indicator;
- calculation details for each indicator;
- final summary.

The current single-calculation PDF generator must remain unchanged and available from calculation pages and history.

## Migration notes

- Older calculations will not automatically belong to samples.
- A later migration can offer a manual "attach to sample" action by matching `sampleNumber`, `laboratoryId`, and `userId`.
- Do not infer sample membership silently; samples should be explicit to avoid mixing unrelated lab records with the same sample number.
