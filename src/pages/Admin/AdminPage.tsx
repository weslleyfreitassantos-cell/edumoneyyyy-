import { useState } from 'react';
import { Navigate } from 'react-router-dom';

import InstitutionSwitcher from '../../components/InstitutionSwitcher';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrentInstitution } from '../../hooks/useCurrentInstitution';

import {
  hasEffectivePermission,
} from '../../lib/permissions';

import AdminOverviewTab from './tabs/AdminOverviewTab';
import AcademicYearsTab from './tabs/AcademicYearsTab';
import AssignmentsTab from './tabs/AssignmentsTab';
import ClassesTab from './tabs/ClassesTab';
import EnrollmentsTab from './tabs/EnrollmentsTab';
import GuardiansTab from './tabs/GuardiansTab';
import SchoolUsersTab from './tabs/SchoolUsersTab';
import StudentsTab from './tabs/StudentsTab';
import SubjectsTab from './tabs/SubjectsTab';
import TeachersTab from './tabs/TeachersTab';

type TabType =
  | 'overview'
  | 'school-users'
  | 'students'
  | 'teachers'
  | 'guardians'
  | 'academic-years'
  | 'classes'
  | 'subjects'
  | 'enrollments'
  | 'assignments';

export default function AdminPage() {
  const { profile } = useAuth();
  const institutionQuery =
    useCurrentInstitution(profile?.id);
  const [activeTab, setActiveTab] =
    useState<TabType>('overview');

  const canManageSchool =
    hasEffectivePermission({
      membershipRole:
        institutionQuery.currentRole,
      profileRole: profile?.role,
      permission: 'manage_school',
    });

  if (
    !profile ||
    !canManageSchool
  ) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  const tabs: {
    id: TabType;
    label: string;
  }[] = [
    { id: 'overview', label: 'Visão geral' },
    { id: 'school-users', label: 'Usuários' },
    { id: 'students', label: 'Alunos' },
    { id: 'teachers', label: 'Professores' },
    { id: 'guardians', label: 'Responsáveis' },
    { id: 'academic-years', label: 'Ano letivo' },
    { id: 'classes', label: 'Turmas' },
    { id: 'subjects', label: 'Disciplinas' },
    { id: 'enrollments', label: 'Matrículas' },
    { id: 'assignments', label: 'Atribuições' },
  ];

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':
        return <AdminOverviewTab />;
      case 'school-users':
        return <SchoolUsersTab />;
      case 'students':
        return <StudentsTab />;
      case 'teachers':
        return <TeachersTab />;
      case 'guardians':
        return <GuardiansTab />;
      case 'academic-years':
        return <AcademicYearsTab />;
      case 'classes':
        return <ClassesTab />;
      case 'subjects':
        return <SubjectsTab />;
      case 'enrollments':
        return <EnrollmentsTab />;
      case 'assignments':
        return <AssignmentsTab />;
      default:
        return (
          <div className="rounded-xl border border-[#dfe3e8] bg-white p-6 text-sm text-gray-500">
            Este módulo ainda será conectado.
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#181c20]">
            Administração
          </h2>

          <p className="text-sm text-[#727785]">
            Gerencie a estrutura acadêmica, vínculos e matrículas da instituição.
          </p>
        </div>

        <InstitutionSwitcher />
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-[#dfe3e8] pb-px">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() =>
              setActiveTab(tab.id)
            }
            className={`shrink-0 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-[#005bbf] text-[#005bbf]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>{renderTab()}</div>
    </div>
  );
}
