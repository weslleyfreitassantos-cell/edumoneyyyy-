import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BadgeCheck, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  FileText, 
  GraduationCap, 
  Mail, 
  MessageSquare, 
  Plus, 
  Trash2,
  X,
  UserCheck,
  ClipboardList,
  AlertTriangle,
  Award
} from 'lucide-react';
import { PARENT_STUDENT_RECORD, PARENT_COMMITMENTS } from '../data';

export default function ParentDashboard() {
  const [studentRecord, setStudentRecord] = useState(PARENT_STUDENT_RECORD);
  const [commitments, setCommitments] = useState(PARENT_COMMITMENTS);
  const [showAddCommitment, setShowAddCommitment] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('30 MAI');
  const [newDetails, setNewDetails] = useState('');
  
  // Slide position for carousel (visual mock indicator)
  const [slideIndex, setSlideIndex] = useState(0);

  const handleAddCommitment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newCommitment = {
      date: newDate.toUpperCase(),
      title: newTitle,
      details: newDetails || 'Sem observações adicionais',
      color: 'border-emerald-600',
    };

    setCommitments([...commitments, newCommitment]);
    setNewTitle('');
    setNewDetails('');
    setShowAddCommitment(false);
    alert('Novo compromisso agendado com sucesso no calendário familiar do aluno!');
  };

  const handleDeleteCommitment = (indexToDelete: number) => {
    if (window.confirm('Deseja excluir este compromisso?')) {
      setCommitments(commitments.filter((_, idx) => idx !== indexToDelete));
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
      id="parent-dashboard-main"
    >
      {/* Welcome Title */}
      <div className="mb-6" id="parent-dashboard-welcome">
        <h2 className="text-3xl font-bold text-[#181c20] tracking-tight">Painel do Responsável</h2>
        <p className="text-base text-[#414754] font-medium mt-1">
          Bem-vindo de volta, Ricardo. Aqui está o resumo de hoje para o seu filho, <strong>{studentRecord.name}</strong>.
        </p>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-12 gap-5" id="parent-bento-grid">
        
        {/* 1. Student Profile Summary (Left Column - Span 4) */}
        <section className="col-span-12 lg:col-span-4 flex flex-col gap-5">
          <div className="bg-white border border-[#dfe3e8] rounded-xl p-6 flex flex-col items-center text-center relative overflow-hidden h-full shadow-2xs">
            {/* Header backdrop tint */}
            <div className="absolute top-0 left-0 w-full h-24 bg-[#1a73e8]/5 opacity-60" />
            
            <div className="relative mt-8">
              <img 
                className="w-32 h-32 rounded-full border-4 border-white shadow-sm object-cover" 
                alt={studentRecord.name} 
                src={studentRecord.avatar}
                referrerPolicy="no-referrer"
              />
              <div className="absolute bottom-1 right-1 bg-[#006e2c] w-7 h-7 rounded-full flex items-center justify-center border-2 border-white text-white shadow-xs">
                <BadgeCheck className="w-4 h-4 text-white" />
              </div>
            </div>

            <h3 className="mt-4 text-xl font-bold text-[#181c20]">{studentRecord.name}</h3>
            <p className="text-xs text-[#414754] font-semibold">{studentRecord.ra} • {studentRecord.status}</p>
            
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <span className="bg-[#f1f4fa] px-3.5 py-1 rounded-full text-xs font-bold text-[#414754]">
                9º Ano - Turma B (Matutino)
              </span>
              <span className="bg-[#86f898]/30 px-3.5 py-1 rounded-full text-xs font-bold text-[#00722f]">
                Matrícula Ativa
              </span>
            </div>

            {/* General metrics */}
            <div className="mt-8 w-full border-t border-[#dfe3e8] pt-6 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-[#727785] uppercase tracking-wider">Média Geral</p>
                <p className="text-2xl font-bold text-[#005bbf] mt-0.5">{studentRecord.averageGrade.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#727785] uppercase tracking-wider">Posição Turma</p>
                <p className="text-2xl font-bold text-[#181c20] mt-0.5">{studentRecord.position}</p>
              </div>
            </div>
            
            <div className="mt-6 w-full p-3 bg-[#f1f4fa] rounded-lg text-xs text-[#414754] font-medium leading-relaxed flex items-center gap-2">
              <Award className="w-5 h-5 text-[#795900] flex-shrink-0" />
              <span>O Lucas está no top 30% de melhor rendimento da turma B neste bimestre!</span>
            </div>
          </div>
        </section>

        {/* 2. Acompanhamento Escolar (Grades & Attendance - Span 8) */}
        <section className="col-span-12 lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-5">
          
          {/* Frequência Widget */}
          <div className="bg-white border border-[#dfe3e8] rounded-xl p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-5">
                <h4 className="text-[10px] font-bold text-[#727785] uppercase tracking-widest">Frequência Escolar</h4>
                <UserCheck className="w-5 h-5 text-[#005bbf]" />
              </div>

              <div className="flex items-end gap-3 mb-3">
                <span className="text-3xl font-bold text-[#181c20] tracking-tight">{studentRecord.attendance.percent}%</span>
                <span className="text-[#006e2c] text-xs font-bold mb-1">+2% este mês</span>
              </div>

              <div className="w-full bg-[#f1f4fa] h-2 rounded-full mb-6 overflow-hidden">
                <div className="bg-[#005bbf] h-full rounded-full" style={{ width: `${studentRecord.attendance.percent}%` }} />
              </div>

              <div className="space-y-2.5">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-[#414754]">Presenças</span>
                  <span className="text-[#181c20] font-bold">{studentRecord.attendance.present}</span>
                </div>
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-[#414754]">Faltas Justificadas</span>
                  <span className="text-[#181c20] font-bold">{studentRecord.attendance.justified}</span>
                </div>
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-[#414754]">Faltas não Justificadas</span>
                  <span className="text-[#ba1a1a] font-bold">{studentRecord.attendance.unjustified}</span>
                </div>
              </div>
            </div>

            <button 
              onClick={() => alert('Abrindo painel geral de controle de frequências do aluno.')}
              className="mt-6 text-[#005bbf] hover:underline text-xs font-bold flex items-center justify-center gap-1.5 border-t border-[#dfe3e8] pt-4 cursor-pointer"
            >
              Ver histórico completo
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Recent Grades Widget */}
          <div className="bg-white border border-[#dfe3e8] rounded-xl p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-5">
                <h4 className="text-[10px] font-bold text-[#727785] uppercase tracking-widest">Notas Recentes</h4>
                <FileText className="w-5 h-5 text-[#005bbf]" />
              </div>

              <div className="space-y-4">
                {studentRecord.recentGrades.map((g, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#005bbf]/10 flex items-center justify-center text-[#005bbf]">
                      <ClipboardList className="w-4.5 h-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[#181c20] truncate">{g.subject}</p>
                      <p className="text-[10px] text-[#727785] font-semibold">{g.type}</p>
                    </div>
                    <span className="text-lg font-bold text-[#005bbf]">{g.grade?.toFixed(1) || '--'}</span>
                  </div>
                ))}
              </div>
            </div>

            <button 
              onClick={() => alert('Abertura de boletim de notas completo em formato digital PDF.')}
              className="mt-6 text-[#005bbf] hover:underline text-xs font-bold flex items-center justify-center gap-1.5 border-t border-[#dfe3e8] pt-4 cursor-pointer"
            >
              Boletim completo
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Observações do Professor (Full Width under Grades) */}
          <div className="md:col-span-2 bg-white border border-[#dfe3e8] rounded-xl p-5 shadow-2xs">
            <div className="flex justify-between items-center mb-5 border-b border-[#dfe3e8] pb-3">
              <h4 className="text-[10px] font-bold text-[#727785] uppercase tracking-widest">Observações do Professor</h4>
              <MessageSquare className="w-5 h-5 text-[#005bbf]" />
            </div>

            <div className="space-y-5">
              {studentRecord.observations.map((obs) => {
                const isError = obs.status === 'error';
                return (
                  <div key={obs.id} className="flex gap-4 items-start pb-5 border-b border-[#dfe3e8] last:border-b-0 last:pb-0">
                    <div className="bg-[#f1f4fa] p-2.5 rounded-full flex-shrink-0 text-[#727785]">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start flex-wrap gap-1">
                        <h5 className="text-xs font-bold text-[#181c20]">{obs.teacher} <span className="font-medium text-[#727785]">({obs.subject})</span></h5>
                        <span className="text-[10px] text-[#727785] font-semibold">{obs.date}</span>
                      </div>
                      <p className="mt-2 text-xs text-[#414754] leading-relaxed font-medium bg-[#f1f4fa]/40 p-3 rounded-lg border border-[#dfe3e8]/30">
                        {obs.text}
                      </p>
                      
                      {/* Tags */}
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {obs.tags.map((tag, tIdx) => (
                          <span 
                            key={tIdx} 
                            className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                              isError 
                                ? 'bg-[#ffdad6] text-[#ba1a1a]' 
                                : 'bg-[#86f898]/30 text-[#00722f]'
                            }`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </section>

        {/* 4. Próximos Compromissos Horizontal (Full Width - Span 12) */}
        <section className="col-span-12 bg-white border border-[#dfe3e8] rounded-xl p-5 shadow-2xs">
          <div className="flex justify-between items-center mb-5 border-b border-[#dfe3e8] pb-3">
            <h4 className="text-[10px] font-bold text-[#727785] uppercase tracking-widest">Próximos Compromissos</h4>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowAddCommitment(true)}
                className="p-1 px-3 bg-[#005bbf] hover:bg-[#1a73e8] text-white rounded-lg flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Agendar Novo
              </button>
              <div className="flex gap-1.5">
                <button 
                  onClick={() => setSlideIndex(prev => Math.max(0, prev - 1))}
                  className="p-1 hover:bg-[#f1f4fa] rounded border border-[#dfe3e8] text-[#727785]"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setSlideIndex(prev => Math.min(commitments.length - 1, prev + 1))}
                  className="p-1 hover:bg-[#f1f4fa] rounded border border-[#dfe3e8] text-[#727785]"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {commitments.map((c, idx) => (
              <div 
                key={idx} 
                className={`p-4 bg-[#f1f4fa] rounded-lg border-l-4 ${c.color || 'border-[#005bbf]'} flex flex-col justify-between group relative`}
              >
                {/* Delete button (only on hover or directly) */}
                <button 
                  onClick={() => handleDeleteCommitment(idx)}
                  className="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-700 cursor-pointer"
                  title="Excluir compromisso"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#005bbf]">{c.date}</p>
                  <p className="text-xs font-bold text-[#181c20] mt-1 leading-tight">{c.title}</p>
                  <p className="text-[11px] text-[#727785] mt-1 font-medium">{c.details}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>

      {/* Add Commitment Modal */}
      <AnimatePresence>
        {showAddCommitment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/40" onClick={() => setShowAddCommitment(false)} />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border border-[#dfe3e8] rounded-xl shadow-lg w-full max-w-md p-6 relative z-50"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-base text-[#181c20]">Agendar Novo Compromisso</h3>
                <button onClick={() => setShowAddCommitment(false)} className="text-[#727785] hover:text-black">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleAddCommitment} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-[#414754] uppercase block mb-1">Título</label>
                  <input 
                    type="text" 
                    placeholder="ex: Estudar Física com o Lucas"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full h-10 border border-[#c1c6d6] rounded-lg px-3 text-sm focus:border-[#005bbf] outline-none"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-[#414754] uppercase block mb-1">Data</label>
                    <input 
                      type="text" 
                      placeholder="ex: 30 MAI"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="w-full h-10 border border-[#c1c6d6] rounded-lg px-3 text-sm focus:border-[#005bbf] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#414754] uppercase block mb-1">Detalhes / Horário</label>
                    <input 
                      type="text" 
                      placeholder="ex: 18:30"
                      value={newDetails}
                      onChange={(e) => setNewDetails(e.target.value)}
                      className="w-full h-10 border border-[#c1c6d6] rounded-lg px-3 text-sm focus:border-[#005bbf] outline-none"
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full h-10 bg-[#005bbf] hover:bg-[#1a73e8] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Confirmar Agendamento
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
