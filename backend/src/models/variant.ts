export interface VariantCreateInput {
  color: string;
  size: string;
  available: boolean;
}

export interface VariantBulkCreateInput {
  variants: VariantCreateInput[];
}

export interface VariantAvailabilityUpdateInput {
  available: boolean;
  version: number;
}
