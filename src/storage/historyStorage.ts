import type { SavedCalculation } from '../types';

const STORAGE_KEY = 'dynamic-laboratory-calculator:history';
const LEGACY_NITRITE_ID = ['nitr', 'ates'].join('');
const LEGACY_NITRITE_NAME = ['Нит', 'раты'].join('');

export function getSavedCalculations(): SavedCalculation[] {
  try {
    const rawHistory = window.localStorage.getItem(STORAGE_KEY);
    if (!rawHistory) {
      return [];
    }

    const parsed = JSON.parse(rawHistory);
    return Array.isArray(parsed) ? parsed.map(normalizeSavedCalculation) : [];
  } catch {
    return [];
  }
}

export function saveCalculation(calculation: SavedCalculation) {
  const history = getSavedCalculations();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([calculation, ...history]));
}

export function clearSavedCalculations() {
  window.localStorage.removeItem(STORAGE_KEY);
}

function normalizeSavedCalculation(calculation: SavedCalculation): SavedCalculation {
  if ((calculation.indicatorId as string) !== LEGACY_NITRITE_ID && calculation.indicatorName !== LEGACY_NITRITE_NAME) {
    return calculation;
  }

  return {
    ...calculation,
    indicatorId: 'nitrites',
    indicatorName: 'Нитриты',
  };
}
