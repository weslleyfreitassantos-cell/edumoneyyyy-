import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useInstitution } from '../../contexts/InstitutionContext';
import { useTeacherQuestionBank } from '../../hooks/useLearningCenter';
import { PedagogicalCenterHeader, PageState } from './PedagogicalCenterNav';

export default function PedagogicalCenterContentPage() {
  const { currentInstitutionId } = useInstitution();
  const bank = useTeacherQuestionBank(currentInstitutionId ?? undefined);
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => { const query = search.trim().toLocaleLowerCase('pt-BR'); return (bank.data ?? []).filter((item) => !query || `${item.statement} ${item.subject_area} ${item.topic ?? ''}`.toLocaleLowerCase('pt-BR').includes(query)); }, [bank.data, search]);
  return <div className="space-y-6"><PedagogicalCenterHeader subtitle="Encontre conteúdo e adicione questões a uma atividade contextualizada." /><section className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold dark:text-white">Banco de questões</h2><p className="mt-1 text-sm text-slate-500">Filtre por matéria, assunto e origem antes de montar uma atividade.</p></div><Link to="/teacher/pedagogical-center/activities/new" className="rounded-lg bg-[#005bbf] px-3 py-2 text-xs font-bold text-white">Nova atividade</Link></div><input aria-label="Buscar conteúdo" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar enunciado ou assunto" className="mt-4 w-full rounded-lg border px-3 py-2 text-sm dark:bg-slate-900 dark:text-white" />{bank.isLoading ? <PageState>Carregando conteúdo...</PageState> : bank.isError ? <PageState error>Não foi possível carregar o banco de questões.</PageState> : filtered.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{filtered.slice(0, 24).map((item) => <article key={item.id} className="rounded-lg border p-4 dark:border-slate-700"><p className="line-clamp-3 text-sm font-semibold dark:text-white">{item.statement}</p><p className="mt-2 text-xs text-slate-500">{item.subject_area}{item.topic ? ` · ${item.topic}` : ''} · {item.package_type}</p><Link to={`/teacher/pedagogical-center/activities/new?questionBankId=${item.id}`} className="mt-3 inline-flex text-xs font-bold text-[#005bbf]">Adicionar à atividade</Link></article>)}</div> : <PageState>Nenhum conteúdo corresponde aos filtros.</PageState>}</section></div>;
}
