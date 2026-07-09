import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CalendarCheck, 
  FileEdit, 
  DoorOpen, 
  Users, 
  MoreVertical, 
  FlaskConical, 
  Radio, 
  ArrowRight,
  Calendar,
  FileText,
  MessageCircle,
  Search,
  Grid,
  List,
  Plus,
  BookOpen,
  CheckCircle,
  X
} from 'lucide-react';
import { TEACHER_CLASSES, TEACHER_GROUPS } from '../data';
import { ClassSchedule, StudentGroup } from '../types';

export default function TeacherDashboard() {
  const [classes, setClasses] = useState<ClassSchedule[]>(TEACHER_CLASSES);
  const [groups, setGroups] = useState<StudentGroup[]>(TEACHER_GROUPS);
  
  // Interactive Modal States
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [showClassDetail, setShowClassDetail] = useState<ClassSchedule | null>(null);
  const [showGroupDetail, setShowGroupDetail] = useState<StudentGroup | null>(null);
  
  // Form States for New Classroom
  const [newClassName, setNewClassName] = useState('');
  const [newClassStudents, setNewClassStudents] = useState(30);
  const [newClassGrade, setNewClassGrade] = useState(8.0);

  // New Class Form Submit
  const handleAddClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    const newGroup: StudentGroup = {
      id: `group_${Date.now()}`,
      name: newClassName,
      studentsCount: Number(newClassStudents),
      averageGrade: Number(newClassGrade),
      color: 'bg-primary-container',
      avatars: [
        'https://lh3.googleusercontent.com/aida-public/AB6AXuCjRB65uJqwWjV3OgfAD2Lx2SEUMhNxgL_ZzPe3IDynDVdgoedeatQxPRW81_CazRYowk8HS3TtCrz9b7piDlAAlB-Pawq9tgBCpgmkT0ZuOI4qWZWXUa641WYXujDRlSUVd_3CwOo8o4Sn13r0OKr8QATvl6GkZ-Eq7cWRNJKmA3km31P1ikMmVB6AY6QW14MDSYDFXKrk0euS-uizLeeAD7ELJfSmamCmBAHh1LM5arJYR77Zh2wm12ztJ6OhXyRbsr6IR52JAKkP'
      ]
    };

    setGroups([...groups, newGroup]);
    setNewClassName('');
    setShowAddClassModal(false);
  };

  const triggerAttendance = () => {
    alert('Frequência lançada com sucesso! Todos os alunos da "Turma FIS-202" foram sincronizados no sistema.');
  };

  const triggerNotes = () => {
    alert('Módulo de Lançamento de Notas aberto. Selecione uma turma abaixo para começar.');
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
      id="teacher-dashboard-main"
    >
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4" id="teacher-dashboard-welcome">
        <div>
          <h2 className="text-3xl font-bold text-[#181c20] tracking-tight">Bom dia, Professor.</h2>
          <p className="text-base text-[#414754] font-medium mt-1">Você tem {classes.length + 1} aulas agendadas para hoje, 24 de Maio.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={triggerAttendance}
            className="bg-[#005bbf] hover:bg-[#1a73e8] text-white px-5 py-2.5 rounded-lg flex items-center gap-2 font-semibold text-sm transition-transform active:scale-95 shadow-xs cursor-pointer"
          >
            <CheckCircle className="w-4.5 h-4.5" />
            Lançar Frequência
          </button>
          <button 
            onClick={triggerNotes}
            className="bg-white border border-[#005bbf] text-[#005bbf] hover:bg-[#005bbf]/5 px-5 py-2.5 rounded-lg flex items-center gap-2 font-semibold text-sm transition-transform active:scale-95 cursor-pointer"
          >
            <FileEdit className="w-4.5 h-4.5" />
            Registrar Notas
          </button>
        </div>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-12 gap-5" id="teacher-bento-grid">
        
        {/* Section 1: Aulas de Hoje (Span 8) */}
        <div className="col-span-12 lg:col-span-8 bg-white border border-[#dfe3e8] rounded-xl p-6 shadow-2xs">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-lg font-bold text-[#181c20]">Aulas de Hoje</h3>
            <button 
              onClick={() => alert('Visualizando cronograma acadêmico semanal do professor.')}
              className="text-[#005bbf] text-xs font-semibold hover:underline cursor-pointer"
            >
              Ver Cronograma
            </button>
          </div>
          
          <div className="space-y-3.5">
            {classes.map((cls) => {
              const isActive = cls.status === 'active';
              return (
                <motion.div 
                  key={cls.id}
                  whileHover={{ y: -2 }}
                  onClick={() => setShowClassDetail(cls)}
                  className={`flex items-center gap-4 p-4 rounded-lg border transition-colors cursor-pointer relative overflow-hidden ${
                    isActive 
                      ? 'border-[#005bbf]/40 bg-[#005bbf]/5' 
                      : 'border-[#dfe3e8] hover:bg-[#f1f4fa]'
                  }`}
                >
                  {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#005bbf]" />}
                  
                  {/* Time Badge */}
                  <div className={`w-16 h-16 rounded-lg flex flex-col items-center justify-center font-bold text-xs ${
                    isActive 
                      ? 'bg-[#005bbf] text-white shadow-sm animate-pulse' 
                      : 'bg-[#f1f4fa] text-[#414754]'
                  }`}>
                    <span>{cls.time}</span>
                    <span className="text-[9px] uppercase tracking-wider">{cls.period}</span>
                  </div>

                  {/* Title & Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-[#181c20] hover:text-[#005bbf] transition-colors">
                        {cls.title}
                      </h4>
                      {isActive && (
                        <span className="bg-[#006e2c] text-white text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                          Em Andamento
                        </span>
                      )}
                    </div>
                    <div className="flex gap-4 mt-1.5">
                      <span className="flex items-center gap-1 text-xs text-[#727785] font-medium">
                        <DoorOpen className="w-3.5 h-3.5" />
                        {cls.room}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-[#727785] font-medium">
                        <Users className="w-3.5 h-3.5" />
                        {cls.group}
                      </span>
                    </div>
                  </div>

                  {/* Icon sensors */}
                  {isActive ? (
                    <Radio className="w-5 h-5 text-[#005bbf] animate-ping" />
                  ) : (
                    <button className="p-1.5 rounded-full hover:bg-white text-[#727785] transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Section 2: Quick Actions/Stats (Span 4) */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          
          {/* Relatório Semanal Card */}
          <div className="bg-[#1a73e8] text-white rounded-xl p-6 shadow-sm relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 opacity-15 transform rotate-12">
              <BookOpen className="w-32 h-32 text-white" />
            </div>
            <h4 className="text-lg font-bold mb-1.5">Relatório Semanal</h4>
            <p className="text-xs text-white/90 mb-5 leading-relaxed">
              Sua média de frequência esta semana é de 94%. Excelente trabalho administrativo!
            </p>
            <button 
              onClick={() => alert('Exibindo relatório geral de frequência semanal do portal.')}
              className="w-full py-2 bg-white text-[#005bbf] rounded-lg font-bold text-xs hover:bg-opacity-95 transition-all active:scale-98 cursor-pointer shadow-2xs"
            >
              Ver Detalhes
            </button>
          </div>

          {/* Quick Access Grid */}
          <div className="bg-white border border-[#dfe3e8] rounded-xl p-5 shadow-2xs">
            <h3 className="text-[10px] font-bold text-[#727785] uppercase tracking-widest mb-3.5">
              Acessos Rápidos
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              <button 
                onClick={() => alert('Calendário Escolar')}
                className="flex flex-col items-center justify-center p-3.5 rounded-lg bg-[#f1f4fa] border border-[#dfe3e8] hover:border-[#005bbf] transition-all group cursor-pointer"
              >
                <Calendar className="w-5 h-5 text-[#005bbf] mb-2 group-hover:scale-105 transition-transform" />
                <span className="text-xs font-bold text-[#181c20]">Calendário</span>
              </button>

              <button 
                onClick={() => alert('Materiais de Aula')}
                className="flex flex-col items-center justify-center p-3.5 rounded-lg bg-[#f1f4fa] border border-[#dfe3e8] hover:border-[#005bbf] transition-all group cursor-pointer"
              >
                <FileText className="w-5 h-5 text-[#005bbf] mb-2 group-hover:scale-105 transition-transform" />
                <span className="text-xs font-bold text-[#181c20]">Materiais</span>
              </button>

              <button 
                onClick={() => alert('Fórum de Dúvidas')}
                className="flex flex-col items-center justify-center p-3.5 rounded-lg bg-[#f1f4fa] border border-[#dfe3e8] hover:border-[#005bbf] transition-all group cursor-pointer"
              >
                <MessageCircle className="w-5 h-5 text-[#005bbf] mb-2 group-hover:scale-105 transition-transform" />
                <span className="text-xs font-bold text-[#181c20]">Fórum</span>
              </button>

              <button 
                onClick={() => alert('Listagem de Alunos')}
                className="flex flex-col items-center justify-center p-3.5 rounded-lg bg-[#f1f4fa] border border-[#dfe3e8] hover:border-[#005bbf] transition-all group cursor-pointer"
              >
                <Search className="w-5 h-5 text-[#005bbf] mb-2 group-hover:scale-105 transition-transform" />
                <span className="text-xs font-bold text-[#181c20]">Alunos</span>
              </button>
            </div>
          </div>
        </div>

        {/* Section 3: Minhas Turmas (Full Width) */}
        <div className="col-span-12 mt-3">
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="text-lg font-bold text-[#181c20]">Minhas Turmas</h3>
            <div className="flex items-center gap-1.5">
              <button className="p-1.5 rounded bg-[#f1f4fa] text-[#181c20]">
                <Grid className="w-4 h-4" />
              </button>
              <button className="p-1.5 rounded hover:bg-[#f1f4fa] text-[#727785]">
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {groups.map((group) => (
              <motion.div 
                key={group.id}
                whileHover={{ y: -3 }}
                className="bg-white border border-[#dfe3e8] rounded-xl overflow-hidden hover:shadow-md transition-all group flex flex-col"
              >
                <div className={`h-2 ${group.color || 'bg-[#005bbf]'}`} />
                <div className="p-5 flex-1 flex flex-col">
                  <h4 className="font-bold text-sm text-[#181c20] mb-0.5 truncate group-hover:text-[#005bbf] transition-colors">
                    {group.name}
                  </h4>
                  <p className="text-xs text-[#727785] font-medium mb-5">{group.studentsCount} Alunos Matriculados</p>
                  
                  <div className="flex items-center justify-between mt-auto mb-4">
                    {/* Avatars */}
                    <div className="flex -space-x-2">
                      {group.avatars.map((avatar, idx) => (
                        <img 
                          key={idx}
                          className="w-7 h-7 rounded-full border-2 border-white object-cover" 
                          alt="Student Avatar" 
                          src={avatar}
                          referrerPolicy="no-referrer"
                        />
                      ))}
                      {group.studentsCount > group.avatars.length && (
                        <div className="w-7 h-7 rounded-full bg-[#f1f4fa] border-2 border-white flex items-center justify-center text-[9px] font-bold text-[#181c20]">
                          +{group.studentsCount - group.avatars.length}
                        </div>
                      )}
                    </div>

                    {/* Class grade stats */}
                    <div className="text-right leading-none">
                      <p className="text-[9px] font-bold text-[#727785] uppercase tracking-wider mb-1">Média Turma</p>
                      <p className="text-sm font-bold text-[#006e2c]">{group.averageGrade.toFixed(1)}</p>
                    </div>
                  </div>

                  <button 
                    onClick={() => setShowGroupDetail(group)}
                    className="w-full py-2 rounded-lg border border-[#c1c6d6] group-hover:border-[#005bbf] group-hover:text-[#005bbf] transition-colors text-xs font-bold text-[#414754]"
                  >
                    Ver Painel da Turma
                  </button>
                </div>
              </motion.div>
            ))}

            {/* Add New Class / Link Class Button */}
            <div 
              onClick={() => setShowAddClassModal(true)}
              className="border-2 border-dashed border-[#c1c6d6] rounded-xl flex flex-col items-center justify-center p-5 group cursor-pointer hover:border-[#005bbf] hover:bg-[#005bbf]/5 transition-all text-center min-h-[190px]"
            >
              <div className="w-11 h-11 rounded-full bg-[#f1f4fa] flex items-center justify-center text-[#727785] mb-2.5 group-hover:bg-[#005bbf] group-hover:text-white transition-colors">
                <Plus className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-[#414754] group-hover:text-[#005bbf]">Vincular Nova Turma</p>
            </div>
          </div>
        </div>

      </div>

      {/* MODALS */}
      <AnimatePresence>
        {/* New Classroom Modal */}
        {showAddClassModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/40" onClick={() => setShowAddClassModal(false)} />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border border-[#dfe3e8] rounded-xl shadow-lg w-full max-w-md p-6 relative z-50"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-base text-[#181c20]">Vincular Nova Turma</h3>
                <button onClick={() => setShowAddClassModal(false)} className="text-[#727785] hover:text-black">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleAddClass} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-[#414754] uppercase block mb-1">Nome da Disciplina</label>
                  <input 
                    type="text" 
                    placeholder="ex: Inteligência Artificial II"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    className="w-full h-10 border border-[#c1c6d6] rounded-lg px-3 text-sm focus:border-[#005bbf] outline-none"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-[#414754] uppercase block mb-1">Qtd. Alunos</label>
                    <input 
                      type="number" 
                      value={newClassStudents}
                      onChange={(e) => setNewClassStudents(Number(e.target.value))}
                      className="w-full h-10 border border-[#c1c6d6] rounded-lg px-3 text-sm focus:border-[#005bbf] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#414754] uppercase block mb-1">Média Inicial</label>
                    <input 
                      type="number" 
                      step="0.1" 
                      value={newClassGrade}
                      onChange={(e) => setNewClassGrade(Number(e.target.value))}
                      className="w-full h-10 border border-[#c1c6d6] rounded-lg px-3 text-sm focus:border-[#005bbf] outline-none"
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full h-10 bg-[#005bbf] hover:bg-[#1a73e8] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Adicionar Turma
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Class Detail Modal */}
        {showClassDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/40" onClick={() => setShowClassDetail(null)} />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border border-[#dfe3e8] rounded-xl shadow-lg w-full max-w-md p-6 relative z-50"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-base text-[#181c20]">{showClassDetail.title}</h3>
                <button onClick={() => setShowClassDetail(null)} className="text-[#727785] hover:text-black">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3 text-sm">
                <p><strong>Horário:</strong> {showClassDetail.time} {showClassDetail.period}</p>
                <p><strong>Local:</strong> {showClassDetail.room}</p>
                <p><strong>Grupo Designado:</strong> {showClassDetail.group}</p>
                <div className="pt-2 flex gap-2">
                  <button 
                    onClick={() => { alert('Frequência lançada!'); setShowClassDetail(null); }}
                    className="flex-1 py-2 bg-[#005bbf] text-white text-xs font-bold rounded-lg"
                  >
                    Lançar Presenças
                  </button>
                  <button 
                    onClick={() => { alert('Abertura de chat com os líderes da turma.'); setShowClassDetail(null); }}
                    className="flex-1 py-2 border border-[#c1c6d6] text-xs font-bold rounded-lg"
                  >
                    Enviar Mensagem
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Group Detail Modal */}
        {showGroupDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/40" onClick={() => setShowGroupDetail(null)} />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border border-[#dfe3e8] rounded-xl shadow-lg w-full max-w-md p-6 relative z-50"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-base text-[#181c20]">{showGroupDetail.name}</h3>
                <button onClick={() => setShowGroupDetail(null)} className="text-[#727785] hover:text-black">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-xs text-[#727785] uppercase font-bold mb-1">Métricas da Turma</p>
                  <div className="grid grid-cols-2 gap-3 bg-[#f1f4fa] p-3 rounded-lg">
                    <div>
                      <span className="text-xs text-[#414754]">Alunos Ativos:</span>
                      <p className="text-lg font-bold text-[#181c20]">{showGroupDetail.studentsCount}</p>
                    </div>
                    <div>
                      <span className="text-xs text-[#414754]">Média de Notas:</span>
                      <p className="text-lg font-bold text-[#006e2c]">{showGroupDetail.averageGrade.toFixed(1)} / 10</p>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-[#727785] uppercase font-bold mb-1">Desempenho de Avaliações</p>
                  <p className="text-xs text-[#414754] leading-relaxed">
                    A turma apresenta rendimento consistente, com destaques para as entregas de laboratório semanais e discussões de projeto prático.
                  </p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button 
                    onClick={() => { alert('Notas registradas!'); setShowGroupDetail(null); }}
                    className="flex-1 py-2 bg-[#005bbf] text-white text-xs font-bold rounded-lg"
                  >
                    Registrar Novo Trabalho
                  </button>
                  <button 
                    onClick={() => { alert('Exportação de relatório CSV efetuada com sucesso!'); setShowGroupDetail(null); }}
                    className="flex-1 py-2 border border-[#c1c6d6] text-xs font-bold rounded-lg"
                  >
                    Exportar Diário
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
