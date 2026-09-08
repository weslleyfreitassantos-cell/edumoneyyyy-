import { useState } from 'react';
import { Bot, ChevronRight, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const suggestions = [
  { label: 'Onde configuro a grade?', text: 'A Grade de Horários fica em Configuração acadêmica → Grade horária.', route: '/admin?module=timetable&view=automation' },
  { label: 'Como configurar o financeiro?', text: 'O Financeiro fica em Administração → Financeiro.', route: '/admin?module=finance' },
  { label: 'Como conectar uma catraca?', text: 'A configuração fica em Administração → Portaria → Equipamentos.', route: '/admin?module=access' },
  { label: 'Como cadastrar um aluno?', text: 'Abra Pessoas → Alunos para consultar ou cadastrar alunos.', route: '/admin?module=students' },
];

export default function AssistantTec() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const current = location.pathname.startsWith('/admin') ? 'área administrativa' : 'painel principal';
  function ask(text: string) { const item = suggestions.find((suggestion) => text.toLowerCase().includes(suggestion.label.toLowerCase().replace('?', ''))); setAnswer(item?.text ?? 'Posso orientar sobre grade, alunos, financeiro e portaria. Escolha uma sugestão para abrir a tela correta.'); }
  return <><button type="button" onClick={() => setOpen(true)} aria-label="Abrir Assistente TEC" className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-[#005bbf] px-4 py-3 text-sm font-bold text-white shadow-lg hover:bg-[#004a9c]"><Bot className="h-5 w-5" /> Assistente TEC</button>{open && <div className="fixed bottom-20 right-5 z-50 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"><header className="flex items-center justify-between bg-[#005bbf] px-4 py-3 text-white"><strong>Assistente TEC</strong><button type="button" onClick={() => setOpen(false)} aria-label="Fechar assistente"><X className="h-5 w-5" /></button></header><div className="space-y-4 p-4"><p className="text-sm text-slate-600">Você está na {current}. Como posso ajudar?</p><div className="space-y-2">{suggestions.map((item) => <button key={item.label} type="button" onClick={() => { ask(item.label); navigate(item.route); }} className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50">{item.label}<ChevronRight className="h-4 w-4" /></button>)}</div>{answer && <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{answer}</p>}<form onSubmit={(event) => { event.preventDefault(); ask(question); }} className="flex gap-2"><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Digite sua dúvida" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none" /><button type="submit" className="rounded-lg bg-slate-800 px-3 text-sm font-bold text-white">Enviar</button></form></div></div>}</>;
}
