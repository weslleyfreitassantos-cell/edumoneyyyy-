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
  });
  service.createItem.mockResolvedValue(undefined);
  service.moveStock.mockResolvedValue(undefined);
  service.transferStock.mockResolvedValue(undefined);
  service.setItemActive.mockResolvedValue(undefined);
  service.requestItem.mockResolvedValue(undefined);
  service.decideRequest.mockResolvedValue(undefined);
  service.cancelRequest.mockResolvedValue(undefined);
  service.fulfillRequest.mockResolvedValue(undefined);
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
});
