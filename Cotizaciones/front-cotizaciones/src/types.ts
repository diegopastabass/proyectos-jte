export interface User {
  email: string;
  fullName: string;
  role: string;
}

export interface QuoteItem {
  detail: string;
  qty: number;
  unitPrice: number;
}

export interface QuoteData {
  project: string;
  clientName: string;
  company: string;
  contact: string;
  email: string;
  items: QuoteItem[];
  generalDesc: string;
  deliveryTime: string;
  paymentTerms: string;
  considerations: string;
  subtotal: number;
  iva: number;
  total: number;
}

export interface Quote {
  id: string;
  folio: string;
  created_at: string;
  data: QuoteData;
  user?: {
    name: string;
  };
}
