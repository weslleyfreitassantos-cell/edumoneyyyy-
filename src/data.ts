import { User, ClassSchedule, StudentGroup, TeacherRecord, StudentRecord, NotificationItem } from './types';

export const USERS: Record<string, User> = {
  teacher: {
    id: 'teacher_1',
    name: 'Dr. Ricardo Silva',
    email: 'ricardo.silva@escola.com.br',
    role: 'teacher',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCPGRbVejNHIibmoTAow1y4w1gU0EexrOgNwU6xsqGmvxRWqTPGs5fNgxH_BT4ueFgYcBKhKdYGIStTqxl13TV75UHk7gMUaVVEcvq7yycRndKhtnRr6q1uscyPRgaThQmIC_Mxx5TyeOm4MQiXDEWNaP4SRHaKFKIkqxKGcZ731oFO8iNWLFWDU_MGQsXqpW5ay9h1JJ3AlnjBPG3cIU9ECPJwAgvWVlz-mmc2uMZDbP0OhrDtCixAvglqJZ1Vm-9XcQYBY18J1ybK',
    subtitle: 'Professor Titular',
  },
  student: {
    id: 'student_1',
    name: 'Gabriel Silva',
    email: 'gabriel.silva@escola.com.br',
    role: 'student',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAq02aSF_x30XTXMst8nwaBZbV5Ecxtq1isCEablbT7XzC5vjI_FITS0rgemnpXjwKZ5-oEUjBzabeE53n5LyS8GlIwZvfkab_S3BKQuvoMdcx0_KUEFqVBw5MSXKiAKw_i6X9fQOO0XIFXJJjiYibktcka8DKy_svajs4rU1CukxuvVsGQHefv2OyIwkyHnERzOxS5owJ6ebrQSfIvsf3WSbJ5YGA4hSojSaw8nglk7J1kH2K6vmbm077CuSu8kuun2qDwEatWGevu',
    subtitle: 'Ensino Médio - 3º Ano',
  },
  director: {
    id: 'director_1',
    name: 'Dr. Ricardo Mendes',
    email: 'ricardo.mendes@escola.com.br',
    role: 'director',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD3HVhKdjljchYl70Q4q-oeLURnZSe59YhqCs0vnSvp9puTlRDmwpmBMr8RMN3gCY8qcgtMqL-k0uhOIMUGksjJDLM87Dw5APtn6dPIyZliFqn_N11F7ztanI9lCl4AOzHBcWUZTgfv_N0-zLeEyAmwftqYJz7wkQ0cmCXGn_KPI6Ma9Z1O-KcF3e9c6nf6SqcR1nABSA7p74WtGzYh4JJUXLPW9_M2nFOiSzC45yPlAp7sQfsP8u0wIL9SnNVtFhClbYYuGDhslnNc',
    subtitle: 'Diretor Acadêmico',
  },
  parent: {
    id: 'parent_1',
    name: 'Ricardo Oliveira',
    email: 'ricardo.oliveira@gmail.com',
    role: 'parent',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD9CNL8Id2Cz8VZXl_jXGsiBjakjqlNrw989dXNFG_mC_AMPJ_81VjAMqfNvtFLimnXjejXRkPQA7SPrHTbuvDz8TEvu4xnZo4r1ACl73gq5d4jbvvSBpv5wbSt0tVwPIWOiyw-nV9RGf74xjB2uJvO0oSS-lK2Mhp9I21o-xwzXfJhzbY86KVR3aG10uo7WoPar0tPub5pDeDCrE9mWDRJQUsfNjQncViMf2sUdexzOxjD40AEbBHPLAEW3vGrVR5pQCdwRsVP3iHC',
    subtitle: 'Responsável legal',
  },
};

export const TEACHER_CLASSES: ClassSchedule[] = [
  {
    id: 'class_1',
    time: '08:00',
    period: 'AM',
    title: 'Cálculo Diferencial e Integral I',
    room: 'Sala 204 - Bloco B',
    group: 'Turma MAT-101',
    status: 'finished',
  },
  {
    id: 'class_2',
    time: '10:00',
    period: 'AM',
    title: 'Física Experimental II',
    room: 'Lab de Física 01',
    group: 'Turma FIS-202',
    status: 'active',
  },
  {
    id: 'class_3',
    time: '02:00',
    period: 'PM',
    title: 'Álgebra Linear',
    room: 'Auditório 03',
    group: 'Turma MAT-105',
    status: 'pending',
  },
];

export const TEACHER_GROUPS: StudentGroup[] = [
  {
    id: 'group_1',
    name: 'Engenharia de Software III',
    studentsCount: 42,
    averageGrade: 8.2,
    color: 'bg-primary',
    avatars: [
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCjRB65uJqwWjV3OgfAD2Lx2SEUMhNxgL_ZzPe3IDynDVdgoedeatQxPRW81_CazRYowk8HS3TtCrz9b7piDlAAlB-Pawq9tgBCpgmkT0ZuOI4qWZWXUa641WYXujDRlSUVd_3CwOo8o4Sn13r0OKr8QATvl6GkZ-Eq7cWRNJKmA3km31P1ikMmVB6AY6QW14MDSYDFXKrk0euS-uizLeeAD7ELJfSmamCmBAHh1LM5arJYR77Zh2wm12ztJ6OhXyRbsr6IR52JAKkP',
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBDY-ZgO1EGTPfZNe8kW37UWqyAXv4VrQ-JDBhZMGgjWzdpofV3crYzKQn9qQKotYRk-Qy_WJoZ1QsDAU6J9SZQApPtdOJ3HKXt5dm5Ra356LEszU18vLzgzySK7thu6sU2gNtoaQec17GMcZZUpNsSwWYpVLtnuLWO8wsPX7Qigm3fu7vJ6J0hL6CduiH8mSMTWk_vbRkDqZwwZqlzfYqo65m83QvoF8Wk2ayAldAv5ZOxt6DLlWZowMPYCRkC47RyNav5x7j17lCS',
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAHd-go-nDLj21478v5rFD9omZzESlOI_ol44mddLpCEFCFU7QjL8l0wVTcqj6AlwrMrKmx7CYAn3fbkwICTxGDnJBdek1nAVxVC99cHRf2d39AaFv_ZdqqbqEF4iyxsTRqMOesUoI-WLrERpWcZLhCMwwVkPl5lafjyr5NXAl7TO-jjGMWuKKNPZWaMgDLyYz2Yo6YPPqAREYlDcnVZuU06qtUTNjWl30YDeUXB71g9nPGb1J_W5UxqdwlyLfTG_VJY2SjoJ_Qt90I',
    ],
  },
  {
    id: 'group_2',
    name: 'Sistemas Operacionais',
    studentsCount: 35,
    averageGrade: 7.4,
    color: 'bg-tertiary',
    avatars: [
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBCdl8OIqnKgwv4Rl6yj4fsoHIgqbUYG-_jASbm3QgCSt0VRpEXo_Usc5Mud40OtonZUPsYJinHFlXY0rB-KJAHt4_GTmnhdGHpMO_XsB8_X2fb-XJwbI5nNynyp7Qj0k-ViL1jyoKXMLz-T9wYJoPtKLTTukBSq1y4S2vErnYHiUygCr26TmIAtLihtOK34S3Esar3bqz3EJE9iEcXxpWn-y-wxrx7DnYmgahhoukMXtgrNfLrfF5-vvo9p0gQXyHhPl-WgSYL_dRa',
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDE1sOT4yjEIu2RkOeqjGPK0_AezVPh7eBzqyYAODL5fTsBOUFhmj8HRw0qcUHm0BiiVtSPtZUT6aXeb1X2qMThDXl2gRiVqbgF_vjWlKkMvxNR14VetEVrfAV5blZrsQME5t8wQKYjq6p8WjUYs2jkKG_KBXJj4f5zRioqrY2pnF0fSj5B37Jt6D5LbyJ8e6uHrEOgregmpnxnNzKCfl4Vgc3WLHI2N6yhpm67-Ekr68ILBbT55IQWXOCYA5BdFFc79F4nnFLsEZM1',
    ],
  },
  {
    id: 'group_3',
    name: 'Redes de Computadores',
    studentsCount: 28,
    averageGrade: 8.9,
    color: 'bg-primary-container',
    avatars: [
      'https://lh3.googleusercontent.com/aida-public/AB6AXuA7hrmHzcMeCF8JwmOrhnVaxRE2655w72asau8RG0UBfh1mnL43feE5S0r7r_slprSEBPZb4TidU2U6Gwrz-qth5u6jdfdLwwu-R19lOwdG5JXd32kifmRAgZb0xiDAHoSwEb8IQJr77c6_PesNsYsY11iZKM4JKOYQCR0EQG_ywXaJXfgITY3WrjaABM9E7WAkrbC5Xx2jQ3nyCYuNneya8NrYBEyUBJCEyAJXYJHGcOuEeXFPJEHdmHLxCNly4ejjk3yVLnCmlQdx',
    ],
  },
];

export const STUDENT_SCHEDULE = [
  {
    time: '08:00 - 09:30',
    title: 'Matemática Avançada',
    room: 'Sala 402 • Bloco B',
    status: 'finished',
  },
  {
    time: '09:45 - 11:15',
    title: 'Física Cântica',
    room: 'Laboratório 2 • Bloco A',
    status: 'finished',
  },
  {
    time: '11:30 - 13:00',
    title: 'História do Brasil',
    room: 'Sala 105 • Online/Presencial',
    status: 'active',
  },
  {
    time: '14:00 - 15:30',
    title: 'Literatura Contemporânea',
    room: 'Auditório Principal',
    status: 'pending',
  },
];

export const STUDENT_GRADES = [
  { subject: 'Prova de Química Orgânica', date: 'Há 2 dias', grade: 9.2, status: 'success' },
  { subject: 'Trabalho de Geografia', date: 'Ontem', grade: 8.0, status: 'success' },
  { subject: 'Teste de Redação', date: 'Pendente', grade: null, status: 'pending' },
];

export const STUDENT_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif_1',
    type: 'announcement',
    title: 'Feriado Antecipado',
    sender: 'Secretaria',
    time: '10:30',
    content: 'Informamos que as aulas de sexta-feira foram suspensas devido ao evento pedagógico.',
    read: false,
  },
  {
    id: 'notif_2',
    type: 'homework',
    title: 'Tarefa de Física',
    sender: 'Prof. Ricardo',
    time: '08:15',
    content: 'Nova lista de exercícios sobre Termodinâmica publicada. Prazo: 25/05.',
    read: false,
  },
  {
    id: 'notif_3',
    type: 'system',
    title: 'Boletim Disponível',
    sender: 'Sistema',
    time: 'Ontem',
    content: 'As notas do 1º bimestre foram consolidadas. Confira seu desempenho no portal.',
    read: true,
  },
  {
    id: 'notif_4',
    type: 'alert',
    title: 'Atraso em Livros',
    sender: 'Biblioteca',
    time: '2 dias atrás',
    content: 'O livro "Dom Casmurro" está com a devolução atrasada. Evite multas.',
    read: false,
  },
];

export const DIRECTOR_STATS = [
  { id: 'alunos', title: 'Total de Alunos', value: '1,284', change: '+12% este mês', isPositive: true },
  { id: 'professores', title: 'Professores Ativos', value: '76', change: '98% de retenção anual', isPositive: true },
  { id: 'frequencia', title: 'Frequência Geral', value: '94.2%', change: 'Meta: 95%', isPositive: true },
];

export const DIRECTOR_TEACHERS: TeacherRecord[] = [
  { id: 'teach_1', initials: 'RM', name: 'Ricardo Mendes', classes: '9º A, 1º EM B', attendance: 98, status: 'EM_AULA' },
  { id: 'teach_2', initials: 'AS', name: 'Ana Souza', classes: '8º C, 9º B', attendance: 92, status: 'INTERVALO' },
  { id: 'teach_3', initials: 'CF', name: 'Carlos Freitas', classes: '2º EM A, 3º EM B', attendance: 76, status: 'ATENCAO' },
  { id: 'teach_4', initials: 'LM', name: 'Lucia Martins', classes: '6º A, 7º B', attendance: 95, status: 'EM_AULA' },
];

export const DIRECTOR_CLASS_PERFORMANCE = [
  { name: '3º EM A', grade: 8.8, percent: 88 },
  { name: '9º Fundamental B', grade: 8.2, percent: 82 },
  { name: '1º EM C', grade: 7.9, percent: 79 },
  { name: '8º Fundamental A', grade: 7.5, percent: 75 },
  { name: '2º EM B', grade: 6.4, percent: 64 },
];

export const PARENT_STUDENT_RECORD: StudentRecord = {
  id: 'lucas_1',
  name: 'Lucas Oliveira',
  avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBpwZXrVI9nqTapvFNV73fSnT_JsT2_N9WB4Tp--NH7idZxoXxCGhBkTnBkUTUkhKr5pr7t7KLhDqCIE9H7GJCXQvRim1JZfkJloUgGNdkWQq0y4eK_tt6qFemGy-KSfqaQpQF-2hBsKcq0JAfB9aWIR3ObTy93Bog9jN4f3VoPrNjcIqssVJx4bBqnz37wk_pwLNqtztlRm-mG-ANRz0WrxZUQWNPv-0P8OXmcgj2aSsj32j44xbfrsy4x1krslaXiRnVFFB69FzMz',
  ra: '2024-8831',
  status: 'Ativo',
  averageGrade: 8.5,
  position: '12º / 40',
  attendance: {
    present: 168,
    justified: 4,
    unjustified: 2,
    percent: 94,
  },
  recentGrades: [
    { subject: 'Matemática', type: 'Prova Bimestral 1', grade: 9.0 },
    { subject: 'Português', type: 'Trabalho de Literatura', grade: 7.5 },
    { subject: 'Ciências', type: 'Laboratório', grade: 8.8 },
  ],
  observations: [
    {
      id: 'obs_1',
      teacher: 'Prof. Marcos Silveira',
      subject: 'História',
      date: 'Ontem, 14:30',
      text: '"O Lucas demonstrou excelente participação no debate sobre Revolução Industrial. Sua capacidade analítica superou as expectativas do bimestre. Continue incentivando a leitura em casa."',
      tags: ['Produtivo', 'Participativo'],
      status: 'success',
    },
    {
      id: 'obs_2',
      teacher: 'Profa. Elena Costa',
      subject: 'Matemática',
      date: '15 Mai, 09:15',
      text: '"Lucas esqueceu de entregar a lista de exercícios complementares de álgebra. Recomendo revisar os prazos no Google Classroom para não comprometer a nota de engajamento."',
      tags: ['Atenção'],
      status: 'error',
    },
  ],
};

export const PARENT_COMMITMENTS = [
  { date: '22 MAI', title: 'Reunião de Pais', details: '19:00 - Auditório Principal', color: 'border-primary' },
  { date: '25 MAI', title: 'Feira de Ciências', details: '08:00 às 12:00', color: 'border-secondary' },
  { date: '28 MAI', title: 'Prova de Física', details: 'Conteúdo: Termodinâmica', color: 'border-tertiary' },
  { date: '02 JUN', title: 'Feriado Municipal', details: 'Recesso Escolar', color: 'border-outline' },
];
