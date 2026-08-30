export type UserRole = 'administrateur' | 'collecteur';
export type PosStatus = 'actif' | 'inactif' | 'suspendu';
export type CollectionStatus = 'brouillon' | 'validee' | 'annulee';

export interface Profile {
  id: string;
  nom: string;
  email: string;
  role: UserRole;
  telephone?: string;
  devise?: string;
  created_at: string;
  updated_at: string;
}

export interface PointOfSale {
  id: string;
  nom: string;
  adresse?: string;
  ville: string;
  statut: PosStatus;
  collecteur_id?: string;
  created_at: string;
  updated_at: string;
  collecteur?: Profile;
}

export interface TicketType {
  id: string;
  nom: string;
  duree_heures: number;
  prix: number;
  actif: boolean;
  created_at: string;
}

export interface TicketAllocation {
  id: string;
  pos_id: string;
  ticket_type_id: string;
  quantite: number;
  alloue_par?: string;
  notes?: string;
  created_at: string;
  pos?: PointOfSale;
  ticket_type?: TicketType;
}

export interface Collection {
  id: string;
  pos_id: string;
  collecteur_id: string;
  statut: CollectionStatus;
  montant_attendu: number;
  montant_collecte: number;
  difference: number;
  commission: number;
  date_collecte?: string;
  notes?: string;
  created_at: string;
  pos?: PointOfSale;
  collecteur?: Profile;
  items?: CollectionItem[];
}

export interface CollectionItem {
  id: string;
  collection_id: string;
  ticket_type_id: string;
  stock_debut: number;
  quantite_vendue: number;
  prix_unitaire: number;
  montant_total: number;
  ticket_type?: TicketType;
}

export interface DashboardKpis {
  ticketsVendusTotal: number;
  chiffreAffairesTotal: number;
  montantACollecter: number;
  montantCollecteTotal: number;
  ecartTotal: number;
  posActifsCount: number;
}
