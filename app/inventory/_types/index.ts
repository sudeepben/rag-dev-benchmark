export interface Item {
  id: string;
  sku: string | null;
  name: string;
  description: string | null;
  category: string | null;
  brand: string | null;
  price: string | null;
  discount: string | null;
  stock: number;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ItemsResponse {
  items: Item[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters: {
    categories: string[];
    brands: string[];
  };
}

export interface ImportResponse {
  imported: number;
  embedded: number;
  total: number;
  errors: string[];
  message: string;
}
