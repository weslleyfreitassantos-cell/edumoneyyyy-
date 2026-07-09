import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  UserCheck, 
  CheckCircle, 
  TrendingUp, 
  AlertTriangle, 
  Calendar, 
  Lightbulb, 
  ArrowRight,
  MoreVertical,
  X,
  FileSpreadsheet
} from 'lucide-react';
import { 
  DIRECTOR_STATS, 
  DIRECTOR_TEACHERS, 
  DIRECTOR_CLASS_PERFORMANCE 
} from '../data';
import { TeacherRecord } from '../types';

export default function DirectorDashboard() {
  const [teachers, setTeachers] = useState<TeacherRecord[]>(DIRECTOR_TEACHERS);
  const [performance, setPerformance] = useState(DIRECTOR_CLASS_PERFORMANCE);
  const [stats, setStats] = useState(DIRECTOR_STATS);
  const [alertNotified, setAlertNotified] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherRecord | null>(null);

  const handleNotifyTeachers = () => {
    setAlertNotified(true);
    alert('Notificação enviada! Os 3 professores pendentes receberam um alerta push prioritário em seus painéis.');
  };

  const toggleTeacherStatus = (id: string) => {
    setTeachers(prev => prev.map(t => {
      if (t.id === id) {
        let nextStatus: 'EM_AULA' | 'INTERVALO' | 'ATENCAO';
        if (t.status === 'EM_AULA') nextStatus = 'INTERVALO';
        else if (t.status === 'INTERVALO') nextStatus = 'ATENCAO';
        else nextStatus = 'EM_AULA';
        return { ...t, status: nextStatus };
      }
      return t;
    }));
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
      id="director-dashboard-main"
    >
      {/* Executive Summary Header */}
      <section id="director-dashboard-header">
        <h2 className="text-3xl font-bold text-[#181c20] tracking-tight">Painel do Diretor</h2>
        <p className="text-base text-[#414754] font-medium mt-1">Resumo executivo do desempenho e gestão escolar global.</p>
      </section>

      {/* Metric Cards Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5" id="director-metrics-section">
        {/* Metric 1 */}
        <div className="bg-white border border-[#dfe3e8] rounded-xl p-5 shadow-2xs hover:shadow-sm transition-shadow flex items-center">
          <div className="h-12 w-12 rounded-lg bg-[#005bbf]/10 flex items-center justify-center text-[#005bbf] mr-4">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-[#727785] font-bold uppercase tracking-wider">Total de Alunos</p>
            <h3 className="text-2xl font-bold text-[#181c20] mt-0.5">1,284</h3>
            <p className="text-[11px] text-[#006e2c] font-semibold flex items-center gap-1 mt-1">
              <TrendingUp className="w-3.5 h-3.5" />
              +12% este mês
            </p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-[#dfe3e8] rounded-xl p-5 shadow-2xs hover:shadow-sm transition-shadow flex items-center">
          <div className="h-12 w-12 rounded-lg bg-[#795900]/10 flex items-center justify-center text-[#795900] mr-4">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-[#727785] font-bold uppercase tracking-wider">Professores Ativos</p>
            <h3 className="text-2xl font-bold text-[#181c20] mt-0.5">76</h3>
            <p className="text-[11px] text-[#414754] font-medium mt-1">98% de retenção anual</p>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-[#dfe3e8] rounded-xl p-5 shadow-2xs hover:shadow-sm transition-shadow flex items-center">
          <div className="h-12 w-12 rounded-lg bg-[#006e2c]/10 flex items-center justify-center text-[#006e2c] mr-4">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-[#727785] font-bold uppercase tracking-wider">Frequência Geral</p>
            <h3 className="text-2xl font-bold text-[#181c20] mt-0.5">94.2%</h3>
            <p className="text-[11px] text-[#006e2c] font-semibold flex items-center gap-1 mt-1">
              <TrendingUp className="w-3.5 h-3.5" />
              Meta: 95%
            </p>
          </div>
        </div>
      </section>

      {/* Main Dashboard Content Layout */}
      <div className="grid grid-cols-12 gap-5" id="director-main-grid">
        
        {/* Gestão de Professores Table (Span 8) */}
        <section className="col-span-12 lg:col-span-8 bg-white border border-[#dfe3e8] rounded-xl overflow-hidden shadow-2xs flex flex-col justify-between">
          <div>
            <div className="p-5 flex justify-between items-center border-b border-[#dfe3e8]">
              <h3 className="text-lg font-bold text-[#181c20]">Gestão de Professores</h3>
              <button 
                onClick={() => alert('Abrindo listagem de todo o corpo docente da escola.')}
                className="text-[#005bbf] text-xs font-semibold hover:underline cursor-pointer"
              >
                Ver Todos
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f1f4fa] border-b border-[#dfe3e8]">
                    <th className="p-4 text-xs font-bold text-[#727785] uppercase tracking-wider">Professor</th>
                    <th className="p-4 text-xs font-bold text-[#727785] uppercase tracking-wider">Turmas Designadas</th>
                    <th className="p-4 text-xs font-bold text-[#727785] uppercase tracking-wider text-center">Frequência Recente</th>
                    <th className="p-4 text-xs font-bold text-[#727785] uppercase tracking-wider text-right">Status (Clique)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dfe3e8]">
                  {teachers.map((teach) => {
                    const isAula = teach.status === 'EM_AULA';
                    const isIntervalo = teach.status === 'INTERVALO';
                    const isAtencao = teach.status === 'ATENCAO';
                    
                    return (
                      <tr 
                        key={teach.id}
                        className="hover:bg-[#f1f4fa] transition-colors cursor-pointer"
                        onClick={() => setSelectedTeacher(teach)}
                      >
                        <td className="p-4">
                          <div className="flex items-center">
                            <div className="h-8 w-8 rounded-full bg-[#1a73e8]/10 mr-3 flex items-center justify-center text-[#005bbf] font-bold text-xs shadow-2xs">
                              {teach.initials}
                            </div>
                            <span className="text-xs font-bold text-[#181c20]">{teach.name}</span>
                          </div>
                        </td>
                        <td className="p-4 text-xs font-medium text-[#414754]">{teach.classes}</td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-24 bg-[#dfe3e8] h-2 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${isAtencao ? 'bg-[#ba1a1a]' : 'bg-[#006e2c]'}`}
                                style={{ width: `${teach.attendance}%` }} 
                              />
                            </div>
                            <span className="text-xs font-bold text-[#181c20]">{teach.attendance}%</span>
                          </div>
                        </td>
                        <td className="p-4 text-right" onClick={(e) => { e.stopPropagation(); toggleTeacherStatus(teach.id); }}>
                          {isAula ? (
                            <span className="px-2.5 py-1 bg-[#86f898]/30 text-[#00722f] text-[9px] font-bold rounded-full uppercase tracking-wider">
                              Em Aula
                            </span>
                          ) : isIntervalo ? (
                            <span className="px-2.5 py-1 bg-[#f1f4fa] text-[#727785] text-[9px] font-bold rounded-full uppercase tracking-wider border border-[#c1c6d6]">
                              Intervalo
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-[#ffdad6] text-[#ba1a1a] text-[9px] font-bold rounded-full uppercase tracking-wider">
                              Atenção
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-4 border-t border-[#dfe3e8] bg-[#f1f4fa]/30 text-center text-xs text-[#727785] font-semibold">
            Clique no status de um professor para alterar rapidamente em tempo de simulação.
          </div>
        </section>

        {/* Desempenho por Turma (Span 4) */}
        <section className="col-span-12 lg:col-span-4 bg-white border border-[#dfe3e8] rounded-xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#181c20]">Desempenho por Turma</h3>
            <p className="text-xs text-[#727785] font-medium mt-1">Média de notas acumuladas no semestre atual.</p>
            
            <div className="space-y-4 mt-6">
              {performance.map((p, idx) => {
                const isAmber = p.grade < 7.0;
                return (
                  <div key={idx} className="relative">
                    <div className="flex justify-between items-center mb-1 text-xs font-semibold">
                      <span className="text-[#181c20] font-bold">{p.name}</span>
                      <span className={`font-bold ${isAmber ? 'text-[#795900]' : 'text-[#005bbf]'}`}>{p.grade.toFixed(1)}</span>
                    </div>
                    <div className="w-full h-2.5 bg-[#f1f4fa] rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${isAmber ? 'bg-[#fbbc09]' : 'bg-[#005bbf]'}`}
                        style={{ width: `${p.percent}%` }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button 
            onClick={() => alert('Relatório completo de desempenho por turma gerado e salvo em PDF.')}
            className="mt-6 w-full py-2.5 border border-[#005bbf] text-[#005bbf] hover:bg-[#005bbf]/5 rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs"
          >
            Gerar Relatório Detalhado
          </button>
        </section>
      </div>

      {/* Bento Layout Extra: Upcoming Events & Alerts */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-5" id="director-footer-bento">
        {/* Alerta Atenção Necessária */}
        <div className="md:col-span-1 bg-[#ffdad6] border border-[#ffdad6] rounded-xl p-5 text-[#93000a] flex flex-col justify-between shadow-2xs">
          <div>
            <AlertTriangle className="w-8 h-8 text-[#ba1a1a] mb-2.5" />
            <h4 className="font-bold text-sm mb-1">Atenção Necessária</h4>
            <p className="text-xs leading-relaxed opacity-90 font-medium">
              3 professores ainda não lançaram a frequência de hoje no diário de classe eletrônico.
            </p>
          </div>
          <button 
            disabled={alertNotified}
            onClick={handleNotifyTeachers}
            className={`mt-4 text-xs font-bold underline text-left transition-opacity cursor-pointer ${
              alertNotified ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-85'
            }`}
          >
            {alertNotified ? 'Alerta Enviado ✓' : 'Notificar Todos Agora'}
          </button>
        </div>

        {/* Próximos Eventos & Sugestões */}
        <div className="md:col-span-3 bg-white border border-[#dfe3e8] rounded-xl p-5 flex flex-col md:flex-row gap-6 shadow-2xs">
          {/* Events list */}
          <div className="flex-1">
            <h4 className="font-bold text-sm text-[#181c20] mb-4 flex items-center gap-2">
              <Calendar className="w-4.5 h-4.5 text-[#005bbf]" />
              Próximos Eventos
            </h4>
            
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="min-w-[44px] text-center bg-[#f1f4fa] p-1.5 rounded-lg border border-[#c1c6d6] leading-none">
                  <span className="block text-[8px] uppercase font-bold text-[#727785]">Out</span>
                  <span className="block text-base font-bold text-[#181c20] mt-1">15</span>
                </div>
                <div className="ml-3.5">
                  <p className="text-xs font-bold text-[#181c20] leading-tight">Reunião de Pais e Mestres</p>
                  <p className="text-[10px] text-[#727785] mt-0.5 font-medium">Auditório Principal • 19:00</p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="min-w-[44px] text-center bg-[#f1f4fa] p-1.5 rounded-lg border border-[#c1c6d6] leading-none">
                  <span className="block text-[8px] uppercase font-bold text-[#727785]">Out</span>
                  <span className="block text-base font-bold text-[#181c20] mt-1">18</span>
                </div>
                <div className="ml-3.5">
                  <p className="text-xs font-bold text-[#181c20] leading-tight">Conselho de Classe (1º EM)</p>
                  <p className="text-[10px] text-[#727785] mt-0.5 font-medium">Sala 04 • 14:30</p>
                </div>
              </div>
            </div>
          </div>

          {/* Vertical Divider */}
          <div className="w-[1px] bg-[#dfe3e8] hidden md:block" />

          {/* System suggestions */}
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-sm text-[#181c20] mb-3 flex items-center gap-2">
                <Lightbulb className="w-4.5 h-4.5 text-[#005bbf]" />
                Sugestões do Sistema
              </h4>
              <div className="p-3.5 bg-[#f1f4fa] border-l-4 border-[#005bbf] rounded-r-lg text-xs font-semibold text-[#414754] leading-relaxed">
                Detectamos uma queda de 5% na frequência acumulada da turma do 2º EM B nos últimos 15 dias de aula. Sugerimos agendar uma conversa preventiva com os responsáveis.
              </div>
            </div>
            
            <button 
              onClick={() => alert('Redirecionando para o módulo de agendamento de reuniões com os pais.')}
              className="mt-3 text-xs text-[#005bbf] font-bold hover:underline flex items-center gap-1 cursor-pointer align-bottom"
            >
              Agendar Conversa com Responsáveis
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Teacher Detail Dialog */}
      <AnimatePresence>
        {selectedTeacher && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/40" onClick={() => setSelectedTeacher(null)} />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border border-[#dfe3e8] rounded-xl shadow-lg w-full max-w-md p-6 relative z-50"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-base text-[#181c20]">{selectedTeacher.name}</h3>
                <button onClick={() => setSelectedTeacher(null)} className="text-[#727785] hover:text-black">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3.5 text-sm">
                <p><strong>Turmas Designadas:</strong> {selectedTeacher.classes}</p>
                <p><strong>Frequência Média Recente:</strong> {selectedTeacher.attendance}%</p>
                <div>
                  <strong>Status Atual: </strong>
                  <span className="font-bold uppercase text-[#005bbf]">{selectedTeacher.status.replace('_', ' ')}</span>
                </div>
                <div className="pt-2 flex gap-2">
                  <button 
                    onClick={() => { alert('Disparando e-mail corporativo institucional.'); setSelectedTeacher(null); }}
                    className="flex-1 py-2 bg-[#005bbf] text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Enviar E-mail
                  </button>
                  <button 
                    onClick={() => { alert('Relatório de rendimento de aulas do professor exportado para XLS.'); setSelectedTeacher(null); }}
                    className="flex-1 py-2 border border-[#c1c6d6] text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-[#727785]" />
                    Exportar Histórico
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
