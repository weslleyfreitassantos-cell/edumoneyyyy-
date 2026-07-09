export type UserRole = 'teacher' | 'student' | 'director' | 'parent';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  subtitle: string;
}

export interface ClassSchedule {
  id: string;
  time: string;
  period: 'AM' | 'PM';
  title: string;
  room: string;
  group: string;
  status?: 'active' | 'pending' | 'finished';
}

export interface StudentGroup {
  id: string;
  name: string;
  studentsCount: number;
  averageGrade: number;
  avatars: string[];
  color: string;
}

export interface TeacherRecord {
  id: string;
  initials: string;
  name: string;
  classes: string;
  attendance: number;
  status: 'EM_AULA' | 'INTERVALO' | 'ATENCAO';
}

export interface StudentRecord {
  id: string;
  name: string;
  avatar: string;
  ra: string;
  status: string;
  averageGrade: number;
  position: string;
  attendance: {
    present: number;
    justified: number;
    unjustified: number;
    percent: number;
  };
  recentGrades: {
    subject: string;
    type: string;
    grade: number | null;
  }[];
  observations: {
    id: string;
    teacher: string;
    subject: string;
    date: string;
    text: string;
    tags: string[];
    status: 'success' | 'warning' | 'error';
  }[];
}

export interface NotificationItem {
  id: string;
  type: 'announcement' | 'homework' | 'system' | 'alert';
  title: string;
  sender: string;
  time: string;
  content: string;
  read: boolean;
}

export interface AcademicGrade {
  subject: string;
  date: string;
  grade: number | string;
}
