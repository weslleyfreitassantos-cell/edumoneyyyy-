import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  AlertTriangle, 
  BadgeCheck, 
  ClipboardList, 
  Megaphone, 
  ArrowRight,
  Sparkles,
  BookOpen,
  Plus,
  X,
  Languages
} from 'lucide-react';
import { STUDENT_SCHEDULE, STUDENT_GRADES, STUDENT_NOTIFICATIONS } from '../data';
import { NotificationItem } from '../types';

export default function StudentDashboard() {
  const [grades, setGrades] = useState(STUDENT_GRADES);
  const [notifications, setNotifications] = useState<NotificationItem[]>(STUDENT_NOTIFICATIONS);
  const [clubMembersCount, setClubMembersCount] = useState(12);
  const [isJoinedClub, setIsJoinedClub] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);

  // Toggle Join Club
  const handleJoinClub = () => {
    if (isJoinedClub) {
      setClubMembersCount(prev => prev - 1);
      setIsJoinedClub(false);
    } else {
      setClubMembersCount(prev => prev + 1);
      setIsJoinedClub(true);
      alert('Inscrição confirmada no Clube de Línguas! O coordenador enviará os detalhes do teste de nivelamento no seu e-mail.');
    }
  };

  const handleNotificationClick = (notif: NotificationItem) => {
    setSelectedNotification(notif);
    // Mark as read
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
  };

  // Unread notifications count
  const unreadNotifsCount = notifications.filter(n => !n.read).length;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
      id="student-dashboard-main"
    >
      {/* Welcome Header */}
      <div className="mb-6" id="student-dashboard-welcome">
        <h2 className="text-3xl font-bold text-[#181c20] tracking-tight">Olá, Gabriel!</h2>
        <p className="text-base text-[#414754] font-medium mt-1">Aqui está o que está acontecendo na sua vida acadêmica hoje.</p>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-12 gap-5" id="student-bento-grid">
        
        {/* 1. Horário do Dia (Left Column - Span 4) */}
        <div className="col-span-12 md:col-span-4 lg:col-span-3 bg-white border border-[#dfe3e8] rounded-xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xs font-bold text-[#005bbf] uppercase tracking-wider">Horário do Dia</h3>
              <span className="text-xs text-[#727785] font-semibold">Seg, 22 Mai</span>
            </div>
            
            <div className="space-y-5 relative">
              {STUDENT_SCHEDULE.map((item, index) => {
                const isActive = item.status === 'active';
                const isFinished = item.status === 'finished';
                return (
                  <div key={index} className="flex gap-3 items-start relative pl-6">
                    {/* Vertical line connector */}
                    {index < STUDENT_SCHEDULE.length - 1 && (
                      <div className="absolute left-[7px] top-4 bottom-[-24px] w-[2px] bg-[#dfe3e8]" />
                    )}
                    
                    {/* Circle Indicator */}
                    <div className={`absolute left-0 top-1 w-3.5 h-3.5 rounded-full border-2 bg-white transition-all ${
                      isActive 
                        ? 'border-[#ba1a1a] bg-[#ba1a1a] scale-110 animate-pulse' 
                        : isFinished 
                        ? 'border-[#005bbf] bg-[#005bbf]' 
                        : 'border-[#c1c6d6]'
                    }`} />

                    <div className={`flex-1 ${isActive ? 'bg-[#005bbf]/5 p-3 rounded-lg border-l-4 border-[#005bbf] -mt-1' : ''}`}>
                      {isActive && (
                        <p className="text-[9px] font-bold text-[#005bbf] tracking-widest uppercase mb-0.5">EM ANDAMENTO</p>
                      )}
                      <p className="text-[10px] text-[#727785] font-bold leading-none">{item.time}</p>
                      <p className={`text-xs font-bold text-[#181c20] mt-1 ${isActive ? 'text-[#005bbf]' : isFinished ? 'opacity-85' : 'opacity-60'}`}>
                        {item.title}
                      </p>
                      <p className="text-[11px] text-[#727785] font-medium mt-0.5">{item.room}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button 
            onClick={() => alert('Abrindo calendário de aulas completo do estudante.')}
            className="mt-6 w-full py-2 border border-[#005bbf] text-[#005bbf] hover:bg-[#005bbf]/5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            Ver Calendário Completo
          </button>
        </div>

        {/* 2. Resumo Acadêmico (Middle Column - Span 5) */}
        <div className="col-span-12 md:col-span-8 lg:col-span-6 space-y-5">
          {/* Stats card */}
          <div className="bg-white border border-[#dfe3e8] rounded-xl p-5 shadow-2xs">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xs font-bold text-[#005bbf] uppercase tracking-wider">Resumo Acadêmico</h3>
              <a 
                onClick={(e) => { e.preventDefault(); alert('Exibindo histórico de boletim de notas completo.'); }}
                href="#" 
                className="text-xs text-[#005bbf] font-bold hover:underline"
              >
                Detalhes das Notas
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* SVG Attendance circle progress */}
              <div className="flex flex-col items-center text-center justify-center">
                <div className="relative w-28 h-28 mb-3">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle 
                      className="text-[#f1f4fa]" 
                      cx="56" 
                      cy="56" 
                      fill="transparent" 
                      r="48" 
                      stroke="currentColor" 
                      strokeWidth="6"
                    />
                    <circle 
                      className="text-[#006e2c] transition-all duration-1000 ease-out" 
                      cx="56" 
                      cy="56" 
                      fill="transparent" 
                      r="48" 
                      stroke="currentColor" 
                      strokeWidth="8"
                      strokeDasharray="301.6"
                      strokeDashoffset="24.1" // 92% of 301.6 is offset by 24.1
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                    <span className="text-xl font-bold text-[#181c20]">92%</span>
                  </div>
                </div>
                <p className="text-xs font-bold text-[#181c20]">Frequência</p>
                <p className="text-[10px] text-[#727785] font-medium mt-0.5">Meta: &gt; 85%</p>
              </div>

              {/* Grades average */}
              <div className="flex flex-col justify-center">
                <div className="mb-4">
                  <div className="flex justify-between items-end mb-1.5">
                    <p className="text-xs font-bold text-[#181c20]">Média Geral</p>
                    <p className="text-xl font-bold text-[#005bbf]">8.5 <span className="text-[10px] text-[#727785] font-normal">/ 10</span></p>
                  </div>
                  <div className="w-full h-2.5 bg-[#f1f4fa] rounded-full overflow-hidden">
                    <div className="h-full bg-[#005bbf] rounded-full" style={{ width: '85%' }} />
                  </div>
                  <p className="text-[10px] text-[#006e2c] font-semibold mt-1.5">+0.3 em relação ao bimestre anterior</p>
                </div>

                <div className="space-y-2 pt-1">
                  <div className="flex justify-between items-center text-xs font-medium">
                    <span className="text-[#727785]">Atividades Entregues</span>
                    <span className="text-[#181c20] font-bold">24 / 28</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-medium">
                    <span className="text-[#727785]">Créditos Cursados</span>
                    <span className="text-[#181c20] font-bold">120 pts</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Table-like grades evaluations */}
          <div className="bg-white border border-[#dfe3e8] rounded-xl overflow-hidden shadow-2xs">
            <div className="p-4 bg-[#f1f4fa] border-b border-[#dfe3e8]">
              <h3 className="text-xs font-bold text-[#181c20] uppercase tracking-wider">Últimas Avaliações</h3>
            </div>
            <div className="divide-y divide-[#dfe3e8]">
              {grades.map((g, idx) => (
                <div key={idx} className="p-3.5 flex justify-between items-center hover:bg-[#f1f4fa] transition-colors">
                  <div>
                    <p className="text-xs font-bold text-[#181c20]">{g.subject}</p>
                    <p className="text-[10px] text-[#727785] font-medium">{g.date}</p>
                  </div>
                  <div className="text-right">
                    {g.grade !== null ? (
                      <span className="px-3 py-1 bg-[#86f898]/30 text-[#00722f] text-xs font-bold rounded-full">
                        {g.grade.toFixed(1)}
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-[#f1f4fa] text-[#727785] text-xs font-bold rounded-full">
                        --
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Notificações Feed (Right Column - Span 3) */}
        <div className="col-span-12 lg:col-span-3">
          <div className="bg-white border border-[#dfe3e8] rounded-xl p-5 shadow-2xs flex flex-col h-full justify-between">
            <div>
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-xs font-bold text-[#005bbf] uppercase tracking-wider">Notificações</h3>
                {unreadNotifsCount > 0 && (
                  <span className="bg-[#ba1a1a] text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                    {unreadNotifsCount}
                  </span>
                )}
              </div>

              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                {notifications.map((notif) => {
                  const isAnnouncement = notif.type === 'announcement';
                  const isHomework = notif.type === 'homework';
                  const isSystem = notif.type === 'system';
                  const isAlert = notif.type === 'alert';
                  
                  return (
                    <div 
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`p-3 rounded-lg border transition-all cursor-pointer group hover:border-[#005bbf] ${
                        isAlert 
                          ? 'border-[#ffdad6] bg-[#ffdad6]/15 text-[#93000a]' 
                          : notif.read 
                          ? 'border-[#dfe3e8] bg-white opacity-80' 
                          : 'border-[#dfe3e8] bg-[#1a73e8]/5'
                      }`}
                    >
                      <div className="flex gap-2.5 mb-1.5">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isAnnouncement 
                            ? 'bg-[#ffdea0] text-[#261a00]' 
                            : isHomework 
                            ? 'bg-[#d8e2ff] text-[#001a41]' 
                            : isSystem 
                            ? 'bg-[#89fa9b]/40 text-[#002108]' 
                            : 'bg-[#ffdad6] text-[#ba1a1a]'
                        }`}>
                          {isAnnouncement ? (
                            <Megaphone className="w-3.5 h-3.5" />
                          ) : isHomework ? (
                            <ClipboardList className="w-3.5 h-3.5" />
                          ) : isSystem ? (
                            <BadgeCheck className="w-3.5 h-3.5" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div className="leading-tight">
                          <h4 className="text-xs font-bold group-hover:text-[#005bbf] transition-colors">{notif.title}</h4>
                          <span className="text-[9px] text-[#727785] font-semibold">{notif.sender} • {notif.time}</span>
                        </div>
                      </div>
                      <p className="text-[11px] leading-relaxed line-clamp-2 mt-1 font-medium opacity-90">
                        {notif.content}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <button 
              onClick={() => alert('Todas as notificações antigas foram marcadas como lidas.')}
              className="mt-6 w-full py-2 text-[#727785] hover:text-[#005bbf] text-xs font-bold flex items-center justify-center gap-1.5 border-t border-[#dfe3e8] pt-4 cursor-pointer"
            >
              Ver todas as notificações
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* Secondary Banner Section (Asymmetric) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5" id="student-secondary-banners">
        {/* Banner Projeto Extensão */}
        <div className="md:col-span-2 relative h-48 rounded-2xl overflow-hidden group cursor-pointer shadow-2xs">
          <div 
            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105" 
            style={{ 
              backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuDxodAAPmRaRmBKlH80f84Cs3niaJJ-JUii89lVj9_QHI2YBYhh6j61F2oNqHaegaKekKK0yFLbbmSUXVCns7eCxx1vAWQapJv--ykOlzFB7dtSEI4MPkbtcV0nbreETEUcL3r3h-tQ-1iAYCZjQDcziUK7Eov8k6VQUKv6JH3hht25D2T8D7f3NpFqTX2ymJLJQx4cYsjmEOr0SYEcKws6Katl451TCY12ZJdk0vRiDiXPovz8Au2I5MFMvJibrbDsGHGuoetIzWOt')` 
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#005bbf]/90 to-transparent flex flex-col justify-center p-6 md:p-8 text-white">
            <h4 className="text-xl md:text-2xl font-bold mb-1.5 leading-tight">Projeto de Extensão 2024</h4>
            <p className="text-xs text-white/95 max-w-sm leading-relaxed font-medium">
              Inscreva-se nos novos grupos de pesquisa e ganhe créditos extracurriculares valiosos.
            </p>
            <button 
              onClick={() => alert('Mais detalhes sobre as inscrições de projetos de pesquisa de extensão.')}
              className="mt-4 w-fit bg-white hover:bg-[#f1f4fa] text-[#005bbf] px-5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              Saber mais
            </button>
          </div>
        </div>

        {/* Banner Clube Línguas */}
        <div className="md:col-span-1 bg-white border border-[#dfe3e8] rounded-2xl p-5 flex flex-col justify-between shadow-2xs">
          <div>
            <span className="p-1 rounded bg-[#005bbf]/10 text-[#005bbf] inline-block mb-2">
              <Languages className="w-5 h-5" />
            </span>
            <h4 className="text-sm font-bold text-[#181c20]">Clube de Línguas</h4>
            <p className="text-xs text-[#727785] mt-1.5 leading-relaxed font-medium">
              Novas turmas de Alemão e Japonês iniciam no próximo mês. Vagas limitadas e exclusivas!
            </p>
          </div>

          <div className="flex items-center justify-between mt-4">
            {/* Avatars */}
            <div className="flex -space-x-1.5">
              <img className="w-8 h-8 rounded-full border-2 border-white object-cover" alt="Student" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBI3NTlGysehZlP16zhqNaWzkCr9ywggpesrpcMOf_8k6ay86jpad_-QF2UaUg3KXgstsY-Qprena7ArwRK42sWqwadGQiZkSwV2toqq2ZECOso5pdi9FPUE6G5KDSJ6XWdzOqTYd43pdiONS-GXdTLZnkETlY7qcZFupuBbsyka4Vmswxcln9xWHu3680yDALWlF_DTJtEn8YeuSNFaw2xrlf53x-HWwU1KEKexXW0K9noshEabSnriPsod2LZ4X2qcEnJpuhOvYia" referrerPolicy="no-referrer" />
              <img className="w-8 h-8 rounded-full border-2 border-white object-cover" alt="Student" src="https://lh3.googleusercontent.com/aida-public/AB6AXuArpf9SGMu9b_E6kKlryD8xPaekbJVQir26lXN3tBUCfRYGIh9tgAClX6OW8Xv8HszGGezRwiABTwnp9EGEMK5W4rUxDeCb5WQDLVZottz3Qs9v4intiApYzd1bEPUrj1GYe4OFVdmoO1mdPMMsl9fz_-7N_udk7KUv9lB3E0zGpUVE1MQV7MN5ZSi5JMk_s-0r54p92Ud2gP5Y3AD78zk4znEHHXNDvXwFaHf7lbNEG2I7OsPH0BbnyxVRWBzhVoijgFfWe-ZavWLz" referrerPolicy="no-referrer" />
              <div className="w-8 h-8 rounded-full bg-[#005bbf] text-white text-[10px] flex items-center justify-center font-bold border-2 border-white">
                +{clubMembersCount}
              </div>
            </div>

            <button 
              onClick={handleJoinClub}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                isJoinedClub 
                  ? 'bg-[#006e2c] text-white' 
                  : 'bg-[#1a73e8] hover:bg-[#005bbf] text-white shadow-xs'
              }`}
            >
              {isJoinedClub ? 'Inscrito ✔' : 'Inscrever-se'}
            </button>
          </div>
        </div>
      </div>

      {/* Detail Notification Modal */}
      <AnimatePresence>
        {selectedNotification && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/40" onClick={() => setSelectedNotification(null)} />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border border-[#dfe3e8] rounded-xl shadow-lg w-full max-w-md p-6 relative z-50"
            >
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-bold uppercase text-[#005bbf] tracking-widest bg-[#005bbf]/10 px-2 py-1 rounded">
                  {selectedNotification.type}
                </span>
                <button onClick={() => setSelectedNotification(null)} className="text-[#727785] hover:text-black">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <h3 className="font-bold text-base text-[#181c20] mb-1">{selectedNotification.title}</h3>
              <p className="text-xs text-[#727785] mb-4">Remetente: <strong>{selectedNotification.sender}</strong> ({selectedNotification.time})</p>
              <p className="text-sm text-[#414754] leading-relaxed bg-[#f1f4fa] p-4 rounded-lg">
                {selectedNotification.content}
              </p>
              <button 
                onClick={() => setSelectedNotification(null)}
                className="mt-5 w-full py-2 bg-[#005bbf] text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                Fechar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
