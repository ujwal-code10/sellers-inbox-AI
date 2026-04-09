export interface DeliveryZoneCreateInput {
  name: string;
  price: number;
  codAvailable: boolean;
}

export interface DeliveryZoneUpdateInput {
  name?: string;
  price?: number;
  codAvailable?: boolean;
}
