import React from 'react';
import { useDirectorDashboard } from '../hooks/useDirectorDashboard';

export default function DirectorDashboard() {
  const { data, isLoading, error } = useDirectorDashboard();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-500">Carregando dados...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-lg">
        Erro ao carregar dados: {error.message}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 bg-yellow-50 text-yellow-600 rounded-lg">
        Nenhum dado encontrado. Cadastre alunos, professores e turmas para ver o resumo.
      </div>
    );
  }

  const { summary, upcomingEvents, alerts } = data;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-[#181c20]">Painel do Diretor</h2>
          <p className="text-sm text-[#727785]">Resumo executivo do desempenho e gestão escolar global.</p>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard 
          title="Total de Alunos" 
          value={summary.totalStudents} 
          subtitle={`${summary.enrolledStudents} matriculados`}
        />
        <StatCard 
          title="Professores Ativos" 
          value={summary.activeTeachers}
          subtitle={`${summary.totalTeachers} total`}
        />
        <StatCard 
          title="Turmas Ativas" 
          value={summary.activeClasses}
          subtitle={`${summary.totalClasses} total`}
        />
        <StatCard 
          title="Média por Turma" 
          value={summary.avgStudentsPerClass}
          subtitle="alunos por turma"
          isDecimal
        />
      </div>

      {/* Próximos eventos */}
      <div className="bg-white rounded-xl shadow p-4 border border-[#dfe3e8]">
        <h3 className="font-bold text-lg mb-4">📅 Próximos Eventos</h3>
        {upcomingEvents && upcomingEvents.length > 0 ? (
          <ul className="space-y-2">
            {upcomingEvents.map((event, index) => (
              <li key={index} className="border-b pb-2">
                <div className="font-medium">{event.title}</div>
                <div className="text-sm text-gray-600">{event.start_date}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">Nenhum evento próximo cadastrado.</p>
        )}
      </div>

      {/* Alertas */}
      <div className="bg-white rounded-xl shadow p-4 border border-[#dfe3e8]">
        <h3 className="font-bold text-lg mb-4">⚠️ Alertas</h3>
        {alerts && alerts.length > 0 ? (
          <ul className="space-y-2">
            {alerts.map((alert, index) => (
              <li key={index} className="border-b pb-2 text-yellow-700">
                {alert.student_name} - Frequência: {alert.attendance_percentage}% 
                ({alert.alert_type})
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">Nenhum alerta no momento.</p>
        )}
      </div>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  subtitle, 
  isDecimal = false 
}: { 
  title: string; 
  value: number; 
  subtitle?: string;
  isDecimal?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl shadow p-4 border border-[#dfe3e8]">
      <div className="text-sm text-gray-500 font-medium">{title}</div>
      <div className="text-2xl font-bold text-[#181c20]">
        {isDecimal ? value.toFixed(1) : value}
      </div>
      {subtitle && (
        <div className="text-xs text-gray-400 mt-1">{subtitle}</div>
      )}
    </div>
  );
}