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
  type InventoryLocation,
  type InventoryMovement,
  type InventoryRequest,
} from '../../services/inventoryService';

type StockAction = 'RECEIPT' | 'ISSUE' | 'RETURN' | 'ADJUSTMENT' | 'TRANSFER';

function idempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}

function displayError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Não foi possível concluir a operação. Tente novamente.';
}

function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
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
    } catch (loadError) {
      setError(displayError(loadError));
    } finally {
      setLoading(false);
    }
  }, [currentInstitutionId]);

  useEffect(() => { void load(); }, [load]);

  const visibleItems = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('pt-BR');
    return items.filter((item) => (canManage || item.active) && (!needle ||
      [item.name, item.category, item.sku ?? '', item.default_location]
        .some((value) => value.toLocaleLowerCase('pt-BR').includes(needle))));
  }, [canManage, items, search]);
  const lowStockCount = items.filter((item) => item.active && item.stock <= item.minimum_quantity).length;
  const pendingRequestCount = requests.filter((request) => request.status === 'PENDING').length;

  function downloadReport() {
    const rows = [
      ['Material', 'Categoria', 'Código', 'Unidade', 'Local', 'Quantidade', 'Estoque mínimo', 'Status'],
      ...items.flatMap((item) => {
        const balances = item.location_balances.length
          ? item.location_balances
          : [{ location_id: item.default_location_id, location_name: item.default_location, quantity: 0 }];
        return balances.map((balance) => [
          item.name, item.category, item.sku ?? '', item.unit, balance.location_name,
          balance.quantity, item.minimum_quantity, item.active ? 'Ativo' : 'Inativo',
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

      <section className="rounded-2xl border border-[#d8deea] bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-lg font-extrabold text-slate-900">Catálogo de materiais</h2><p className="text-sm text-slate-600">{items.filter((item) => item.active).length} material(is) ativo(s). O saldo é atualizado somente por operações auditadas.</p></div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto"><label className="relative block min-w-60 flex-1 sm:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><span className="sr-only">Pesquisar materiais</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar material, categoria ou código" className="min-h-11 w-full rounded-lg border border-slate-300 pl-9 pr-3" /></label><button type="button" onClick={downloadReport} disabled={items.length === 0} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Download className="h-4 w-4" aria-hidden="true" />Exportar CSV</button></div>
        </div>
        {loading ? <p role="status" className="py-8 text-center text-sm text-slate-600">Carregando catálogo...</p> : visibleItems.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">{items.length ? 'Nenhum material corresponde à pesquisa.' : 'Ainda não há materiais cadastrados nesta instituição.'}</p> : (
          <ul className="space-y-3">
            {visibleItems.map((item) => (
              <li key={item.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h3 className="font-bold text-slate-900">{item.name} {!item.active ? <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">Inativo</span> : null}</h3><p className="mt-1 text-sm text-slate-600">{item.category} · {item.unit}{item.sku ? ` · ${item.sku}` : ''} · local padrão: {item.default_location}</p>{item.supplier ? <p className="text-xs text-slate-500">Fornecedor: {item.supplier}</p> : null}</div>
                  <div className="text-right"><p className={`text-lg font-extrabold ${item.stock <= item.minimum_quantity ? 'text-amber-700' : 'text-slate-900'}`}>{item.stock} <span className="text-sm font-semibold">{item.unit}</span></p><p className="text-xs text-slate-500">mínimo: {item.minimum_quantity}</p></div>
                </div>
                {item.location_balances.length ? <div className="mt-3 flex flex-wrap gap-2" aria-label={`Saldos por local de ${item.name}`}>{item.location_balances.map((balance) => <span key={balance.location_id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"><MapPin className="h-3 w-3" aria-hidden="true" />{balance.location_name}: {balance.quantity} {item.unit}</span>)}</div> : null}
                {canManage ? <div className="mt-4 border-t border-slate-100 pt-4"><form className="flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); void changeStock(item, event.currentTarget); }}>
                  <label className="text-xs font-semibold text-slate-600">Operação<select name="action" className="mt-1 block h-10 rounded-lg border border-slate-300 px-2 text-sm"><option value="RECEIPT">Entrada</option><option value="ISSUE">Saída</option><option value="RETURN">Devolução</option><option value="ADJUSTMENT">Ajuste de inventário</option><option value="TRANSFER">Transferência</option></select></label>
                  <label className="text-xs font-semibold text-slate-600">Local de origem / operação<select name="location_id" defaultValue={item.default_location_id} required className="mt-1 block h-10 min-w-40 rounded-lg border border-slate-300 px-2 text-sm">{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
                  <label className="text-xs font-semibold text-slate-600">Destino (transferência)<select name="destination_location_id" defaultValue={locations.find((location) => location.id !== item.default_location_id)?.id ?? ''} className="mt-1 block h-10 min-w-40 rounded-lg border border-slate-300 px-2 text-sm"><option value="">Selecione</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
                  <label className="text-xs font-semibold text-slate-600">Quantidade<input name="quantity" type="number" min="-999999999" step="0.001" required className="mt-1 block h-10 w-32 rounded-lg border border-slate-300 px-2 text-sm" /></label>
                  <label className="text-xs font-semibold text-slate-600">Observação / justificativa<input name="note" maxLength={500} className="mt-1 block h-10 min-w-40 rounded-lg border border-slate-300 px-2 text-sm" /></label>
                  <button disabled={saving || !item.active} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#075fbd] px-3 text-sm font-bold text-white disabled:opacity-60"><ArrowDownToLine className="h-4 w-4" aria-hidden="true" />Registrar operação</button>
                </form><button type="button" onClick={() => void setItemActive(item)} disabled={saving} className="mt-3 min-h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">{item.active ? 'Desativar material' : 'Reativar material'}</button></div> : isTeacher ? <form className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4" onSubmit={(event) => { event.preventDefault(); void requestItem(item, event.currentTarget); }}>
                  <label className="text-xs font-semibold text-slate-600">Quantidade solicitada<input name="quantity" type="number" min="0.001" step="0.001" required className="mt-1 block h-10 w-40 rounded-lg border border-slate-300 px-2 text-sm" /></label>
                  <label className="text-xs font-semibold text-slate-600">Observação<input name="note" maxLength={500} className="mt-1 block h-10 min-w-40 rounded-lg border border-slate-300 px-2 text-sm" /></label>
                  <button disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#075fbd] px-3 text-sm font-bold text-white hover:bg-[#064f9d] disabled:opacity-60"><ClipboardList className="h-4 w-4" aria-hidden="true" />Solicitar</button>
                </form> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-[#d8deea] bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-4 text-lg font-extrabold text-slate-900">{canManage ? 'Solicitações da instituição' : 'Minhas solicitações'}</h2>
        {requests.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">Nenhuma solicitação encontrada.</p> : <ul className="space-y-3">{requests.map((request) => <li key={request.request_item_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"><div><p className="font-bold text-slate-900">{request.item_name} · {request.requested_quantity} {request.unit}</p><p className="text-sm text-slate-600">{canManage ? `Solicitante ${request.requester_id.slice(0, 8)} · ` : ''}{request.status.replaceAll('_', ' ')} · entregue {request.fulfilled_quantity} de {request.requested_quantity}</p>{request.note ? <p className="mt-1 text-sm text-slate-500">{request.note}</p> : null}</div>
          {canManage && request.status === 'PENDING' ? <div className="flex gap-2"><button type="button" disabled={saving} onClick={() => void decide(request, 'APPROVED')} className="inline-flex h-10 items-center gap-1 rounded-lg bg-emerald-700 px-3 text-sm font-bold text-white disabled:opacity-60"><Check className="h-4 w-4" aria-hidden="true" />Aprovar</button><button type="button" disabled={saving} onClick={() => void decide(request, 'REJECTED')} className="inline-flex h-10 items-center gap-1 rounded-lg border border-red-300 px-3 text-sm font-bold text-red-800 disabled:opacity-60"><X className="h-4 w-4" aria-hidden="true" />Recusar</button></div> : null}
          {canManage && ['APPROVED', 'PARTIALLY_FULFILLED'].includes(request.status) ? <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); void fulfill(request, event.currentTarget); }}><label className="text-xs font-semibold text-slate-600">Retirar de<select name="location_id" defaultValue={request.location_id} required className="mt-1 block h-10 min-w-36 rounded-lg border border-slate-300 px-2 text-sm">{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label><label className="text-xs font-semibold text-slate-600">Entregar<input name="quantity" type="number" min="0.001" max={request.requested_quantity - request.fulfilled_quantity} step="0.001" defaultValue={request.requested_quantity - request.fulfilled_quantity} required className="mt-1 block h-10 w-28 rounded-lg border border-slate-300 px-2 text-sm" /></label><button disabled={saving} className="h-10 rounded-lg bg-[#075fbd] px-3 text-sm font-bold text-white disabled:opacity-60">Registrar entrega</button></form> : null}
          {isTeacher && request.status === 'PENDING' && request.requester_id === profile?.id ? <button type="button" disabled={saving} onClick={() => void cancelRequest(request)} className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 disabled:opacity-60">Cancelar solicitação</button> : null}</li>)}</ul>}
      </section>

      {canManage ? <section className="rounded-2xl border border-[#d8deea] bg-white p-5 shadow-sm sm:p-6"><h2 className="mb-4 text-lg font-extrabold text-slate-900">Movimentações recentes</h2>{movements.length === 0 ? <p className="text-sm text-slate-600">Nenhuma movimentação registrada.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b text-xs uppercase tracking-wide text-slate-500"><th className="py-2 pr-3">Data</th><th className="py-2 pr-3">Material</th><th className="py-2 pr-3">Operação</th><th className="py-2 pr-3">Variação</th><th className="py-2 pr-3">Saldo</th><th className="py-2">Responsável (ID)</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement.id} className="border-b last:border-0"><td className="py-3 pr-3">{new Date(movement.created_at).toLocaleString('pt-BR')}</td><td className="py-3 pr-3">{movement.item_name}</td><td className="py-3 pr-3">{movement.movement_type} · {movement.location_name}</td><td className="py-3 pr-3">{movement.quantity_delta > 0 ? '+' : ''}{movement.quantity_delta}</td><td className="py-3 pr-3">{movement.balance_after}</td><td className="py-3" title={movement.performed_by}>{movement.performed_by.slice(0, 8)}</td></tr>)}</tbody></table></div>}</section> : null}
    </main>
  );
}
