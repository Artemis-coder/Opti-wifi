import { create } from 'zustand';

export interface TicketType {
  id: string;
  name: string;
  duration: string; // e.g., '24h', '3 jours'
  price: number; // in FCFA
  status: 'active' | 'inactive';
}

export interface PointOfSale {
  id: string;
  name: string;
  managerName: string;
  phone: string;
  address: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface TicketDistribution {
  id: string;
  pointOfSaleId: string;
  ticketTypeId: string;
  quantity: number;
  unitPrice: number;
  distributedAt: string;
}

export interface SaleItem {
  ticketTypeId: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
}

export interface Sale {
  id: string;
  pointOfSaleId: string;
  saleDate: string;
  items: SaleItem[];
  totalAmount: number;
}

export interface CollectionItem {
  ticketTypeId: string;
  quantitySold: number;
  unitPrice: number;
  totalAmount: number;
}

export interface Collection {
  id: string;
  pointOfSaleId: string;
  expectedAmount: number;
  collectedAmount: number;
  difference: number;
  collectionDate: string;
  status: 'draft' | 'pending' | 'validated' | 'cancelled';
  comment?: string;
  reason?: string; // motif de l'écart
  items: CollectionItem[];
}

interface DataState {
  ticketTypes: TicketType[];
  pointsOfSale: PointOfSale[];
  distributions: TicketDistribution[];
  sales: Sale[];
  collections: Collection[];
  
  // Actions
  addTicketType: (ticket: Omit<TicketType, 'id'>) => void;
  updateTicketType: (id: string, ticket: Partial<TicketType>) => void;
  addPointOfSale: (pos: Omit<PointOfSale, 'id' | 'createdAt'>) => void;
  updatePointOfSale: (id: string, pos: Partial<PointOfSale>) => void;
  distributeTickets: (dist: Omit<TicketDistribution, 'id' | 'distributedAt'>) => void;
  recordSale: (sale: Omit<Sale, 'id' | 'saleDate'>) => void;
  createCollection: (collection: Omit<Collection, 'id' | 'collectionDate'>) => void;
  validateCollection: (id: string) => void;
  
  // Selectors/Helpers
  getStock: (posId: string, ticketTypeId: string) => number;
  getExpectedCollection: (posId: string) => {
    expectedAmount: number;
    items: CollectionItem[];
  };
}

export const useDataStore = create<DataState>((set, get) => ({
  ticketTypes: [
    { id: '1', name: '24H', duration: '24 heures', price: 500, status: 'active' },
    { id: '2', name: '3 Jours', duration: '3 jours', price: 1000, status: 'active' },
    { id: '3', name: '7 Jours', duration: '7 jours', price: 2000, status: 'active' },
    { id: '4', name: '1 Mois', duration: '30 jours', price: 5000, status: 'active' },
  ],
  pointsOfSale: [
    { id: '1', name: 'Boutique ABC', managerName: 'Alice', phone: '+241 07 11 22 33', address: 'Libreville', status: 'active', createdAt: new Date().toISOString() },
    { id: '2', name: 'Alimentation XYZ', managerName: 'Xavier', phone: '+241 06 44 55 66', address: 'Port-Gentil', status: 'active', createdAt: new Date().toISOString() },
  ],
  distributions: [
    { id: 'd1', pointOfSaleId: '1', ticketTypeId: '1', quantity: 17, unitPrice: 500, distributedAt: new Date().toISOString() },
    { id: 'd2', pointOfSaleId: '1', ticketTypeId: '2', quantity: 10, unitPrice: 1000, distributedAt: new Date().toISOString() },
    { id: 'd3', pointOfSaleId: '1', ticketTypeId: '3', quantity: 5, unitPrice: 2000, distributedAt: new Date().toISOString() },
    { id: 'd4', pointOfSaleId: '1', ticketTypeId: '4', quantity: 3, unitPrice: 5000, distributedAt: new Date().toISOString() },
  ],
  sales: [
    {
      id: 's1',
      pointOfSaleId: '1',
      saleDate: new Date().toISOString(),
      totalAmount: 18500,
      items: [
        { ticketTypeId: '1', quantity: 7, unitPrice: 500, totalAmount: 3500 },
        { ticketTypeId: '2', quantity: 6, unitPrice: 1000, totalAmount: 6000 },
        { ticketTypeId: '3', quantity: 2, unitPrice: 2000, totalAmount: 4000 },
        { ticketTypeId: '4', quantity: 1, unitPrice: 5000, totalAmount: 5000 },
      ]
    }
  ],
  collections: [],

  addTicketType: (ticket) => set((state) => ({
    ticketTypes: [...state.ticketTypes, { ...ticket, id: String(state.ticketTypes.length + 1) }]
  })),

  updateTicketType: (id, updated) => set((state) => ({
    ticketTypes: state.ticketTypes.map(t => t.id === id ? { ...t, ...updated } : t)
  })),

  addPointOfSale: (pos) => set((state) => ({
    pointsOfSale: [...state.pointsOfSale, { ...pos, id: String(state.pointsOfSale.length + 1), createdAt: new Date().toISOString() }]
  })),

  updatePointOfSale: (id, updated) => set((state) => ({
    pointsOfSale: state.pointsOfSale.map(pos => pos.id === id ? { ...pos, ...updated } : pos)
  })),

  distributeTickets: (dist) => set((state) => ({
    distributions: [...state.distributions, { ...dist, id: `d_${Date.now()}`, distributedAt: new Date().toISOString() }]
  })),

  recordSale: (sale) => set((state) => ({
    sales: [...state.sales, { ...sale, id: `s_${Date.now()}`, saleDate: new Date().toISOString() }]
  })),

  createCollection: (col) => set((state) => ({
    collections: [...state.collections, { ...col, id: `c_${Date.now()}`, collectionDate: new Date().toISOString() }]
  })),

  validateCollection: (id) => set((state) => ({
    collections: state.collections.map(c => c.id === id ? { ...c, status: 'validated' as const } : c)
  })),

  // Selector functions
  getStock: (posId, ticketTypeId) => {
    const { distributions, sales } = get();
    
    // Total distributed
    const totalDistributed = distributions
      .filter(d => d.pointOfSaleId === posId && d.ticketTypeId === ticketTypeId)
      .reduce((sum, d) => sum + d.quantity, 0);

    // Total sold
    const totalSold = sales
      .filter(s => s.pointOfSaleId === posId)
      .flatMap(s => s.items)
      .filter(item => item.ticketTypeId === ticketTypeId)
      .reduce((sum, item) => sum + item.quantity, 0);

    return totalDistributed - totalSold;
  },

  getExpectedCollection: (posId) => {
    const { distributions, sales, collections, ticketTypes } = get();
    
    // An expected collection checks all sales for this point of sale that haven't been collected yet.
    // For simplicity in V1, let's look at the difference between:
    // Total sold VS Total collected in validated/pending collections.
    
    const items: CollectionItem[] = [];
    let expectedAmount = 0;

    ticketTypes.forEach(type => {
      // Total sold for this type
      const totalSold = sales
        .filter(s => s.pointOfSaleId === posId)
        .flatMap(s => s.items)
        .filter(item => item.ticketTypeId === type.id)
        .reduce((sum, item) => sum + item.quantity, 0);

      // Total already accounted for in collections (validated or pending)
      const totalCollectedQty = collections
        .filter(c => c.pointOfSaleId === posId && (c.status === 'validated' || c.status === 'pending'))
        .flatMap(c => c.items)
        .filter(item => item.ticketTypeId === type.id)
        .reduce((sum, item) => sum + item.quantitySold, 0);

      const uncollectedQty = totalSold - totalCollectedQty;

      if (uncollectedQty > 0) {
        const itemAmount = uncollectedQty * type.price;
        items.push({
          ticketTypeId: type.id,
          quantitySold: uncollectedQty,
          unitPrice: type.price,
          totalAmount: itemAmount
        });
        expectedAmount += itemAmount;
      }
    });

    return { expectedAmount, items };
  }
}));
