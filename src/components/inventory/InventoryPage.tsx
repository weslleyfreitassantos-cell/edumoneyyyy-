import {
  ArrowDownToLine,
  Boxes,
  Check,
  ClipboardList,
  Download,
  MapPin,
  PackagePlus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import {
  inventoryService,
  type InventoryItem,
  type InventoryCountSession,
  type InventoryLocation,
  type InventoryMovement,
  type InventoryRequest,
} from '../../services/inventoryService';

type StockAction = 'RECEIPT' | 'ISSUE' | 'RETURN' | 'ADJUSTMENT' | 'TRANSFER';
const INVENTORY_PAGE_SIZE = 10;

const requestStatusLabels: Record<string, { label: string; description: string; className: string }> = {
  PENDING: {
    label: 'Aguardando aprovação',
    description: 'A secretaria ainda precisa analisar esta solicitação.',
    className: 'border-amber-200 bg-amber-50 text-amber-900',
  },
  APPROVED: {
    label: 'Aprovada · aguardando entrega',
    description: 'A solicitação foi aprovada e a entrega ainda não começou.',
    className: 'border-blue-200 bg-blue-50 text-blue-900',
  },
  REJECTED: {
    label: 'Recusada',
    description: 'A secretaria não aprovou esta solicitação.',
    className: 'border-red-200 bg-red-50 text-red-900',
  },
  PARTIALLY_FULFILLED: {
    label: 'Entrega parcial',
    description: 'Parte da quantidade solicitada já foi entregue.',
    className: 'border-violet-200 bg-violet-50 text-violet-900',
  },
  FULFILLED: {
    label: 'Entregue',
    description: 'Toda a quantidade solicitada foi entregue.',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  },
  CANCELLED: {
    label: 'Cancelada',
    description: 'Esta solicitação foi cancelada.',
    className: 'border-slate-200 bg-slate-100 text-slate-700',
  },
};

function getRequestStatus(status: string) {
  return requestStatusLabels[status] ?? {
    label: status.replaceAll('_', ' '),
    description: 'Consulte a secretaria se precisar de mais informações.',
    className: 'border-slate-200 bg-slate-100 text-slate-700',
  };
}

function formatRequestQuantity(quantity: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(quantity);
}

function idempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}

function displayError(error: unknown): string {
  if (error instanceof Error && error.message) {
    const friendlyErrors: Array<[string, string]> = [
      ['INVENTORY_COUNT_ALREADY_OPEN', 'Já existe uma contagem aberta neste local. Atualize a página para continuar nela.'],
      ['INVENTORY_COUNT_IN_PROGRESS', 'Há uma contagem física aberta neste local. Finalize ou cancele a contagem antes de alterar o estoque.'],
      ['INVENTORY_COUNT_INCOMPLETE', 'Informe e salve a contagem de todos os materiais antes de reconciliar o estoque.'],
      ['INVENTORY_COUNT_NOT_OPEN', 'Esta contagem não está mais aberta. Atualize a página.'],
      ['INVENTORY_COUNT_ALREADY_FINALIZED', 'Esta contagem já foi finalizada. Atualize a página.'],
    ];
    return friendlyErrors.find(([code]) => error.message.includes(code))?.[1] ?? error.message;
  }
  return 'Não foi possível concluir a operação. Tente novamente.';
}

function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function dateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function InventoryPage() {
  const { currentInstitutionId, currentRole, currentInstitution } = useInstitution();
  const { profile } = useAuth();
  const role = currentRole?.toUpperCase() ?? '';
  const canManage = role === 'DIRECTOR' || role === 'SECRETARY';
  const isTeacher = role === 'TEACHER';
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [requests, setRequests] = useState<InventoryRequest[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [countSessions, setCountSessions] = useState<InventoryCountSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [catalogPage, setCatalogPage] = useState(0);
  const [reportStartDate, setReportStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return dateInputValue(date);
  });
  const [reportEndDate, setReportEndDate] = useState(() => dateInputValue(new Date()));
  const [newItem, setNewItem] = useState({
    name: '', category: '', unit: 'unidade', location: 'Almoxarifado',
    supplier: '', supplierContact: '', sku: '', description: '', minimumQuantity: '0', initialQuantity: '0',
  });

  const load = useCallback(async () => {
    if (!currentInstitutionId) {
      setItems([]);
      setLocations([]);
      setRequests([]);
      setMovements([]);
      setCountSessions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await inventoryService.list(currentInstitutionId);
      setItems(result.items);
      setLocations(result.locations);
      setRequests(result.requests);
      setMovements(result.movements);
      setCountSessions(result.countSessions);
    } catch (loadError) {
      setError(displayError(loadError));
    } finally {
      setLoading(false);
    }
  }, [currentInstitutionId]);

  useEffect(() => { void load(); }, [load]);

  const visibleItems = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('pt-BR');
    return items.filter((item) => (canManage || item.active)
      && (categoryFilter === 'ALL' || item.category === categoryFilter)
      && (!needle || [item.name, item.category, item.sku ?? '', item.default_location]
        .some((value) => value.toLocaleLowerCase('pt-BR').includes(needle))));
  }, [canManage, categoryFilter, items, search]);
  const catalogCategories = useMemo(() => [...new Set<string>(items
    .filter((item) => canManage || item.active)
    .map((item) => item.category.trim())
    .filter((category) => category.length > 0))].sort((left, right) => left.localeCompare(right, 'pt-BR')),
  [canManage, items]);
  const catalogPageCount = Math.ceil(visibleItems.length / INVENTORY_PAGE_SIZE);
  const currentCatalogPage = Math.min(catalogPage, Math.max(0, catalogPageCount - 1));
  const pagedItems = visibleItems.slice(
    currentCatalogPage * INVENTORY_PAGE_SIZE,
    (currentCatalogPage + 1) * INVENTORY_PAGE_SIZE,
  );
  const lowStockCount = items.filter((item) => item.active && item.stock <= item.minimum_quantity).length;
  const pendingRequestCount = requests.filter((request) => request.status === 'PENDING').length;
  const openCountLocationIds = new Set(countSessions
    .filter((session) => session.status === 'OPEN')
    .map((session) => session.location_id));

  function downloadReport() {
    const rows = [
      ['Material', 'Categoria', 'Código', 'Unidade', 'Fornecedor', 'Contato do fornecedor', 'Local', 'Quantidade', 'Estoque mínimo', 'Status'],
      ...items.flatMap((item) => {
        const balances = item.location_balances.length
          ? item.location_balances
          : [{ location_id: item.default_location_id, location_name: item.default_location, quantity: 0 }];
        return balances.map((balance) => [
          item.name, item.category, item.sku ?? '', item.unit, item.supplier ?? '', item.supplier_contact ?? '',
          balance.location_name, balance.quantity, item.minimum_quantity, item.active ? 'Ativo' : 'Inativo',
        ]);
      }),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `almoxarifado-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function downloadMovementReport() {
    if (!currentInstitutionId) return;
    setReporting(true);
    setError(null);
    setNotice(null);
    try {
      const report = await inventoryService.listMovementReport({
        institutionId: currentInstitutionId,
        startDate: reportStartDate,
        endDate: reportEndDate,
      });
      const rows = [
        ['Data', 'Material', 'Local', 'Operação', 'Variação', 'Saldo após operação', 'Observação', 'Responsável (ID)'],
        ...report.map((movement) => [
          new Date(movement.created_at).toLocaleString('pt-BR'), movement.item_name,
          movement.location_name, movement.movement_type, movement.quantity_delta,
          movement.balance_after, movement.note ?? '', movement.performed_by,
        ]),
      ];
      const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}`;
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `movimentacoes-almoxarifado-${reportStartDate}-${reportEndDate}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setNotice(`Relatório exportado com ${report.length} movimentação(ões).`);
    } catch (reportError) {
      setError(displayError(reportError));
    } finally {
      setReporting(false);
    }
  }

  async function submit(operation: () => Promise<void>, message: string): Promise<boolean> {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await operation();
      setNotice(message);
      await load();
      return true;
    } catch (operationError) {
      setError(displayError(operationError));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentInstitutionId) return;
    await submit(async () => {
      await inventoryService.createItem({
        institutionId: currentInstitutionId,
        name: newItem.name.trim(), category: newItem.category.trim(),
        unit: newItem.unit.trim(), location: newItem.location.trim(),
        supplier: newItem.supplier.trim(), sku: newItem.sku.trim(),
        supplierContact: newItem.supplierContact.trim(),
        description: newItem.description.trim(),
        minimumQuantity: Number(newItem.minimumQuantity),
        initialQuantity: Number(newItem.initialQuantity),
        idempotencyKey: idempotencyKey(),
      });
      setNewItem({ name: '', category: '', unit: 'unidade', location: 'Almoxarifado', supplier: '', supplierContact: '', sku: '', description: '', minimumQuantity: '0', initialQuantity: '0' });
    }, 'Material cadastrado.');
  }

  async function changeStock(item: InventoryItem, form: HTMLFormElement) {
    if (!currentInstitutionId) return;
    const data = new FormData(form);
    const action = String(data.get('action')) as StockAction;
    const quantity = Number(data.get('quantity'));
    const note = String(data.get('note') ?? '').trim();
    const locationId = String(data.get('location_id') ?? '');
    if (!Number.isFinite(quantity) || quantity === 0 || (action !== 'ADJUSTMENT' && quantity < 0)) {
      setError(action === 'ADJUSTMENT' ? 'Informe um ajuste diferente de zero.' : 'Informe uma quantidade maior que zero.');
      return;
    }
    if (!locationId || (action === 'TRANSFER' && !String(data.get('destination_location_id') ?? ''))) {
      setError('Selecione o local da operação.');
      return;
    }
    if (action === 'TRANSFER' && locationId === String(data.get('destination_location_id'))) {
      setError('O local de origem e o destino precisam ser diferentes.');
      return;
    }
    if ((action === 'ADJUSTMENT' || action === 'TRANSFER') && note.length < 3) {
      setError(action === 'ADJUSTMENT' ? 'Informe a justificativa do ajuste.' : 'Informe o motivo da transferência.');
      return;
    }
    const key = idempotencyKey();
    const succeeded = action === 'TRANSFER'
      ? await submit(() => inventoryService.transferStock({
        institutionId: currentInstitutionId,
        itemId: item.id,
        sourceLocationId: locationId,
        destinationLocationId: String(data.get('destination_location_id') ?? ''),
        quantity,
        note,
        idempotencyKey: key,
      }), 'Transferência registrada.')
      : await submit(() => inventoryService.moveStock({
        institutionId: currentInstitutionId,
        itemId: item.id,
        locationId,
        type: action as Exclude<StockAction, 'TRANSFER'>,
        quantity,
        note,
        idempotencyKey: key,
      }), {
        RECEIPT: 'Entrada registrada.',
        ISSUE: 'Saída registrada.',
        RETURN: 'Devolução registrada.',
        ADJUSTMENT: 'Ajuste registrado.',
        TRANSFER: 'Transferência registrada.',
      }[action]);
    if (succeeded) form.reset();
  }

  async function setItemActive(item: InventoryItem) {
    if (!currentInstitutionId) return;
    await submit(() => inventoryService.setItemActive({
      institutionId: currentInstitutionId,
      itemId: item.id,
      active: !item.active,
      idempotencyKey: idempotencyKey(),
    }), item.active ? 'Material desativado; histórico preservado.' : 'Material reativado.');
  }

  async function requestItem(item: InventoryItem, form: HTMLFormElement) {
    if (!currentInstitutionId || !profile?.id) return;
    const data = new FormData(form);
    const quantity = Number(data.get('quantity'));
    const note = String(data.get('note') ?? '').trim();
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError('Informe uma quantidade maior que zero.');
      return;
    }
    const succeeded = await submit(() => inventoryService.requestItem({
      institutionId: currentInstitutionId,
      itemId: item.id,
      quantity,
      note,
      idempotencyKey: idempotencyKey(),
    }), 'Solicitação enviada para aprovação.');
    if (succeeded) form.reset();
  }

  async function decide(request: InventoryRequest, decision: 'APPROVED' | 'REJECTED') {
    if (!currentInstitutionId) return;
    await submit(() => inventoryService.decideRequest({
      institutionId: currentInstitutionId,
      requestId: request.id,
      decision,
      idempotencyKey: idempotencyKey(),
    }), decision === 'APPROVED' ? 'Solicitação aprovada.' : 'Solicitação recusada.');
  }

  async function cancelRequest(request: InventoryRequest) {
    if (!currentInstitutionId) return;
    await submit(() => inventoryService.cancelRequest({
      institutionId: currentInstitutionId,
      requestId: request.id,
      idempotencyKey: idempotencyKey(),
    }), 'Solicitação cancelada.');
  }

  async function fulfill(request: InventoryRequest, form: HTMLFormElement) {
    if (!currentInstitutionId) return;
    const data = new FormData(form);
    const quantity = Number(data.get('quantity'));
    const locationId = String(data.get('location_id') ?? '');
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError('Informe uma quantidade maior que zero.');
      return;
    }
    const succeeded = await submit(() => inventoryService.fulfillRequest({
      institutionId: currentInstitutionId,
      requestId: request.id,
      requestItemId: request.request_item_id,
      locationId,
      quantity,
      idempotencyKey: idempotencyKey(),
    }), 'Entrega registrada no estoque.');
    if (succeeded) form.reset();
  }

  async function startCount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentInstitutionId) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const locationId = String(data.get('count_location_id') ?? '');
    if (!locationId) {
      setError('Selecione o local da contagem.');
      return;
    }
    const succeeded = await submit(() => inventoryService.startCount({
      institutionId: currentInstitutionId,
      locationId,
      note: String(data.get('count_note') ?? '').trim(),
      idempotencyKey: idempotencyKey(),
    }), 'Contagem aberta. As operações de estoque deste local ficarão pausadas até finalizar ou cancelar.');
    if (succeeded) form.reset();
  }

  async function saveCount(session: InventoryCountSession, form: HTMLFormElement) {
    const data = new FormData(form);
    const lines = session.lines.map((line) => {
      const raw = String(data.get(`counted-${line.id}`) ?? '').trim();
      return { lineId: line.id, countedQuantity: raw === '' ? Number.NaN : Number(raw) };
    });
    if (lines.some((line) => !Number.isFinite(line.countedQuantity) || line.countedQuantity < 0)) {
      setError('Informe uma contagem válida para cada material.');
      return;
    }
    await submit(() => inventoryService.saveCount({
      sessionId: session.id,
      lines,
      idempotencyKey: idempotencyKey(),
    }), 'Contagens salvas. Revise os valores antes de reconciliar o estoque.');
  }

  async function finalizeCount(session: InventoryCountSession) {
    if (session.lines.some((line) => line.counted_quantity === null)) {
      setError('Salve a contagem de todos os materiais antes de finalizar.');
      return;
    }
    if (!window.confirm(`Finalizar a contagem de ${session.location_name}? O saldo será ajustado para as quantidades contadas e registrado no histórico.`)) return;
    await submit(() => inventoryService.finalizeCount({
      sessionId: session.id,
      idempotencyKey: idempotencyKey(),
    }), 'Contagem finalizada e saldos reconciliados com trilha de auditoria.');
  }

  async function cancelCount(session: InventoryCountSession) {
    if (!window.confirm(`Cancelar a contagem de ${session.location_name}? Nenhum saldo será alterado e as operações do local serão liberadas.`)) return;
    await submit(() => inventoryService.cancelCount({
      sessionId: session.id,
      idempotencyKey: idempotencyKey(),
    }), 'Contagem cancelada; o estoque do local foi liberado.');
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
      <header className="rounded-2xl bg-gradient-to-r from-[#075fbd] to-[#1684d8] p-6 text-white shadow-sm sm:p-8">
        <div className="flex items-start gap-4">
          <span className="rounded-xl bg-white/15 p-3"><Boxes className="h-7 w-7" aria-hidden="true" /></span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-100">Operação escolar</p>
            <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">Almoxarifado</h1>
            <p className="mt-2 max-w-3xl text-sm text-blue-50">Materiais, saldos, movimentações e solicitações{currentInstitution?.name ? ` de ${currentInstitution.name}` : ''}.</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="ml-auto inline-flex h-10 items-center gap-2 rounded-lg border border-white/40 px-3 text-sm font-bold hover:bg-white/10 disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" /> Atualizar
          </button>
        </div>
      </header>

      {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</div> : null}
      {notice ? <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</div> : null}

      <section aria-label="Resumo do estoque" className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Materiais ativos</p><p className="mt-1 text-2xl font-extrabold text-slate-900">{items.filter((item) => item.active).length}</p></div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-amber-800">Abaixo do mínimo</p><p className="mt-1 text-2xl font-extrabold text-amber-900">{lowStockCount}</p></div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-blue-800">Solicitações pendentes</p><p className="mt-1 text-2xl font-extrabold text-blue-900">{pendingRequestCount}</p></div>
      </section>

      {canManage ? (
        <section className="rounded-2xl border border-[#d8deea] bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <PackagePlus className="h-5 w-5 text-[#075fbd]" aria-hidden="true" />
            <div><h2 className="text-lg font-extrabold text-slate-900">Cadastrar material</h2><p className="text-sm text-slate-600">Novas categorias, unidades, locais e fornecedores são criados ou reutilizados pelo nome.</p></div>
          </div>
          <form onSubmit={createItem} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm font-semibold text-slate-700">Material<input required minLength={2} maxLength={180} value={newItem.name} onChange={(event) => setNewItem({ ...newItem, name: event.target.value })} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal" /></label>
            <label className="text-sm font-semibold text-slate-700">Categoria<input required minLength={2} maxLength={100} value={newItem.category} onChange={(event) => setNewItem({ ...newItem, category: event.target.value })} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal" /></label>
            <label className="text-sm font-semibold text-slate-700">Unidade<input required value={newItem.unit} onChange={(event) => setNewItem({ ...newItem, unit: event.target.value })} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal" placeholder="unidade, caixa, pacote..." /></label>
            <label className="text-sm font-semibold text-slate-700">Local inicial<input required minLength={2} value={newItem.location} onChange={(event) => setNewItem({ ...newItem, location: event.target.value })} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal" /></label>
            <label className="text-sm font-semibold text-slate-700">Fornecedor (opcional)<input value={newItem.supplier} onChange={(event) => setNewItem({ ...newItem, supplier: event.target.value })} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal" /></label>
            <label className="text-sm font-semibold text-slate-700">Contato do fornecedor (opcional)<input value={newItem.supplierContact} onChange={(event) => setNewItem({ ...newItem, supplierContact: event.target.value })} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal" /></label>
            <label className="text-sm font-semibold text-slate-700">Código / SKU (opcional)<input value={newItem.sku} onChange={(event) => setNewItem({ ...newItem, sku: event.target.value })} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal" /></label>
            <label className="text-sm font-semibold text-slate-700">Estoque mínimo<input type="number" min="0" step="0.001" value={newItem.minimumQuantity} onChange={(event) => setNewItem({ ...newItem, minimumQuantity: event.target.value })} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal" /></label>
            <label className="text-sm font-semibold text-slate-700">Saldo inicial<input type="number" min="0" step="0.001" value={newItem.initialQuantity} onChange={(event) => setNewItem({ ...newItem, initialQuantity: event.target.value })} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal" /></label>
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2 lg:col-span-3">Descrição (opcional)<textarea rows={2} value={newItem.description} onChange={(event) => setNewItem({ ...newItem, description: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
            <div className="sm:col-span-2 lg:col-span-3"><button disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#075fbd] px-5 font-bold text-white hover:bg-[#064f9d] disabled:opacity-60"><PackagePlus className="h-4 w-4" aria-hidden="true" />{saving ? 'Salvando...' : 'Cadastrar material'}</button></div>
          </form>
        </section>
      ) : null}

      {canManage ? (
        <section aria-labelledby="physical-count-heading" className="rounded-2xl border border-[#d8deea] bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-start gap-3">
            <ClipboardList className="mt-1 h-5 w-5 text-[#075fbd]" aria-hidden="true" />
            <div>
              <h2 id="physical-count-heading" className="text-lg font-extrabold text-slate-900">Inventário físico</h2>
              <p className="text-sm text-slate-600">Confira o saldo de cada material por local. A reconciliação gera movimentações auditadas.</p>
            </div>
          </div>
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Enquanto uma contagem estiver aberta, entradas, saídas, transferências e alterações de materiais ficam pausadas naquele local.
          </p>
          <form onSubmit={(event) => void startCount(event)} className="mb-5 flex flex-wrap items-end gap-3">
            <label className="text-sm font-semibold text-slate-700">Local da contagem
              <select name="count_location_id" required defaultValue="" className="mt-1 block h-11 min-w-52 rounded-lg border border-slate-300 px-3">
                <option value="" disabled>Selecione um local</option>
                {locations.map((location) => <option key={location.id} value={location.id} disabled={openCountLocationIds.has(location.id)}>{location.name}{openCountLocationIds.has(location.id) ? ' · contagem aberta' : ''}</option>)}
              </select>
            </label>
            <label className="min-w-60 flex-1 text-sm font-semibold text-slate-700">Observação (opcional)
              <input name="count_note" maxLength={500} className="mt-1 block h-11 w-full rounded-lg border border-slate-300 px-3 font-normal" placeholder="Ex.: conferência do fim do mês" />
            </label>
            <button disabled={saving || locations.length === 0} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#075fbd] px-4 font-bold text-white disabled:opacity-60">
              <ClipboardList className="h-4 w-4" aria-hidden="true" />Abrir contagem
            </button>
          </form>
          {countSessions.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-600">Nenhuma contagem física registrada.</p> : (
            <ul className="space-y-4">
              {countSessions.map((session) => (
                <li key={session.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900">{session.location_name} <span className={`ml-2 rounded-full px-2 py-1 text-xs ${session.status === 'OPEN' ? 'bg-amber-100 text-amber-900' : session.status === 'FINALIZED' ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-700'}`}>{session.status === 'OPEN' ? 'Em andamento' : session.status === 'FINALIZED' ? 'Finalizada' : 'Cancelada'}</span></h3>
                      <p className="mt-1 text-xs text-slate-500">Aberta em {new Date(session.created_at).toLocaleString('pt-BR')}{session.note ? ` · ${session.note}` : ''}</p>
                    </div>
                    {session.status === 'OPEN' ? <div className="flex gap-2">
                      <button type="button" onClick={() => void finalizeCount(session)} disabled={saving || session.lines.some((line) => line.counted_quantity === null)} className="min-h-10 rounded-lg bg-emerald-700 px-3 text-sm font-bold text-white disabled:opacity-50">Reconciliar e finalizar</button>
                      <button type="button" onClick={() => void cancelCount(session)} disabled={saving} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 disabled:opacity-50">Cancelar contagem</button>
                    </div> : null}
                  </div>
                  {session.status === 'OPEN' ? (
                    <form onSubmit={(event) => { event.preventDefault(); void saveCount(session, event.currentTarget); }} className="mt-4">
                      {session.lines.length === 0 ? <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Não há materiais ativos neste local para contar.</p> : <div className="overflow-x-auto">
                        <table className="w-full min-w-[560px] text-left text-sm">
                          <thead><tr className="border-b text-xs uppercase tracking-wide text-slate-500"><th className="py-2 pr-3">Material</th><th className="py-2 pr-3">Saldo esperado</th><th className="py-2">Contagem física</th></tr></thead>
                          <tbody>{session.lines.map((line) => <tr key={line.id} className="border-b last:border-0"><td className="py-2 pr-3 font-medium text-slate-800">{line.item_name}</td><td className="py-2 pr-3">{line.expected_quantity} {line.unit}</td><td className="py-2"><label className="sr-only" htmlFor={`counted-${line.id}`}>Contagem física de {line.item_name}</label><input id={`counted-${line.id}`} name={`counted-${line.id}`} type="number" min="0" step="0.001" required defaultValue={line.counted_quantity ?? ''} className="h-10 w-40 rounded-lg border border-slate-300 px-3" /></td></tr>)}</tbody>
                        </table>
                      </div>}
                      <button disabled={saving || session.lines.length === 0} className="mt-4 min-h-10 rounded-lg border border-[#075fbd] px-4 text-sm font-bold text-[#075fbd] disabled:opacity-50">Salvar contagens</button>
                    </form>
                  ) : session.status === 'FINALIZED' ? <p className="mt-3 text-sm text-emerald-800">Concluída em {session.finalized_at ? new Date(session.finalized_at).toLocaleString('pt-BR') : '—'} · diferenças registradas no histórico de movimentações.</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section className="rounded-2xl border border-[#d8deea] bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-lg font-extrabold text-slate-900">Catálogo de materiais</h2><p className="text-sm text-slate-600">{items.filter((item) => item.active).length} material(is) ativo(s). O saldo é atualizado somente por operações auditadas.</p></div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto"><label className="relative block min-w-60 flex-1 sm:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><span className="sr-only">Pesquisar materiais</span><input value={search} onChange={(event) => { setSearch(event.target.value); setCatalogPage(0); }} placeholder="Pesquisar material, categoria ou código" className="min-h-11 w-full rounded-lg border border-slate-300 pl-9 pr-3" /></label><label className="text-sm font-semibold text-slate-700"><span className="sr-only">Filtrar por categoria</span><select aria-label="Filtrar por categoria" value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setCatalogPage(0); }} className="min-h-11 min-w-44 rounded-lg border border-slate-300 bg-white px-3"><option value="ALL">Todas as categorias</option>{catalogCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label><button type="button" onClick={downloadReport} disabled={items.length === 0} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Download className="h-4 w-4" aria-hidden="true" />Exportar CSV</button></div>
        </div>
        {loading ? <p role="status" className="py-8 text-center text-sm text-slate-600">Carregando catálogo...</p> : visibleItems.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">{items.length ? 'Nenhum material corresponde à pesquisa.' : 'Ainda não há materiais cadastrados nesta instituição.'}</p> : (
          <ul className="space-y-3">
            {pagedItems.map((item) => (
              <li key={item.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h3 className="font-bold text-slate-900">{item.name} {!item.active ? <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">Inativo</span> : null}</h3><p className="mt-1 text-sm text-slate-600">{item.category} · {item.unit}{item.sku ? ` · ${item.sku}` : ''} · local padrão: {item.default_location}</p>{item.supplier ? <p className="text-xs text-slate-500">Fornecedor: {item.supplier}{item.supplier_contact ? ` · ${item.supplier_contact}` : ''}</p> : null}</div>
                  <div className="text-right"><p className={`text-lg font-extrabold ${item.stock <= item.minimum_quantity ? 'text-amber-700' : 'text-slate-900'}`}>{item.stock} <span className="text-sm font-semibold">{item.unit}</span></p><p className="text-xs text-slate-500">mínimo: {item.minimum_quantity}</p></div>
                </div>
                {item.location_balances.length ? <div className="mt-3 flex flex-wrap gap-2" aria-label={`Saldos por local de ${item.name}`}>{item.location_balances.map((balance) => <span key={balance.location_id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"><MapPin className="h-3 w-3" aria-hidden="true" />{balance.location_name}: {balance.quantity} {item.unit}</span>)}</div> : null}
                {canManage ? <div className="mt-4 border-t border-slate-100 pt-4"><form className="flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); void changeStock(item, event.currentTarget); }}>
                  <label className="text-xs font-semibold text-slate-600">Operação<select name="action" className="mt-1 block h-10 rounded-lg border border-slate-300 px-2 text-sm"><option value="RECEIPT">Entrada</option><option value="ISSUE">Saída</option><option value="RETURN">Devolução</option><option value="ADJUSTMENT">Ajuste de inventário</option><option value="TRANSFER">Transferência</option></select></label>
                  <label className="text-xs font-semibold text-slate-600">Local de origem / operação<select name="location_id" defaultValue={openCountLocationIds.has(item.default_location_id) ? locations.find((location) => !openCountLocationIds.has(location.id))?.id ?? '' : item.default_location_id} required className="mt-1 block h-10 min-w-40 rounded-lg border border-slate-300 px-2 text-sm"><option value="" disabled>Selecione</option>{locations.map((location) => <option key={location.id} value={location.id} disabled={openCountLocationIds.has(location.id)}>{location.name}{openCountLocationIds.has(location.id) ? ' · contagem aberta' : ''}</option>)}</select></label>
                  <label className="text-xs font-semibold text-slate-600">Destino (transferência)<select name="destination_location_id" defaultValue={locations.find((location) => location.id !== item.default_location_id && !openCountLocationIds.has(location.id))?.id ?? ''} className="mt-1 block h-10 min-w-40 rounded-lg border border-slate-300 px-2 text-sm"><option value="">Selecione</option>{locations.map((location) => <option key={location.id} value={location.id} disabled={openCountLocationIds.has(location.id)}>{location.name}{openCountLocationIds.has(location.id) ? ' · contagem aberta' : ''}</option>)}</select></label>
                  <label className="text-xs font-semibold text-slate-600">Quantidade<input name="quantity" type="number" min="-999999999" step="0.001" required className="mt-1 block h-10 w-32 rounded-lg border border-slate-300 px-2 text-sm" /></label>
                  <label className="text-xs font-semibold text-slate-600">Observação / justificativa<input name="note" maxLength={500} className="mt-1 block h-10 min-w-40 rounded-lg border border-slate-300 px-2 text-sm" /></label>
                  <button disabled={saving || !item.active} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#075fbd] px-3 text-sm font-bold text-white disabled:opacity-60"><ArrowDownToLine className="h-4 w-4" aria-hidden="true" />Registrar operação</button>
                </form><button type="button" onClick={() => void setItemActive(item)} disabled={saving || openCountLocationIds.has(item.default_location_id)} className="mt-3 min-h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">{item.active ? 'Desativar material' : 'Reativar material'}{openCountLocationIds.has(item.default_location_id) ? ' · contagem aberta' : ''}</button></div> : isTeacher ? <form className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4" onSubmit={(event) => { event.preventDefault(); void requestItem(item, event.currentTarget); }}>
                  <label className="text-xs font-semibold text-slate-600">Quantidade solicitada<input name="quantity" type="number" min="0.001" step="0.001" required className="mt-1 block h-10 w-40 rounded-lg border border-slate-300 px-2 text-sm" /></label>
                  <label className="text-xs font-semibold text-slate-600">Observação<input name="note" maxLength={500} className="mt-1 block h-10 min-w-40 rounded-lg border border-slate-300 px-2 text-sm" /></label>
                  <button disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#075fbd] px-3 text-sm font-bold text-white hover:bg-[#064f9d] disabled:opacity-60"><ClipboardList className="h-4 w-4" aria-hidden="true" />Solicitar</button>
                </form> : null}
              </li>
            ))}
          </ul>
        )}
        {!loading && visibleItems.length > 0 && catalogPageCount > 1 ? <nav aria-label="Paginação do catálogo" className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p aria-live="polite" className="text-sm text-slate-600">Mostrando {currentCatalogPage * INVENTORY_PAGE_SIZE + 1}–{Math.min((currentCatalogPage + 1) * INVENTORY_PAGE_SIZE, visibleItems.length)} de {visibleItems.length} materiais</p>
          <div className="flex items-center gap-2"><button type="button" aria-label="Página anterior" onClick={() => setCatalogPage((page) => Math.max(0, page - 1))} disabled={currentCatalogPage === 0} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 disabled:opacity-50">Anterior</button><span className="min-w-24 text-center text-sm text-slate-600">Página {currentCatalogPage + 1} de {catalogPageCount}</span><button type="button" aria-label="Próxima página" onClick={() => setCatalogPage((page) => Math.min(catalogPageCount - 1, page + 1))} disabled={currentCatalogPage >= catalogPageCount - 1} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 disabled:opacity-50">Próxima</button></div>
        </nav> : null}
      </section>

      <section className="rounded-2xl border border-[#d8deea] bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-4 text-lg font-extrabold text-slate-900">{canManage ? 'Solicitações da instituição' : 'Minhas solicitações'}</h2>
        {requests.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">Nenhuma solicitação encontrada.</p> : <ul className="space-y-3">{requests.map((request) => {
          const status = getRequestStatus(request.status);
          const requested = Number(request.requested_quantity) || 0;
          const fulfilled = Number(request.fulfilled_quantity) || 0;
          const progress = requested > 0 ? Math.min(100, Math.max(0, (fulfilled / requested) * 100)) : 0;
          return <li key={request.request_item_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"><div className="min-w-64 flex-1"><p className="font-bold text-slate-900">{request.item_name} · {formatRequestQuantity(request.requested_quantity)} {request.unit}</p><span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${status.className}`}>{status.label}</span><p className="mt-2 text-sm text-slate-600">{status.description}</p><p className="mt-1 text-sm font-semibold text-slate-700">Entregue: {formatRequestQuantity(request.fulfilled_quantity)} de {formatRequestQuantity(request.requested_quantity)}</p><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={`Progresso da entrega de ${request.item_name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-valuetext={`${formatRequestQuantity(request.fulfilled_quantity)} de ${formatRequestQuantity(request.requested_quantity)} ${request.unit} entregues`}><div className="h-full rounded-full bg-[#075fbd] transition-[width]" style={{ width: `${progress}%` }} /></div>{canManage ? <p className="mt-2 text-xs text-slate-500">Solicitante {request.requester_id.slice(0, 8)}</p> : null}{request.note ? <p className="mt-1 text-sm text-slate-500">Observação: {request.note}</p> : null}</div>
          {canManage && request.status === 'PENDING' ? <div className="flex gap-2"><button type="button" disabled={saving} onClick={() => void decide(request, 'APPROVED')} className="inline-flex h-10 items-center gap-1 rounded-lg bg-emerald-700 px-3 text-sm font-bold text-white disabled:opacity-60"><Check className="h-4 w-4" aria-hidden="true" />Aprovar</button><button type="button" disabled={saving} onClick={() => void decide(request, 'REJECTED')} className="inline-flex h-10 items-center gap-1 rounded-lg border border-red-300 px-3 text-sm font-bold text-red-800 disabled:opacity-60"><X className="h-4 w-4" aria-hidden="true" />Recusar</button></div> : null}
          {canManage && ['APPROVED', 'PARTIALLY_FULFILLED'].includes(request.status) ? <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); void fulfill(request, event.currentTarget); }}><label className="text-xs font-semibold text-slate-600">Retirar de<select name="location_id" defaultValue={openCountLocationIds.has(request.location_id) ? locations.find((location) => !openCountLocationIds.has(location.id))?.id ?? '' : request.location_id} required className="mt-1 block h-10 min-w-36 rounded-lg border border-slate-300 px-2 text-sm"><option value="" disabled>Selecione</option>{locations.map((location) => <option key={location.id} value={location.id} disabled={openCountLocationIds.has(location.id)}>{location.name}{openCountLocationIds.has(location.id) ? ' · contagem aberta' : ''}</option>)}</select></label><label className="text-xs font-semibold text-slate-600">Entregar<input name="quantity" type="number" min="0.001" max={request.requested_quantity - request.fulfilled_quantity} step="0.001" defaultValue={request.requested_quantity - request.fulfilled_quantity} required className="mt-1 block h-10 w-28 rounded-lg border border-slate-300 px-2 text-sm" /></label><button disabled={saving} className="h-10 rounded-lg bg-[#075fbd] px-3 text-sm font-bold text-white disabled:opacity-60">Registrar entrega</button></form> : null}
          {isTeacher && request.status === 'PENDING' && request.requester_id === profile?.id ? <button type="button" disabled={saving} onClick={() => void cancelRequest(request)} className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 disabled:opacity-60">Cancelar solicitação</button> : null}</li>;
        })}</ul>}
      </section>

      {canManage ? <section className="rounded-2xl border border-[#d8deea] bg-white p-5 shadow-sm sm:p-6"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-extrabold text-slate-900">Movimentações recentes</h2><p className="text-sm text-slate-600">Exporte o histórico completo de um período; a tabela abaixo mostra as últimas 100 movimentações.</p></div><form onSubmit={(event) => { event.preventDefault(); void downloadMovementReport(); }} className="flex flex-wrap items-end gap-2"><label className="text-xs font-semibold text-slate-600">De<input type="date" value={reportStartDate} max={reportEndDate} onChange={(event) => setReportStartDate(event.target.value)} required className="mt-1 block h-10 rounded-lg border border-slate-300 px-2 text-sm" /></label><label className="text-xs font-semibold text-slate-600">Até<input type="date" value={reportEndDate} min={reportStartDate} onChange={(event) => setReportEndDate(event.target.value)} required className="mt-1 block h-10 rounded-lg border border-slate-300 px-2 text-sm" /></label><button disabled={reporting || !reportStartDate || !reportEndDate} className="h-10 rounded-lg border border-[#075fbd] px-3 text-sm font-bold text-[#075fbd] disabled:opacity-50"><Download className="mr-1 inline h-4 w-4" aria-hidden="true" />{reporting ? 'Gerando...' : 'Exportar período'}</button></form></div>{movements.length === 0 ? <p className="text-sm text-slate-600">Nenhuma movimentação registrada.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b text-xs uppercase tracking-wide text-slate-500"><th className="py-2 pr-3">Data</th><th className="py-2 pr-3">Material</th><th className="py-2 pr-3">Operação</th><th className="py-2 pr-3">Variação</th><th className="py-2 pr-3">Saldo</th><th className="py-2">Responsável (ID)</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement.id} className="border-b last:border-0"><td className="py-3 pr-3">{new Date(movement.created_at).toLocaleString('pt-BR')}</td><td className="py-3 pr-3">{movement.item_name}</td><td className="py-3 pr-3">{movement.movement_type} · {movement.location_name}</td><td className="py-3 pr-3">{movement.quantity_delta > 0 ? '+' : ''}{movement.quantity_delta}</td><td className="py-3 pr-3">{movement.balance_after}</td><td className="py-3" title={movement.performed_by}>{movement.performed_by.slice(0, 8)}</td></tr>)}</tbody></table></div>}</section> : null}
    </main>
  );
}
