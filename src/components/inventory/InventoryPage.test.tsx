// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ role: 'TEACHER' as string }));
const service = vi.hoisted(() => ({
  list: vi.fn(),
  createItem: vi.fn(),
  moveStock: vi.fn(),
  transferStock: vi.fn(),
  setItemActive: vi.fn(),
  requestItem: vi.fn(),
  decideRequest: vi.fn(),
  cancelRequest: vi.fn(),
  fulfillRequest: vi.fn(),
  startCount: vi.fn(),
  saveCount: vi.fn(),
  finalizeCount: vi.fn(),
  cancelCount: vi.fn(),
  listMovementReport: vi.fn(),
}));

vi.mock('../../contexts/InstitutionContext', () => ({
  useInstitution: () => ({
    currentInstitutionId: 'institution-1',
    currentRole: state.role,
    currentInstitution: { name: 'Escola Exemplo' },
  }),
}));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ profile: { id: 'teacher-1' } }),
}));
vi.mock('../../services/inventoryService', () => ({ inventoryService: service }));

import InventoryPage from './InventoryPage';

const item = {
  id: 'item-1', institution_id: 'institution-1', category_id: 'category-1',
  unit_id: 'unit-1', default_location_id: 'location-1', supplier_id: null,
  name: 'Papel A4', sku: null, description: null, minimum_quantity: 2,
  active: true, category: 'Papelaria', unit: 'resma',
  default_location: 'Almoxarifado', supplier: null, supplier_contact: null, stock: 5,
  location_balances: [{ location_id: 'location-1', location_name: 'Almoxarifado', quantity: 5 }],
};
const request = {
  id: 'request-1', request_item_id: 'request-item-1', requester_id: 'teacher-1',
  status: 'PENDING', note: null, created_at: '2026-10-22T12:00:00Z',
  requester_name: 'teacher-1', item_id: 'item-1', item_name: 'Papel A4', unit: 'resma',
  requested_quantity: 2, fulfilled_quantity: 0, location_id: 'location-1',
};

beforeEach(() => {
  state.role = 'TEACHER';
  service.list.mockResolvedValue({
    items: [item], requests: [request], movements: [],
    locations: [{ id: 'location-1', name: 'Almoxarifado' }, { id: 'location-2', name: 'Sala de Artes' }],
    countSessions: [],
  });
  service.createItem.mockResolvedValue(undefined);
  service.moveStock.mockResolvedValue(undefined);
  service.transferStock.mockResolvedValue(undefined);
  service.setItemActive.mockResolvedValue(undefined);
  service.requestItem.mockResolvedValue(undefined);
  service.decideRequest.mockResolvedValue(undefined);
  service.cancelRequest.mockResolvedValue(undefined);
  service.fulfillRequest.mockResolvedValue(undefined);
  service.startCount.mockResolvedValue(undefined);
  service.saveCount.mockResolvedValue(undefined);
  service.finalizeCount.mockResolvedValue(undefined);
  service.cancelCount.mockResolvedValue(undefined);
  service.listMovementReport.mockResolvedValue([]);
});
afterEach(() => cleanup());

describe('InventoryPage', () => {
  it('permite ao professor consultar o catálogo e solicitar material, sem operar estoque', async () => {
    render(<InventoryPage />);
    expect(await screen.findByText('Papel A4')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Solicitar/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Entrada/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Saída/ })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Cadastrar material' })).toBeNull();
    expect(screen.getByRole('button', { name: /Cancelar solicitação/ })).toBeTruthy();
    expect(screen.getByText('Aguardando aprovação')).toBeTruthy();
    expect(screen.getByText('Entregue: 0 de 2')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Quantidade solicitada'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /Solicitar/ }));
    await waitFor(() => expect(service.requestItem).toHaveBeenCalledWith(expect.objectContaining({
      institutionId: 'institution-1', itemId: 'item-1', quantity: 2,
    })));
    fireEvent.click(screen.getByRole('button', { name: /Cancelar solicitação/ }));
    await waitFor(() => expect(service.cancelRequest).toHaveBeenCalledWith(expect.objectContaining({
      institutionId: 'institution-1', requestId: 'request-1',
    })));
  });

  it('mostra ao professor o estado e o progresso de uma entrega parcial sem controles de estoque', async () => {
    service.list.mockResolvedValueOnce({
      items: [item],
      requests: [{ ...request, status: 'PARTIALLY_FULFILLED', fulfilled_quantity: 1 }],
      movements: [],
      locations: [{ id: 'location-1', name: 'Almoxarifado' }],
      countSessions: [],
    });

    render(<InventoryPage />);

    expect(await screen.findByText('Entrega parcial')).toBeTruthy();
    expect(screen.getByText('Parte da quantidade solicitada já foi entregue.')).toBeTruthy();
    expect(screen.getByText('Entregue: 1 de 2')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Progresso da entrega de Papel A4' }).getAttribute('aria-valuenow')).toBe('50');
    expect(screen.queryByRole('button', { name: 'Registrar entrega' })).toBeNull();
  });

  it('libera cadastro, transferências e gestão de materiais somente para direção/secretaria', async () => {
    state.role = 'DIRECTOR';
    render(<InventoryPage />);
    expect(await screen.findByText('Papel A4')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Cadastrar material' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Transferência' })).toBeTruthy();
    expect(screen.getByLabelText('Destino (transferência)')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Desativar material/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Solicitar/ })).toBeNull();

    fireEvent.change(screen.getByLabelText('Operação'), { target: { value: 'TRANSFER' } });
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Destino (transferência)'), { target: { value: 'location-2' } });
    fireEvent.change(screen.getByLabelText('Observação / justificativa'), { target: { value: 'Reposição sala' } });
    fireEvent.click(screen.getByRole('button', { name: /Registrar operação/ }));
    await waitFor(() => expect(service.transferStock).toHaveBeenCalledWith(expect.objectContaining({
      institutionId: 'institution-1', itemId: 'item-1',
      sourceLocationId: 'location-1', destinationLocationId: 'location-2', quantity: 2,
    })));
  });

  it('permite à direção abrir, salvar e reconciliar uma contagem física auditável', async () => {
    state.role = 'DIRECTOR';
    const openSession = {
      id: 'count-1', location_id: 'location-1', location_name: 'Almoxarifado',
      status: 'OPEN' as const, note: 'Conferência mensal', created_at: '2026-10-23T12:00:00Z',
      finalized_at: null,
      lines: [{
        id: 'count-line-1', item_id: 'item-1', item_name: 'Papel A4', unit: 'resma',
        expected_quantity: 5, counted_quantity: null,
      }],
    };
    const countedSession = {
      ...openSession,
      lines: [{ ...openSession.lines[0], counted_quantity: 4 }],
    };
    service.list.mockResolvedValueOnce({
      items: [item], requests: [], movements: [],
      locations: [{ id: 'location-1', name: 'Almoxarifado' }, { id: 'location-2', name: 'Sala de Artes' }],
      countSessions: [openSession],
    }).mockResolvedValue({
      items: [item], requests: [], movements: [],
      locations: [{ id: 'location-1', name: 'Almoxarifado' }, { id: 'location-2', name: 'Sala de Artes' }],
      countSessions: [countedSession],
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<InventoryPage />);

    expect(await screen.findByText('Almoxarifado', { selector: 'h3' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Inventário físico' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Contagem física de Papel A4'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar contagens' }));
    await waitFor(() => expect(service.saveCount).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'count-1', lines: [{ lineId: 'count-line-1', countedQuantity: 4 }],
    })));
    const finalizeButton = await screen.findByRole('button', { name: 'Reconciliar e finalizar' });
    expect(finalizeButton.hasAttribute('disabled')).toBe(false);
    fireEvent.click(finalizeButton);
    await waitFor(() => expect(service.finalizeCount).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'count-1',
    })));
  });

  it('não mostra contagens físicas para professores', async () => {
    render(<InventoryPage />);
    await screen.findByText('Papel A4');
    expect(screen.queryByRole('heading', { name: 'Inventário físico' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Abrir contagem' })).toBeNull();
  });
});
