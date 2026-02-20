import Dexie, { Table } from "dexie";

export interface Product {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  companyId: string;
  updatedAt: Date;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  updatedAt: Date;
}

export interface Sale {
  id: string;
  clientId?: string;
  branchId: string;
  total: number;
  createdAt: Date;
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  userId?: string;
  companyId?: string;
  items: Array<{ productId: string; quantity: number; price: number }>;
}

export interface PendingAction {
  id: string; // generated client-side
  type: "CREATE_SALE" | "CREATE_CLIENT" | "UPDATE_CLIENT" | "DELETE_CLIENT";
  payload: any;
  createdAt: number;
  synced: boolean;
  failedCount: number;
  error?: string;
}

export class AppDatabase extends Dexie {
  products!: Table<Product>;
  clients!: Table<Client>;
  sales!: Table<Sale>;
  pendingActions!: Table<PendingAction>;

  constructor() {
    super("pos-db");
    this.version(1).stores({
      products: "id, name, categoryId",
      clients: "id, name, email, phone",
      sales: "id, createdAt, status, branchId",
      pendingActions: "id, type, createdAt, synced",
    });
  }
}

export const db = new AppDatabase();
