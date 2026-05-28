import { RadioTower, ShieldCheck, Waves } from 'lucide-react';

export const developmentModules = [
  {
    id: 'radiology',
    title: 'Радиологическая лаборатория',
    description: 'Модуль автоматизации радиологических исследований и расчетов.',
    icon: RadioTower,
  },
  {
    id: 'virology',
    title: 'Вирусологическая лаборатория',
    description: 'Модуль автоматизации вирусологических исследований и анализа результатов.',
    icon: Waves,
  },
  {
    id: 'method-validation',
    title: 'Валидация методов исследования',
    description: 'Модуль валидации и оценки характеристик методов исследования.',
    icon: ShieldCheck,
  },
] as const;

export function getDevelopmentModule(moduleId: string | undefined) {
  return developmentModules.find((module) => module.id === moduleId);
}
