export type LaboratoryId = 'bacteriology' | 'sanitary';

export type IndicatorId = 'kmafanm' | 'hardness' | 'nitrites';

export type UserRole = 'admin' | 'specialist';

export type FieldType = 'text' | 'number' | 'date';

export interface IndicatorField {
  id: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  unit?: string;
  required?: boolean;
}

export interface IndicatorDefinition {
  id: IndicatorId;
  name: string;
  shortDescription: string;
  fields: IndicatorField[];
}

export interface LaboratoryDefinition {
  id: LaboratoryId;
  name: string;
  description: string;
  indicators: IndicatorDefinition[];
}

export interface CalculationInput {
  sampleNumber: string;
  sampleDate: string;
  specialist: string;
  values: Record<string, string>;
}

export interface CalculationResult {
  reportTitle?: string;
  method?: string;
  formula: string;
  legend?: string[];
  substitution?: string;
  intermediate: string[];
  result: string;
  finalResult?: string;
  explanation: string;
  reportSections?: CalculationReportSection[];
  validationErrors?: string[];
  isValid?: boolean;
}

export interface CalculationReportSection {
  title: string;
  notes?: string[];
  formula?: string;
  formulas?: string[];
  legend?: string[];
  rows?: Array<{ label: string; value: string }>;
  tables?: CalculationReportTable[];
  items?: string[];
  result?: string;
  explanation?: string;
}

export interface CalculationReportTable {
  title?: string;
  note?: string;
  columns: string[];
  rows: string[][];
  widths?: string[];
}

/*
 * TODO(sample-reports): introduce a sample entity when combined reports are implemented.
 * Planned shape:
 * - sampleId: visible sample number, for example "СГ-001"
 * - laboratoryId/laboratoryName
 * - date
 * - specialist/user ownership fields
 * - calculations[]: SavedCalculation references or embedded calculation snapshots
 *
 * Keep SavedCalculation as the single-calculation report source so old PDF reports
 * and history rows continue to work during the migration.
 */
export interface SavedCalculation {
  id: string;
  date: string;
  userId?: string;
  specialistName?: string;
  username?: string;
  laboratoryId: LaboratoryId;
  laboratoryName: string;
  indicatorId: IndicatorId;
  indicatorName: string;
  sampleNumber: string;
  specialist: string;
  result: string;
  input: CalculationInput;
  details: CalculationResult;
}

export interface AppUser {
  id: string;
  fullName: string;
  username: string;
  password: string;
  role: UserRole;
  laboratoryId?: LaboratoryId;
  laboratoryName?: string;
  createdAt: string;
}
