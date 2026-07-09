import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import StudentsTab from './tabs/StudentsTab';
import TeachersTab from './tabs/TeachersTab';
import ClassesTab from './tabs/ClassesTab';
import SubjectsTab from './tabs/SubjectsTab';
import EnrollmentsTab from './tabs/EnrollmentsTab';
import AssignmentsTab from './tabs/AssignmentsTab';

type TabType = 'students' | 'teachers' | 'guardians' | 'classes' | 'subjects' | 'enrollments' | 'assignments';

export default function AdminPage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('students');

  if (!profile || !['ADMIN', 'DIRECTOR'].includes(profile.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  const tabs: { id: TabType; label: string }[] = [
    { id: 'students', label: 'Alunos' },
    { id: 'teachers', label: 'Professores' },
    { id: 'guardians', label: 'Responsáveis' },
    { id: 'classes', label: 'Turmas' },
    { id: 'subjects', label: 'Disciplinas' },
    { id: 'enrollments', label: 'Matrículas' },
    { id: 'assignments', label: 'Atribuições' },
  ];

  const renderTab = () => {
    switch (activeTab) {
      case 'students':
        return <StudentsTab />;
      case 'teachers':
        return <TeachersTab />;
      case 'classes':
        return <ClassesTab />;
      case 'subjects':
        return <SubjectsTab />;
      case 'enrollments':
        return <EnrollmentsTab />;
      case 'assignments':
        return <AssignmentsTab />;
      default:
        return <div className="p-4 text-gray-500">Em construção</div>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#181c20]">Administração</h2>
        <p className="text-sm text-[#727785]">Gerencie alunos, professores, turmas e disciplinas.</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-[#dfe3e8]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
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