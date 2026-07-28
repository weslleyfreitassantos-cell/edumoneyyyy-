export type BnccStageId =
  | 'elementary-initial'
  | 'elementary-final'
  | 'high-school';

export interface BnccSubjectTemplate {
  id: string;
  name: string;
  code: string;
  defaultSelected: boolean;
}

export interface BnccStageTemplate {
  id: BnccStageId;
  label: string;
  subjects: BnccSubjectTemplate[];
}

const commonElementarySubjects = [
  {
    id: 'portuguese',
    name: 'Língua Portuguesa',
    code: 'LP',
    defaultSelected: true,
  },
  {
    id: 'art',
    name: 'Arte',
    code: 'ART',
    defaultSelected: true,
  },
  {
    id: 'physical-education',
    name: 'Educação Física',
    code: 'EDF',
    defaultSelected: true,
  },
  {
    id: 'math',
    name: 'Matemática',
    code: 'MAT',
    defaultSelected: true,
  },
  {
    id: 'science',
    name: 'Ciências',
    code: 'CIE',
    defaultSelected: true,
  },
  {
    id: 'geography',
    name: 'Geografia',
    code: 'GEO',
    defaultSelected: true,
  },
  {
    id: 'history',
    name: 'História',
    code: 'HIS',
    defaultSelected: true,
  },
  {
    id: 'religious-education',
    name: 'Ensino Religioso',
    code: 'ER',
    defaultSelected: false,
  },
] as const satisfies readonly BnccSubjectTemplate[];

export const BNCC_STAGE_TEMPLATES: BnccStageTemplate[] = [
  {
    id: 'elementary-initial',
    label: 'Ensino Fundamental - Anos Iniciais',
    subjects: [...commonElementarySubjects],
  },
  {
    id: 'elementary-final',
    label: 'Ensino Fundamental - Anos Finais',
    subjects: [
      commonElementarySubjects[0],
      commonElementarySubjects[1],
      commonElementarySubjects[2],
      {
        id: 'english',
        name: 'Língua Inglesa',
        code: 'ING',
        defaultSelected: true,
      },
      commonElementarySubjects[3],
      commonElementarySubjects[4],
      commonElementarySubjects[5],
      commonElementarySubjects[6],
      commonElementarySubjects[7],
    ],
  },
  {
    id: 'high-school',
    label: 'Ensino Médio',
    subjects: [
      {
        id: 'portuguese',
        name: 'Língua Portuguesa',
        code: 'LP',
        defaultSelected: true,
      },
      {
        id: 'english',
        name: 'Língua Inglesa',
        code: 'ING',
        defaultSelected: true,
      },
      {
        id: 'art',
        name: 'Arte',
        code: 'ART',
        defaultSelected: true,
      },
      {
        id: 'physical-education',
        name: 'Educação Física',
        code: 'EDF',
        defaultSelected: true,
      },
      {
        id: 'math',
        name: 'Matemática',
        code: 'MAT',
        defaultSelected: true,
      },
      {
        id: 'biology',
        name: 'Biologia',
        code: 'BIO',
        defaultSelected: true,
      },
      {
        id: 'physics',
        name: 'Física',
        code: 'FIS',
        defaultSelected: true,
      },
      {
        id: 'chemistry',
        name: 'Química',
        code: 'QUI',
        defaultSelected: true,
      },
      {
        id: 'philosophy',
        name: 'Filosofia',
        code: 'FIL',
        defaultSelected: true,
      },
      {
        id: 'geography',
        name: 'Geografia',
        code: 'GEO',
        defaultSelected: true,
      },
      {
        id: 'history',
        name: 'História',
        code: 'HIS',
        defaultSelected: true,
      },
      {
        id: 'sociology',
        name: 'Sociologia',
        code: 'SOC',
        defaultSelected: true,
      },
      {
        id: 'literature',
        name: 'Literatura',
        code: 'LIT',
        defaultSelected: false,
      },
      {
        id: 'writing',
        name: 'Redação',
        code: 'RED',
        defaultSelected: false,
      },
      {
        id: 'spanish',
        name: 'Língua Espanhola',
        code: 'ESP',
        defaultSelected: false,
      },
      {
        id: 'life-project',
        name: 'Projeto de Vida',
        code: 'PV',
        defaultSelected: false,
      },
    ],
  },
];
