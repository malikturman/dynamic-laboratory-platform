import type { LaboratoryDefinition } from '../types';

export const laboratories: LaboratoryDefinition[] = [
  {
    id: 'bacteriology',
    name: 'Бактериологическая лаборатория',
    description: 'Расчеты микробиологических показателей и регистрация результатов исследований.',
    indicators: [
      {
        id: 'kmafanm',
        name: 'КМАФАнМ',
        shortDescription: 'Определение количества мезофильных аэробных и факультативно-анаэробных микроорганизмов по ГОСТ 10444.15-94.',
        fields: [
          {
            id: 'object',
            label: 'Объект исследования',
            type: 'text',
            placeholder: 'Например, молочная продукция',
            required: true,
          },
          {
            id: 'inoculumVolume',
            label: 'Объем инокулята m',
            type: 'number',
            placeholder: '1',
            unit: 'см³',
            required: true,
          },
          {
            id: 'pipetteDivision',
            label: 'Цена деления пипетки',
            type: 'number',
            placeholder: '0.01',
            unit: 'мл',
            required: true,
          },
          {
            id: 'operatorUncertainty',
            label: 'Стандартная неопределенность оператора',
            type: 'number',
            placeholder: '0.002',
            unit: 'мл',
            required: true,
          },
          {
            id: 'thermometerDivision',
            label: 'Цена деления термометра',
            type: 'number',
            placeholder: '0.1',
            unit: '°C',
            required: true,
          },
          {
            id: 'incubationTemperature',
            label: 'Температура термостатирования',
            type: 'number',
            placeholder: '30',
            unit: '°C',
            required: true,
          },
          {
            id: 'coverageFactor',
            label: 'Коэффициент охвата k',
            type: 'number',
            placeholder: '2',
            required: true,
          },
        ],
      },
    ],
  },
  {
    id: 'sanitary',
    name: 'Санитарно-гигиеническая лаборатория',
    description: 'Расчеты физико-химических показателей и контроль качества образцов.',
    indicators: [
      {
        id: 'hardness',
        name: 'Жесткость',
        shortDescription: 'Комплексонометрический метод определения жесткости воды по ГОСТ 31954-2012, раздел 4, метод А.',
        fields: [
          {
            id: 'ctr',
            label: 'Cтр — концентрация раствора трилона Б',
            type: 'number',
            placeholder: '50',
            unit: 'ммоль/дм³',
            required: true,
          },
          {
            id: 'f',
            label: 'F — множитель разбавления',
            type: 'number',
            placeholder: '1',
            required: true,
          },
          {
            id: 'v',
            label: 'V — объем трилона Б при установлении поправочного коэффициента',
            type: 'number',
            placeholder: 'Например, 10.0',
            unit: 'см³',
            required: true,
          },
          {
            id: 'vtr1',
            label: 'Vтр1 — объем трилона Б, определение 1',
            type: 'number',
            placeholder: 'Например, 4.2',
            unit: 'см³',
            required: true,
          },
          {
            id: 'vtr2',
            label: 'Vтр2 — объем трилона Б, определение 2',
            type: 'number',
            placeholder: 'Например, 4.3',
            unit: 'см³',
            required: true,
          },
          {
            id: 'vpr',
            label: 'Vпр — объем пробы воды',
            type: 'number',
            placeholder: '100',
            unit: 'см³',
            required: true,
          },
        ],
      },
      {
        id: 'nitrites',
        name: 'Нитриты',
        shortDescription:
          'Фотометрический метод определения содержания нитритов с использованием сульфаниловой кислоты (метод Б)',
        fields: [
          {
            id: 'k',
            label: 'K',
            type: 'number',
            placeholder: 'Коэффициент градуировочной характеристики',
            required: true,
          },
          {
            id: 'a',
            label: 'A',
            type: 'number',
            placeholder: 'Оптическая плотность пробы минус холостая проба',
            required: true,
          },
          {
            id: 'vk',
            label: 'Vk',
            type: 'number',
            placeholder: 'Вместимость мерной колбы',
            unit: 'мл',
            required: true,
          },
          {
            id: 'v',
            label: 'V',
            type: 'number',
            placeholder: 'Объем аликвоты пробы',
            unit: 'мл',
            required: true,
          },
          {
            id: 'f',
            label: 'f',
            type: 'number',
            placeholder: '1',
          },
        ],
      },
    ],
  },
];

export function getLaboratory(labId: string | undefined) {
  return laboratories.find((laboratory) => laboratory.id === labId);
}

export function getIndicator(labId: string | undefined, indicatorId: string | undefined) {
  return getLaboratory(labId)?.indicators.find((indicator) => indicator.id === indicatorId);
}
