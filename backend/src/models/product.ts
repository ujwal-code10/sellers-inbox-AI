export interface ProductCreateInput {
  name: string;
  price: number;
  keywords: string | null;
  notes: string | null;
}

export interface ProductUpdateInput {
  name?: string;
  price?: number;
  keywords?: string | null;
  notes?: string | null;
}
