import { supabase } from '../lib/supabaseClient';

export interface InventoryItem {
  id: string;
  institution_id: string;
  category_id: string;
  unit_id: string;
  default_location_id: string;
  supplier_id: string | null;
  name: string;
  sku: string | null;
  description: string | null;
  minimum_quantity: number;
  active: boolean;
  category: string;
  unit: string;
  default_location: string;
  supplier: string | null;
  stock: number;
  location_balances: Array<{ location_id: string; location_name: string; quantity: number }>;
}

export interface InventoryLocation {
  id: string;
  name: string;
}

export interface InventoryRequest {
  id: string;
  request_item_id: string;
  requester_id: string;
  status: string;
  note: string | null;
  created_at: string;
  requester_name: string;
  item_id: string;
  item_name: string;
  unit: string;
  requested_quantity: number;
  fulfilled_quantity: number;
  location_id: string;
}

export interface InventoryMovement {
  id: string;
  item_name: string;
  location_name: string;
  movement_type: string;
  quantity_delta: number;
  balance_after: number;
  note: string | null;
  created_at: string;
  performed_by: string;
}

function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export const inventoryService = {
  async list(institutionId: string): Promise<{
    items: InventoryItem[];
    requests: InventoryRequest[];
    movements: InventoryMovement[];
    locations: InventoryLocation[];
  }> {
    const [itemsResult, categoriesResult, unitsResult, locationsResult,
      suppliersResult, balancesResult, requestsResult, movementsResult] =
      await Promise.all([
        supabase.from('inventory_items').select('*')
          .eq('institution_id', institutionId).order('name'),
        supabase.from('inventory_categories').select('id, name')
          .eq('institution_id', institutionId).eq('active', true).order('name'),
        supabase.from('inventory_units').select('id, name')
          .eq('institution_id', institutionId).eq('active', true).order('name'),
        supabase.from('inventory_locations').select('id, name')
          .eq('institution_id', institutionId).eq('active', true).order('name'),
        supabase.from('inventory_suppliers').select('id, name')
          .eq('institution_id', institutionId).eq('active', true).order('name'),
        supabase.from('inventory_balances').select('item_id, location_id, quantity')
          .eq('institution_id', institutionId),
        supabase.from('inventory_requests').select('*')
          .eq('institution_id', institutionId).order('created_at', { ascending: false }).limit(200),
        supabase.from('inventory_movements').select('*')
          .eq('institution_id', institutionId).order('created_at', { ascending: false }).limit(100),
      ]);
    for (const result of [itemsResult, categoriesResult, unitsResult,
      locationsResult, suppliersResult, balancesResult, requestsResult, movementsResult]) {
      throwIfError(result.error);
    }

    const items = (itemsResult.data ?? []) as Array<Record<string, unknown>>;
    const categories = new Map((categoriesResult.data ?? []).map((row) => [row.id, row.name]));
    const units = new Map((unitsResult.data ?? []).map((row) => [row.id, row.name]));
    const locations = new Map((locationsResult.data ?? []).map((row) => [row.id, row.name]));
    const suppliers = new Map((suppliersResult.data ?? []).map((row) => [row.id, row.name]));
    const stockByItem = new Map<string, number>();
    const balancesByItem = new Map<string, Array<{ location_id: string; location_name: string; quantity: number }>>();
    for (const balance of balancesResult.data ?? []) {
      const itemId = String(balance.item_id);
      const locationId = String(balance.location_id);
      const quantity = Number(balance.quantity);
      stockByItem.set(itemId, (stockByItem.get(itemId) ?? 0) + quantity);
      const locationBalances = balancesByItem.get(itemId) ?? [];
      locationBalances.push({
        location_id: locationId,
        location_name: locations.get(locationId) ?? 'Local não informado',
        quantity,
      });
      balancesByItem.set(itemId, locationBalances);
    }
    const itemRows: InventoryItem[] = items.map((row) => ({
      id: String(row.id),
      institution_id: String(row.institution_id),
      category_id: String(row.category_id),
      unit_id: String(row.unit_id),
      default_location_id: String(row.default_location_id),
      supplier_id: row.supplier_id ? String(row.supplier_id) : null,
      name: String(row.name),
      sku: row.sku ? String(row.sku) : null,
      description: row.description ? String(row.description) : null,
      minimum_quantity: Number(row.minimum_quantity),
      active: Boolean(row.active),
      category: categories.get(String(row.category_id)) ?? 'Sem categoria',
      unit: units.get(String(row.unit_id)) ?? 'unidade',
      default_location: locations.get(String(row.default_location_id)) ?? 'Local não informado',
      supplier: row.supplier_id ? suppliers.get(String(row.supplier_id)) ?? null : null,
      stock: stockByItem.get(String(row.id)) ?? 0,
      location_balances: balancesByItem.get(String(row.id)) ?? [],
    }));
    const itemMap = new Map(itemRows.map((item) => [item.id, item]));
    const requestRows = (requestsResult.data ?? []) as Array<Record<string, unknown>>;
    const requestIds = requestRows.map((row) => String(row.id));
    const requestItemsResult = requestIds.length
      ? await supabase.from('inventory_request_items').select('*')
        .eq('institution_id', institutionId).in('request_id', requestIds)
      : { data: [], error: null };
    throwIfError(requestItemsResult.error);
    const requests: InventoryRequest[] = (requestItemsResult.data ?? []).flatMap((line) => {
      const request = requestRows.find((row) => row.id === line.request_id);
      const item = itemMap.get(String(line.item_id));
      if (!request || !item) return [];
      return [{
        id: String(request.id),
        request_item_id: String(line.id),
        requester_id: String(request.requester_id),
        status: String(request.status),
        note: request.note ? String(request.note) : null,
        created_at: String(request.created_at),
        requester_name: String(request.requester_id),
        item_id: item.id,
        item_name: item.name,
        unit: item.unit,
        requested_quantity: Number(line.requested_quantity),
        fulfilled_quantity: Number(line.fulfilled_quantity),
        location_id: item.default_location_id,
      }];
    });
    const movementRows = (movementsResult.data ?? []) as Array<Record<string, unknown>>;
    const movements: InventoryMovement[] = movementRows.map((row) => ({
      id: String(row.id),
      item_name: itemMap.get(String(row.item_id))?.name ?? 'Item arquivado',
      location_name: locations.get(String(row.location_id)) ?? 'Local',
      movement_type: String(row.movement_type),
      quantity_delta: Number(row.quantity_delta),
      balance_after: Number(row.balance_after),
      note: row.note ? String(row.note) : null,
      created_at: String(row.created_at),
      performed_by: String(row.performed_by),
    }));
    const locationRows: InventoryLocation[] = (locationsResult.data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name),
    }));
    return { items: itemRows, requests, movements, locations: locationRows };
  },

  async createItem(input: {
    institutionId: string;
    name: string;
    category: string;
    unit: string;
    location: string;
    supplier: string;
    sku: string;
    description: string;
    minimumQuantity: number;
    initialQuantity: number;
    idempotencyKey: string;
  }): Promise<void> {
    const { error } = await supabase.rpc('inventory_create_item', {
      p_institution_id: input.institutionId,
      p_name: input.name,
      p_category: input.category,
      p_unit: input.unit,
      p_location: input.location,
      p_supplier: input.supplier || null,
      p_sku: input.sku || null,
      p_description: input.description || null,
      p_minimum_quantity: input.minimumQuantity,
      p_initial_quantity: input.initialQuantity,
      p_idempotency_key: input.idempotencyKey,
    });
    throwIfError(error);
  },

  async moveStock(input: {
    institutionId: string;
    itemId: string;
    locationId: string;
    type: 'RECEIPT' | 'ISSUE' | 'RETURN' | 'ADJUSTMENT';
    quantity: number;
    note: string;
    idempotencyKey: string;
  }): Promise<void> {
    const { error } = await supabase.rpc('inventory_record_movement', {
      p_institution_id: input.institutionId,
      p_item_id: input.itemId,
      p_location_id: input.locationId,
      p_movement_type: input.type,
      p_quantity: input.quantity,
      p_note: input.note || null,
      p_idempotency_key: input.idempotencyKey,
    });
    throwIfError(error);
  },

  async transferStock(input: {
    institutionId: string;
    itemId: string;
    sourceLocationId: string;
    destinationLocationId: string;
    quantity: number;
    note: string;
    idempotencyKey: string;
  }): Promise<void> {
    const { error } = await supabase.rpc('inventory_transfer_stock', {
      p_institution_id: input.institutionId,
      p_item_id: input.itemId,
      p_source_location_id: input.sourceLocationId,
      p_destination_location_id: input.destinationLocationId,
      p_quantity: input.quantity,
      p_note: input.note,
      p_idempotency_key: input.idempotencyKey,
    });
    throwIfError(error);
  },

  async setItemActive(input: {
    institutionId: string;
    itemId: string;
    active: boolean;
    idempotencyKey: string;
  }): Promise<void> {
    const { error } = await supabase.rpc('inventory_set_item_active', {
      p_institution_id: input.institutionId,
      p_item_id: input.itemId,
      p_active: input.active,
      p_idempotency_key: input.idempotencyKey,
    });
    throwIfError(error);
  },

  async requestItem(input: {
    institutionId: string;
    itemId: string;
    quantity: number;
    note: string;
    idempotencyKey: string;
  }): Promise<void> {
    const { error } = await supabase.rpc('inventory_create_request', {
      p_institution_id: input.institutionId,
      p_item_id: input.itemId,
      p_quantity: input.quantity,
      p_note: input.note || null,
      p_idempotency_key: input.idempotencyKey,
    });
    throwIfError(error);
  },

  async decideRequest(input: {
    institutionId: string;
    requestId: string;
    decision: 'APPROVED' | 'REJECTED';
    idempotencyKey: string;
  }): Promise<void> {
    const { error } = await supabase.rpc('inventory_decide_request', {
      p_institution_id: input.institutionId,
      p_request_id: input.requestId,
      p_decision: input.decision,
      p_idempotency_key: input.idempotencyKey,
    });
    throwIfError(error);
  },

  async cancelRequest(input: {
    institutionId: string;
    requestId: string;
    idempotencyKey: string;
  }): Promise<void> {
    const { error } = await supabase.rpc('inventory_cancel_request', {
      p_institution_id: input.institutionId,
      p_request_id: input.requestId,
      p_idempotency_key: input.idempotencyKey,
    });
    throwIfError(error);
  },

  async fulfillRequest(input: {
    institutionId: string;
    requestId: string;
    requestItemId: string;
    locationId: string;
    quantity: number;
    idempotencyKey: string;
  }): Promise<void> {
    const { error } = await supabase.rpc('inventory_fulfill_request', {
      p_institution_id: input.institutionId,
      p_request_id: input.requestId,
      p_request_item_id: input.requestItemId,
      p_location_id: input.locationId,
      p_quantity: input.quantity,
      p_idempotency_key: input.idempotencyKey,
    });
    throwIfError(error);
  },
};
